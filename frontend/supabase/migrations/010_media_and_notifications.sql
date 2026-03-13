-- ╔══════════════════════════════════════════════════════════╗
-- ║  010: Media library + User notifications                ║
-- ║  Thư viện ảnh/tài liệu + Thông báo cho user            ║
-- ╚══════════════════════════════════════════════════════════╝

-- Media library
CREATE TABLE IF NOT EXISTS media (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    file_name TEXT NOT NULL,
    mime_type TEXT,
    file_size BIGINT,
    title TEXT,
    description TEXT,
    storage_path TEXT,                   -- Supabase Storage path
    state TEXT NOT NULL DEFAULT 'PENDING'
        CHECK (state IN ('PENDING', 'PUBLISHED', 'REJECTED')),
    person_id TEXT,                      -- Liên kết với người (tùy chọn)
    tree_id UUID REFERENCES trees(id),
    uploader_id UUID REFERENCES auth.users(id) ON DELETE SET NULL,
    created_at TIMESTAMPTZ DEFAULT now()
);

-- Notifications (user-facing)
CREATE TABLE IF NOT EXISTS notifications (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    type TEXT NOT NULL DEFAULT 'SYSTEM'
        CHECK (type IN ('NEW_POST', 'NEW_COMMENT', 'EVENT_REMINDER', 'RSVP_UPDATE', 'SYSTEM')),
    title TEXT NOT NULL,
    message TEXT NOT NULL,
    link_url TEXT,
    is_read BOOLEAN DEFAULT false,
    created_at TIMESTAMPTZ DEFAULT now()
);

-- Indexes
CREATE INDEX IF NOT EXISTS idx_media_state ON media(state);
CREATE INDEX IF NOT EXISTS idx_media_person_id ON media(person_id);
CREATE INDEX IF NOT EXISTS idx_media_tree_id ON media(tree_id);
CREATE INDEX IF NOT EXISTS idx_notifications_user_id ON notifications(user_id);
CREATE INDEX IF NOT EXISTS idx_notifications_unread ON notifications(user_id, is_read)
    WHERE NOT is_read;

-- ╔══════════════════════════════════════════════════════════╗
-- ║  ROW LEVEL SECURITY                                      ║
-- ╚══════════════════════════════════════════════════════════╝

ALTER TABLE media ENABLE ROW LEVEL SECURITY;
ALTER TABLE notifications ENABLE ROW LEVEL SECURITY;

-- Media
CREATE POLICY "anyone can read published media" ON media
    FOR SELECT USING (state = 'PUBLISHED');
CREATE POLICY "admin can read all media" ON media
    FOR SELECT USING (
        EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND role = 'admin')
    );
CREATE POLICY "authenticated can upload media" ON media
    FOR INSERT WITH CHECK (auth.role() = 'authenticated');
CREATE POLICY "admin can update media" ON media
    FOR UPDATE USING (
        EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND role = 'admin')
    );

-- Notifications
CREATE POLICY "users read own notifications" ON notifications
    FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "users update own notifications" ON notifications
    FOR UPDATE USING (auth.uid() = user_id);
CREATE POLICY "system can insert notifications" ON notifications
    FOR INSERT WITH CHECK (true);

SELECT '✅ 010: Media + notifications created.' AS status;
