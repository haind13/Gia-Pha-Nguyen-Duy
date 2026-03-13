-- ╔══════════════════════════════════════════════════════════╗
-- ║  005: Rename handle → id, chuẩn hóa FK naming          ║
-- ║  Đổi tên cột cho nhất quán: handle→id, _handle→_id     ║
-- ╚══════════════════════════════════════════════════════════╝

-- People: handle → id
ALTER TABLE people RENAME COLUMN handle TO id;

-- People: array columns
ALTER TABLE people RENAME COLUMN families TO family_ids;
ALTER TABLE people RENAME COLUMN parent_families TO parent_family_ids;

-- Families: handle → id, FK columns
ALTER TABLE families RENAME COLUMN handle TO id;
ALTER TABLE families RENAME COLUMN father_handle TO father_id;
ALTER TABLE families RENAME COLUMN mother_handle TO mother_id;
ALTER TABLE families RENAME COLUMN children TO child_ids;

-- Contributions: person_handle → person_id
ALTER TABLE contributions RENAME COLUMN person_handle TO person_id;

-- Comments: person_handle → person_id
ALTER TABLE comments RENAME COLUMN person_handle TO person_id;

-- Profiles: person_handle → person_id
ALTER TABLE profiles RENAME COLUMN person_handle TO person_id;

-- Trees: root_person_handle → root_person_id
ALTER TABLE trees RENAME COLUMN root_person_handle TO root_person_id;

-- Rename indexes to match new column names
ALTER INDEX IF EXISTS idx_families_father RENAME TO idx_families_father_id;
ALTER INDEX IF EXISTS idx_families_mother RENAME TO idx_families_mother_id;
ALTER INDEX IF EXISTS idx_contributions_person RENAME TO idx_contributions_person_id;
ALTER INDEX IF EXISTS idx_comments_person RENAME TO idx_comments_person_id;

SELECT '✅ 005: Column rename complete (handle→id, _handle→_id).' AS status;
