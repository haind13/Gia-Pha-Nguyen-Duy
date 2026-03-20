-- ╔══════════════════════════════════════════════════════════════════╗
-- ║  017: Fix people_safe view — add tree_id column               ║
-- ║  Bug: Thống kê trống vì people_safe thiếu tree_id             ║
-- ╚══════════════════════════════════════════════════════════════════╝
-- STATUS: ĐÃ CHẠY trên Supabase production (2026-03-20)

DROP VIEW IF EXISTS people_safe;

CREATE VIEW people_safe AS
SELECT
    p.id,
    p.tree_id,
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

-- Ensure grants are preserved
GRANT SELECT ON people_safe TO anon, authenticated;

SELECT '✅ 017: people_safe view updated with tree_id column.' AS status;
