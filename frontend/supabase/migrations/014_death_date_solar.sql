-- Migration 014: Add death_date_solar column
-- Lưu ngày mất dương lịch (DD/MM) riêng biệt với ngày mất âm lịch (death_date)
-- Hiển thị: DD/MM/YYYY (tức DD/MM năm [Can Chi])

ALTER TABLE people ADD COLUMN IF NOT EXISTS death_date_solar TEXT;

-- Tương tự cho ngày sinh
ALTER TABLE people ADD COLUMN IF NOT EXISTS birth_date_solar TEXT;

COMMENT ON COLUMN people.death_date IS 'Ngày mất Âm lịch (DD/MM), VD: 8/4';
COMMENT ON COLUMN people.death_date_solar IS 'Ngày mất Dương lịch (DD/MM), VD: 8/5';
COMMENT ON COLUMN people.birth_date IS 'Ngày sinh (DD/MM hoặc DD/MM/YYYY)';
COMMENT ON COLUMN people.birth_date_solar IS 'Ngày sinh Dương lịch (DD/MM), dùng khi birth_date là âm lịch';
