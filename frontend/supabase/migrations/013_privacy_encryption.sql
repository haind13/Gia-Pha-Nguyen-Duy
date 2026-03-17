-- ╔══════════════════════════════════════════════════════════════════╗
-- ║  013: Privacy & Encryption — Bảo vệ dữ liệu cá nhân          ║
-- ║  Luật BVDLCN Việt Nam (91/2025), AES-256 encryption          ║
-- ║  Sử dụng Supabase Vault để lưu trữ encryption key            ║
-- ╚══════════════════════════════════════════════════════════════════╝
-- STATUS: ĐÃ CHẠY trên Supabase production (2026-03-17)

-- ═══ 1. Enable pgcrypto extension ═══
CREATE EXTENSION IF NOT EXISTS pgcrypto;

-- ═══ 2. Store encryption key in Supabase Vault ═══
-- Key đã được tạo và lưu trong Vault với name = 'app_encryption_key'
-- SELECT vault.create_secret(encode(gen_random_bytes(32), 'hex'), 'app_encryption_key', 'AES-256 encryption key for people table sensitive data');

-- ═══ 3. Helper function to get key from Vault ═══
CREATE OR REPLACE FUNCTION get_encryption_key()
RETURNS TEXT
LANGUAGE sql SECURITY DEFINER STABLE
AS $$
    SELECT decrypted_secret FROM vault.decrypted_secrets WHERE name = 'app_encryption_key' LIMIT 1;
$$;

REVOKE EXECUTE ON FUNCTION get_encryption_key() FROM anon, authenticated;

-- ═══ 4. Encryption helper functions (AES-256 via PGP symmetric) ═══
CREATE OR REPLACE FUNCTION encrypt_sensitive(plaintext TEXT)
RETURNS TEXT
LANGUAGE sql SECURITY DEFINER STABLE
AS $$
    SELECT CASE
        WHEN plaintext IS NULL OR plaintext = '' THEN NULL
        ELSE encode(
            pgp_sym_encrypt(
                plaintext,
                (SELECT get_encryption_key()),
                'cipher-algo=aes256'
            ),
            'base64'
        )
    END;
$$;

CREATE OR REPLACE FUNCTION decrypt_sensitive(ciphertext TEXT)
RETURNS TEXT
LANGUAGE sql SECURITY DEFINER STABLE
AS $$
    SELECT CASE
        WHEN ciphertext IS NULL OR ciphertext = '' THEN NULL
        ELSE pgp_sym_decrypt(
            decode(ciphertext, 'base64'),
            (SELECT get_encryption_key())
        )
    END;
$$;

-- Revoke direct access to encryption functions from anon/authenticated
REVOKE EXECUTE ON FUNCTION encrypt_sensitive(TEXT) FROM anon, authenticated;
REVOKE EXECUTE ON FUNCTION decrypt_sensitive(TEXT) FROM anon, authenticated;

-- ═══ 5. User access tier function ═══
CREATE OR REPLACE FUNCTION get_access_tier()
RETURNS TEXT
LANGUAGE sql STABLE SECURITY DEFINER
AS $$
    SELECT CASE
        WHEN auth.uid() IS NULL THEN 'guest'
        WHEN EXISTS (
            SELECT 1 FROM profiles
            WHERE id = auth.uid() AND role = 'admin'
        ) THEN 'admin'
        ELSE 'member'
    END;
$$;

GRANT EXECUTE ON FUNCTION get_access_tier() TO anon, authenticated;

-- ═══ 6. Add encrypted columns to people table ═══
ALTER TABLE people ADD COLUMN IF NOT EXISTS phone_enc TEXT;
ALTER TABLE people ADD COLUMN IF NOT EXISTS email_enc TEXT;
ALTER TABLE people ADD COLUMN IF NOT EXISTS zalo_enc TEXT;
ALTER TABLE people ADD COLUMN IF NOT EXISTS facebook_enc TEXT;
ALTER TABLE people ADD COLUMN IF NOT EXISTS current_address_enc TEXT;
ALTER TABLE people ADD COLUMN IF NOT EXISTS hometown_enc TEXT;

-- ═══ 7. Migrate existing plaintext → encrypted ═══
-- (Đã chạy trên production, dữ liệu plaintext đã được xóa)
UPDATE people SET
    phone_enc = encrypt_sensitive(phone),
    email_enc = encrypt_sensitive(email),
    zalo_enc = encrypt_sensitive(zalo),
    facebook_enc = encrypt_sensitive(facebook),
    current_address_enc = encrypt_sensitive(current_address),
    hometown_enc = encrypt_sensitive(hometown)
WHERE phone IS NOT NULL
   OR email IS NOT NULL
   OR zalo IS NOT NULL
   OR facebook IS NOT NULL
   OR current_address IS NOT NULL
   OR hometown IS NOT NULL;

-- ═══ 8. Secure view — returns masked data based on access tier ═══
CREATE OR REPLACE VIEW people_safe AS
SELECT
    p.id,
    p.display_name,
    p.surname,
    p.first_name,
    p.gender,
    p.generation,
    p.chi,
    p.birth_year,
    p.death_year,
    p.is_living,
    p.is_patrilineal,
    p.is_privacy_filtered,
    p.gramps_id,
    p.nick_name,
    p.title,
    p.birth_order,
    -- Personal data: hidden for guests
    CASE WHEN get_access_tier() = 'guest' THEN NULL ELSE p.birth_date END AS birth_date,
    CASE WHEN get_access_tier() = 'guest' THEN NULL ELSE p.death_date END AS death_date,
    CASE WHEN get_access_tier() = 'guest' THEN NULL ELSE p.birth_date_solar END AS birth_date_solar,
    CASE WHEN get_access_tier() = 'guest' THEN NULL ELSE p.death_date_solar END AS death_date_solar,
    CASE WHEN get_access_tier() = 'guest' THEN NULL ELSE p.birth_place END AS birth_place,
    CASE WHEN get_access_tier() = 'guest' THEN NULL ELSE p.death_place END AS death_place,
    CASE WHEN get_access_tier() = 'guest' THEN NULL ELSE p.occupation END AS occupation,
    CASE WHEN get_access_tier() = 'guest' THEN NULL ELSE p.company END AS company,
    CASE WHEN get_access_tier() = 'guest' THEN NULL ELSE p.education END AS education,
    CASE WHEN get_access_tier() = 'guest' THEN NULL ELSE p.marital_status END AS marital_status,
    CASE WHEN get_access_tier() = 'guest' THEN NULL ELSE p.notes END AS notes,
    -- Sensitive data: hidden for guests, masked for members, full for admin
    CASE
        WHEN get_access_tier() = 'admin' THEN COALESCE(decrypt_sensitive(p.phone_enc), p.phone)
        WHEN get_access_tier() = 'member' THEN
            CASE WHEN p.phone IS NOT NULL OR p.phone_enc IS NOT NULL
                 THEN CONCAT(LEFT(COALESCE(decrypt_sensitive(p.phone_enc), p.phone), 4), '***')
                 ELSE NULL END
        ELSE NULL
    END AS phone,
    CASE
        WHEN get_access_tier() = 'admin' THEN COALESCE(decrypt_sensitive(p.email_enc), p.email)
        WHEN get_access_tier() = 'member' THEN
            CASE WHEN p.email IS NOT NULL OR p.email_enc IS NOT NULL
                 THEN CONCAT(LEFT(COALESCE(decrypt_sensitive(p.email_enc), p.email), 1), '***@***')
                 ELSE NULL END
        ELSE NULL
    END AS email,
    CASE
        WHEN get_access_tier() = 'admin' THEN COALESCE(decrypt_sensitive(p.zalo_enc), p.zalo)
        WHEN get_access_tier() = 'member' THEN '***'
        ELSE NULL
    END AS zalo,
    CASE
        WHEN get_access_tier() = 'admin' THEN COALESCE(decrypt_sensitive(p.facebook_enc), p.facebook)
        WHEN get_access_tier() = 'member' THEN '***'
        ELSE NULL
    END AS facebook,
    CASE
        WHEN get_access_tier() = 'admin' THEN COALESCE(decrypt_sensitive(p.current_address_enc), p.current_address)
        WHEN get_access_tier() = 'member' THEN '***'
        ELSE NULL
    END AS current_address,
    CASE
        WHEN get_access_tier() = 'admin' THEN COALESCE(decrypt_sensitive(p.hometown_enc), p.hometown)
        WHEN get_access_tier() = 'member' THEN '***'
        ELSE NULL
    END AS hometown,
    CASE
        WHEN get_access_tier() = 'admin' THEN p.blood_type
        ELSE NULL
    END AS blood_type,
    p.created_at,
    p.updated_at
FROM people p;

-- Grant access to the view
GRANT SELECT ON people_safe TO anon, authenticated;

-- ═══ 9. Encryption trigger for new inserts/updates ═══
-- Only encrypts when plaintext field has a value (not NULL)
-- This prevents overwriting existing encrypted data when clearing plaintext
CREATE OR REPLACE FUNCTION encrypt_people_sensitive()
RETURNS TRIGGER
LANGUAGE plpgsql SECURITY DEFINER
AS $$
BEGIN
    IF NEW.phone IS NOT NULL THEN
        NEW.phone_enc = encrypt_sensitive(NEW.phone);
    END IF;
    IF NEW.email IS NOT NULL THEN
        NEW.email_enc = encrypt_sensitive(NEW.email);
    END IF;
    IF NEW.zalo IS NOT NULL THEN
        NEW.zalo_enc = encrypt_sensitive(NEW.zalo);
    END IF;
    IF NEW.facebook IS NOT NULL THEN
        NEW.facebook_enc = encrypt_sensitive(NEW.facebook);
    END IF;
    IF NEW.current_address IS NOT NULL THEN
        NEW.current_address_enc = encrypt_sensitive(NEW.current_address);
    END IF;
    IF NEW.hometown IS NOT NULL THEN
        NEW.hometown_enc = encrypt_sensitive(NEW.hometown);
    END IF;
    RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_encrypt_people ON people;
CREATE TRIGGER trg_encrypt_people
    BEFORE INSERT OR UPDATE ON people
    FOR EACH ROW
    EXECUTE FUNCTION encrypt_people_sensitive();

-- ═══ 10. Clear plaintext after verification ═══
-- IMPORTANT: Disable trigger first to avoid overwriting _enc columns
-- ALTER TABLE people DISABLE TRIGGER trg_encrypt_people;
-- UPDATE people SET phone = NULL, email = NULL, zalo = NULL,
--                   facebook = NULL, current_address = NULL, hometown = NULL;
-- ALTER TABLE people ENABLE TRIGGER trg_encrypt_people;
