-- 015: Add Cloudflare R2 storage columns to media table
-- Backward compatible: existing OneDrive photos keep working

ALTER TABLE media ADD COLUMN IF NOT EXISTS r2_key TEXT;
ALTER TABLE media ADD COLUMN IF NOT EXISTS r2_url TEXT;
ALTER TABLE media ADD COLUMN IF NOT EXISTS storage_provider TEXT DEFAULT 'onedrive'
    CHECK (storage_provider IN ('onedrive', 'r2'));

CREATE INDEX IF NOT EXISTS idx_media_r2_key ON media(r2_key);

-- Set storage_provider for existing records
UPDATE media SET storage_provider = 'onedrive' WHERE storage_provider IS NULL;
