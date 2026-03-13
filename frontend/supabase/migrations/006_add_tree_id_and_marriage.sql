-- ╔══════════════════════════════════════════════════════════╗
-- ║  006: Add tree_id to core tables + marriage columns     ║
-- ║  Scope data theo cây + thông tin hôn nhân               ║
-- ╚══════════════════════════════════════════════════════════╝

-- Add tree_id to core tables
ALTER TABLE people ADD COLUMN IF NOT EXISTS tree_id UUID REFERENCES trees(id);
ALTER TABLE families ADD COLUMN IF NOT EXISTS tree_id UUID REFERENCES trees(id);
ALTER TABLE contributions ADD COLUMN IF NOT EXISTS tree_id UUID REFERENCES trees(id);
ALTER TABLE comments ADD COLUMN IF NOT EXISTS tree_id UUID REFERENCES trees(id);

-- Backfill: gán tất cả data hiện tại vào cây mặc định
DO $$
DECLARE default_tree_id UUID;
BEGIN
    SELECT id INTO default_tree_id FROM trees WHERE slug = 'main' LIMIT 1;
    IF default_tree_id IS NOT NULL THEN
        UPDATE people SET tree_id = default_tree_id WHERE tree_id IS NULL;
        UPDATE families SET tree_id = default_tree_id WHERE tree_id IS NULL;
        UPDATE contributions SET tree_id = default_tree_id WHERE tree_id IS NULL;
        UPDATE comments SET tree_id = default_tree_id WHERE tree_id IS NULL;
    END IF;
END $$;

-- Set NOT NULL cho bảng chính (people + families bắt buộc thuộc cây)
ALTER TABLE people ALTER COLUMN tree_id SET NOT NULL;
ALTER TABLE families ALTER COLUMN tree_id SET NOT NULL;

-- Indexes cho tree_id
CREATE INDEX IF NOT EXISTS idx_people_tree_id ON people(tree_id);
CREATE INDEX IF NOT EXISTS idx_families_tree_id ON families(tree_id);
CREATE INDEX IF NOT EXISTS idx_contributions_tree_id ON contributions(tree_id);
CREATE INDEX IF NOT EXISTS idx_comments_tree_id ON comments(tree_id);

-- ╔══════════════════════════════════════════════════════════╗
-- ║  Marriage columns cho families                          ║
-- ╚══════════════════════════════════════════════════════════╝

ALTER TABLE families ADD COLUMN IF NOT EXISTS marriage_date TEXT;
ALTER TABLE families ADD COLUMN IF NOT EXISTS marriage_place TEXT;
ALTER TABLE families ADD COLUMN IF NOT EXISTS marriage_order INT DEFAULT 1;
ALTER TABLE families ADD COLUMN IF NOT EXISTS marriage_status TEXT DEFAULT 'married'
    CHECK (marriage_status IN ('married', 'divorced', 'widowed', 'separated'));

SELECT '✅ 006: tree_id + marriage columns added.' AS status;
