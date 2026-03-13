-- ╔══════════════════════════════════════════════════════════╗
-- ║  011: Audit logs + Invite links + Book sections         ║
-- ║  Lịch sử thao tác + Link mời + Sách gia phả            ║
-- ╚══════════════════════════════════════════════════════════╝

-- Audit logs
CREATE TABLE IF NOT EXISTS audit_logs (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    actor_id UUID REFERENCES auth.users(id) ON DELETE SET NULL,
    action TEXT NOT NULL CHECK (action IN ('CREATE', 'UPDATE', 'DELETE')),
    entity_type TEXT NOT NULL,           -- 'person', 'family', 'post', etc.
    entity_id TEXT,                      -- person id hoặc UUID tùy entity
    metadata JSONB DEFAULT '{}',         -- Chi tiết thay đổi (old/new values)
    created_at TIMESTAMPTZ DEFAULT now()
);

-- Invite links
CREATE TABLE IF NOT EXISTS invite_links (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    code TEXT UNIQUE NOT NULL,
    role TEXT NOT NULL DEFAULT 'member'
        CHECK (role IN ('admin', 'editor', 'archivist', 'member', 'viewer', 'guest')),
    max_uses INT NOT NULL DEFAULT 1,
    used_count INT NOT NULL DEFAULT 0,
    tree_id UUID REFERENCES trees(id),   -- Mời vào cây cụ thể
    created_by UUID REFERENCES auth.users(id) ON DELETE SET NULL,
    expires_at TIMESTAMPTZ,
    created_at TIMESTAMPTZ DEFAULT now()
);

-- Book sections (sách gia phả)
CREATE TABLE IF NOT EXISTS book_sections (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    section_key TEXT NOT NULL,           -- 'introduction', 'history', etc.
    title TEXT NOT NULL,
    content TEXT,                         -- HTML content (Rich Text Editor)
    sort_order INT DEFAULT 0,
    is_visible BOOLEAN DEFAULT true,
    tree_id UUID REFERENCES trees(id),
    updated_by UUID REFERENCES auth.users(id) ON DELETE SET NULL,
    created_at TIMESTAMPTZ DEFAULT now(),
    updated_at TIMESTAMPTZ DEFAULT now()
);

-- Indexes
CREATE INDEX IF NOT EXISTS idx_audit_logs_actor_id ON audit_logs(actor_id);
CREATE INDEX IF NOT EXISTS idx_audit_logs_entity ON audit_logs(entity_type, entity_id);
CREATE INDEX IF NOT EXISTS idx_audit_logs_created_at ON audit_logs(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_invite_links_code ON invite_links(code);
CREATE INDEX IF NOT EXISTS idx_invite_links_tree_id ON invite_links(tree_id);
CREATE INDEX IF NOT EXISTS idx_book_sections_tree_id ON book_sections(tree_id);

-- Auto-update updated_at cho book_sections
DROP TRIGGER IF EXISTS book_sections_updated_at ON book_sections;
CREATE TRIGGER book_sections_updated_at BEFORE UPDATE ON book_sections
    FOR EACH ROW EXECUTE FUNCTION update_updated_at();

-- ╔══════════════════════════════════════════════════════════╗
-- ║  ROW LEVEL SECURITY                                      ║
-- ╚══════════════════════════════════════════════════════════╝

ALTER TABLE audit_logs ENABLE ROW LEVEL SECURITY;
ALTER TABLE invite_links ENABLE ROW LEVEL SECURITY;
ALTER TABLE book_sections ENABLE ROW LEVEL SECURITY;

-- Audit logs
CREATE POLICY "admin can read audit_logs" ON audit_logs
    FOR SELECT USING (
        EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND role = 'admin')
    );
CREATE POLICY "system can insert audit_logs" ON audit_logs
    FOR INSERT WITH CHECK (true);

-- Invite links
CREATE POLICY "admin can manage invite_links" ON invite_links
    FOR ALL USING (
        EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND role = 'admin')
    );
CREATE POLICY "anyone can read invite by code" ON invite_links
    FOR SELECT USING (true);

-- Book sections
CREATE POLICY "anyone can read visible book_sections" ON book_sections
    FOR SELECT USING (is_visible = true);
CREATE POLICY "admin or editor can manage book_sections" ON book_sections
    FOR ALL USING (
        EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND role IN ('admin', 'editor'))
    );

SELECT '✅ 011: Audit logs + invite links + book sections created.' AS status;
