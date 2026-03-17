-- ╔══════════════════════════════════════════════════════════╗
-- ║  012: Photo Gallery — Albums, Tags, Comments, Likes   ║
-- ║  Thư viện ảnh kiểu Facebook + OneDrive integration    ║
-- ╚══════════════════════════════════════════════════════════╝

-- Albums (mỗi album = 1 folder trên OneDrive)
CREATE TABLE IF NOT EXISTS albums (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    title TEXT NOT NULL,
    description TEXT DEFAULT '',
    cover_photo_id UUID,                   -- references media.id (set later)
    onedrive_folder_id TEXT UNIQUE,        -- OneDrive item ID của folder
    created_by UUID REFERENCES auth.users(id) ON DELETE SET NULL,
    created_at TIMESTAMPTZ DEFAULT now(),
    updated_at TIMESTAMPTZ DEFAULT now()
);

-- Extend media table for OneDrive integration
ALTER TABLE media ADD COLUMN IF NOT EXISTS album_id UUID REFERENCES albums(id) ON DELETE SET NULL;
ALTER TABLE media ADD COLUMN IF NOT EXISTS onedrive_item_id TEXT UNIQUE;
ALTER TABLE media ADD COLUMN IF NOT EXISTS onedrive_url TEXT;
ALTER TABLE media ADD COLUMN IF NOT EXISTS thumbnail_url TEXT;
ALTER TABLE media ADD COLUMN IF NOT EXISTS width INT;
ALTER TABLE media ADD COLUMN IF NOT EXISTS height INT;

-- Person tags on photos (liên kết ảnh với người trong gia phả)
CREATE TABLE IF NOT EXISTS photo_tags (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    media_id UUID NOT NULL REFERENCES media(id) ON DELETE CASCADE,
    person_id TEXT NOT NULL,               -- people.id trong bảng people
    tagged_by UUID REFERENCES auth.users(id) ON DELETE SET NULL,
    created_at TIMESTAMPTZ DEFAULT now(),
    UNIQUE(media_id, person_id)
);

-- Photo comments
CREATE TABLE IF NOT EXISTS photo_comments (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    media_id UUID NOT NULL REFERENCES media(id) ON DELETE CASCADE,
    user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    content TEXT NOT NULL,
    created_at TIMESTAMPTZ DEFAULT now()
);

-- Photo likes/reactions
CREATE TABLE IF NOT EXISTS photo_likes (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    media_id UUID NOT NULL REFERENCES media(id) ON DELETE CASCADE,
    user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    reaction TEXT DEFAULT 'like'
        CHECK (reaction IN ('like', 'love', 'haha', 'sad', 'angry')),
    created_at TIMESTAMPTZ DEFAULT now(),
    UNIQUE(media_id, user_id)
);

-- Back-reference: albums.cover_photo_id → media.id
ALTER TABLE albums ADD CONSTRAINT IF NOT EXISTS fk_album_cover
    FOREIGN KEY (cover_photo_id) REFERENCES media(id) ON DELETE SET NULL;

-- ╔══════════════════════════════════════════════════════════╗
-- ║  INDEXES                                                ║
-- ╚══════════════════════════════════════════════════════════╝

CREATE INDEX IF NOT EXISTS idx_media_album_id ON media(album_id);
CREATE INDEX IF NOT EXISTS idx_media_onedrive_item ON media(onedrive_item_id);
CREATE INDEX IF NOT EXISTS idx_photo_tags_media ON photo_tags(media_id);
CREATE INDEX IF NOT EXISTS idx_photo_tags_person ON photo_tags(person_id);
CREATE INDEX IF NOT EXISTS idx_photo_comments_media ON photo_comments(media_id);
CREATE INDEX IF NOT EXISTS idx_photo_likes_media ON photo_likes(media_id);

-- ╔══════════════════════════════════════════════════════════╗
-- ║  ROW LEVEL SECURITY                                      ║
-- ╚══════════════════════════════════════════════════════════╝

ALTER TABLE albums ENABLE ROW LEVEL SECURITY;
ALTER TABLE photo_tags ENABLE ROW LEVEL SECURITY;
ALTER TABLE photo_comments ENABLE ROW LEVEL SECURITY;
ALTER TABLE photo_likes ENABLE ROW LEVEL SECURITY;

-- Albums: anyone can read, authenticated can manage
CREATE POLICY "anyone_read_albums" ON albums FOR SELECT USING (true);
CREATE POLICY "admin_manage_albums" ON albums FOR INSERT
    WITH CHECK (EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND role IN ('admin', 'editor')));
CREATE POLICY "admin_update_albums" ON albums FOR UPDATE
    USING (EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND role IN ('admin', 'editor')));
CREATE POLICY "admin_delete_albums" ON albums FOR DELETE
    USING (EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND role = 'admin'));

-- Photo tags: anyone read, authenticated manage
CREATE POLICY "anyone_read_tags" ON photo_tags FOR SELECT USING (true);
CREATE POLICY "auth_insert_tags" ON photo_tags FOR INSERT
    WITH CHECK (auth.role() = 'authenticated');
CREATE POLICY "auth_delete_tags" ON photo_tags FOR DELETE
    USING (auth.uid() = tagged_by OR EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND role = 'admin'));

-- Comments: anyone read, user manages own
CREATE POLICY "anyone_read_comments" ON photo_comments FOR SELECT USING (true);
CREATE POLICY "auth_insert_comments" ON photo_comments FOR INSERT
    WITH CHECK (auth.uid() = user_id);
CREATE POLICY "owner_delete_comments" ON photo_comments FOR DELETE
    USING (auth.uid() = user_id OR EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND role = 'admin'));

-- Likes: anyone read, user manages own
CREATE POLICY "anyone_read_likes" ON photo_likes FOR SELECT USING (true);
CREATE POLICY "auth_manage_likes" ON photo_likes FOR INSERT
    WITH CHECK (auth.uid() = user_id);
CREATE POLICY "auth_delete_likes" ON photo_likes FOR DELETE
    USING (auth.uid() = user_id);

SELECT '✅ 012: Photo gallery tables created.' AS status;
