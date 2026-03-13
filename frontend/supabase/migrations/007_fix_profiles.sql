-- ╔══════════════════════════════════════════════════════════╗
-- ║  007: Fix profiles — expanded roles, status, tree_id    ║
-- ╚══════════════════════════════════════════════════════════╝

-- Mở rộng role CHECK (thêm editor, archivist, guest)
ALTER TABLE profiles DROP CONSTRAINT IF EXISTS profiles_role_check;
ALTER TABLE profiles ADD CONSTRAINT profiles_role_check
    CHECK (role IN ('admin', 'editor', 'archivist', 'member', 'viewer', 'guest'));

-- Thêm status (frontend đã dùng active/suspended)
ALTER TABLE profiles ADD COLUMN IF NOT EXISTS status TEXT DEFAULT 'active'
    CHECK (status IN ('active', 'suspended', 'pending'));

-- Thêm default_tree_id cho multi-tree
ALTER TABLE profiles ADD COLUMN IF NOT EXISTS default_tree_id UUID REFERENCES trees(id);

-- Backfill default_tree_id
UPDATE profiles SET default_tree_id = (SELECT id FROM trees WHERE slug = 'main' LIMIT 1)
WHERE default_tree_id IS NULL;

SELECT '✅ 007: Profiles updated (roles, status, default_tree_id).' AS status;
