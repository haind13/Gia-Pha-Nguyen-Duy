-- ╔══════════════════════════════════════════════════════════╗
-- ║  008: Posts + Post Comments (tách khỏi person comments) ║
-- ║  Bảng tin dòng họ + bình luận bài viết                  ║
-- ╚══════════════════════════════════════════════════════════╝

CREATE TABLE IF NOT EXISTS posts (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    author_id UUID REFERENCES auth.users(id) ON DELETE SET NULL,
    title TEXT,
    body TEXT NOT NULL,
    type TEXT NOT NULL DEFAULT 'general'
        CHECK (type IN ('general', 'announcement', 'memorial')),
    is_pinned BOOLEAN DEFAULT false,
    status TEXT NOT NULL DEFAULT 'published'
        CHECK (status IN ('draft', 'published', 'archived')),
    tree_id UUID REFERENCES trees(id),
    created_at TIMESTAMPTZ DEFAULT now(),
    updated_at TIMESTAMPTZ DEFAULT now()
);

CREATE TABLE IF NOT EXISTS post_comments (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    post_id UUID NOT NULL REFERENCES posts(id) ON DELETE CASCADE,
    author_id UUID REFERENCES auth.users(id) ON DELETE SET NULL,
    body TEXT NOT NULL,
    parent_id UUID REFERENCES post_comments(id) ON DELETE CASCADE,
    created_at TIMESTAMPTZ DEFAULT now()
);

-- Indexes
CREATE INDEX IF NOT EXISTS idx_posts_status ON posts(status);
CREATE INDEX IF NOT EXISTS idx_posts_tree_id ON posts(tree_id);
CREATE INDEX IF NOT EXISTS idx_posts_author_id ON posts(author_id);
CREATE INDEX IF NOT EXISTS idx_post_comments_post_id ON post_comments(post_id);

-- Auto-update updated_at
DROP TRIGGER IF EXISTS posts_updated_at ON posts;
CREATE TRIGGER posts_updated_at BEFORE UPDATE ON posts
    FOR EACH ROW EXECUTE FUNCTION update_updated_at();

-- ╔══════════════════════════════════════════════════════════╗
-- ║  ROW LEVEL SECURITY                                      ║
-- ╚══════════════════════════════════════════════════════════╝

ALTER TABLE posts ENABLE ROW LEVEL SECURITY;
ALTER TABLE post_comments ENABLE ROW LEVEL SECURITY;

-- Posts
CREATE POLICY "anyone can read published posts" ON posts
    FOR SELECT USING (status = 'published');
CREATE POLICY "authenticated can insert posts" ON posts
    FOR INSERT WITH CHECK (auth.role() = 'authenticated');
CREATE POLICY "author or admin can update posts" ON posts
    FOR UPDATE USING (
        author_id = auth.uid() OR
        EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND role = 'admin')
    );
CREATE POLICY "author or admin can delete posts" ON posts
    FOR DELETE USING (
        author_id = auth.uid() OR
        EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND role = 'admin')
    );

-- Post comments
CREATE POLICY "anyone can read post_comments" ON post_comments
    FOR SELECT USING (true);
CREATE POLICY "authenticated can insert post_comments" ON post_comments
    FOR INSERT WITH CHECK (auth.role() = 'authenticated');
CREATE POLICY "author or admin can delete post_comments" ON post_comments
    FOR DELETE USING (
        author_id = auth.uid() OR
        EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND role = 'admin')
    );

SELECT '✅ 008: Posts + post_comments created.' AS status;
