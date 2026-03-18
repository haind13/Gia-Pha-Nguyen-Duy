-- ╔══════════════════════════════════════════════════════════╗
-- ║  015: R2 Storage + Media table fixes                    ║
-- ║  Add Cloudflare R2 columns + fix FK relationships       ║
-- ╚══════════════════════════════════════════════════════════╝

-- Add R2 storage columns to media
ALTER TABLE media ADD COLUMN IF NOT EXISTS r2_key TEXT;
ALTER TABLE media ADD COLUMN IF NOT EXISTS r2_url TEXT;
ALTER TABLE media ADD COLUMN IF NOT EXISTS storage_provider TEXT DEFAULT 'onedrive';

-- Add FK from media.uploader_id to profiles.id for PostgREST joins
-- profiles.id = auth.users.id so this is safe
ALTER TABLE media ADD CONSTRAINT IF NOT EXISTS fk_media_uploader_profile
    FOREIGN KEY (uploader_id) REFERENCES profiles(id) ON DELETE SET NULL;

-- Index on R2 key for lookups
CREATE INDEX IF NOT EXISTS idx_media_r2_key ON media(r2_key);

-- Allow service role to bypass RLS for admin operations
CREATE POLICY IF NOT EXISTS "service_role_all_media" ON media
    FOR ALL USING (auth.jwt() ->> 'role' = 'service_role');

SELECT '✅ 015: R2 storage columns + FK fixes applied.' AS status;
