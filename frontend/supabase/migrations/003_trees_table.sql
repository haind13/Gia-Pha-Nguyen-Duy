-- ══════════════════════════════════════════════════════════════
-- Migration: Create `trees` table for multi-branch family trees
-- ══════════════════════════════════════════════════════════════

CREATE TABLE IF NOT EXISTS trees (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    name TEXT NOT NULL,
    description TEXT,
    slug TEXT UNIQUE NOT NULL,
    is_default BOOLEAN DEFAULT FALSE,
    root_person_handle TEXT,
    cover_color TEXT DEFAULT 'amber',
    member_count INTEGER DEFAULT 0,
    generation_count INTEGER DEFAULT 0,
    created_by UUID REFERENCES auth.users(id),
    created_at TIMESTAMPTZ DEFAULT now(),
    updated_at TIMESTAMPTZ DEFAULT now()
);

-- Enable RLS
ALTER TABLE trees ENABLE ROW LEVEL SECURITY;

-- Everyone can read trees
CREATE POLICY "trees_select" ON trees FOR SELECT USING (true);

-- Only admin/editor can insert
CREATE POLICY "trees_insert" ON trees FOR INSERT WITH CHECK (
    EXISTS (
        SELECT 1 FROM profiles
        WHERE profiles.id = auth.uid()
        AND profiles.role IN ('admin', 'editor')
    )
);

-- Only admin/editor can update
CREATE POLICY "trees_update" ON trees FOR UPDATE USING (
    EXISTS (
        SELECT 1 FROM profiles
        WHERE profiles.id = auth.uid()
        AND profiles.role IN ('admin', 'editor')
    )
);

-- Only admin can delete
CREATE POLICY "trees_delete" ON trees FOR DELETE USING (
    EXISTS (
        SELECT 1 FROM profiles
        WHERE profiles.id = auth.uid()
        AND profiles.role = 'admin'
    )
);

-- Insert default tree for existing data
INSERT INTO trees (name, description, slug, is_default, cover_color, generation_count)
VALUES (
    'Phả đồ chung',
    'Phả đồ tổng hợp toàn bộ dòng họ Nguyễn Duy — nhánh cụ Khoan Giản',
    'main',
    TRUE,
    'amber',
    16
)
ON CONFLICT (slug) DO NOTHING;
