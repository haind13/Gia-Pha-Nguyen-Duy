-- ╔══════════════════════════════════════════════════════════╗
-- ║  009: Events + RSVPs                                    ║
-- ║  Sự kiện dòng họ (giỗ, họp họ, lễ hội) + phản hồi     ║
-- ╚══════════════════════════════════════════════════════════╝

CREATE TABLE IF NOT EXISTS events (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    title TEXT NOT NULL,
    description TEXT,
    type TEXT NOT NULL DEFAULT 'OTHER'
        CHECK (type IN ('MEMORIAL', 'MEETING', 'FESTIVAL', 'OTHER')),
    start_at TIMESTAMPTZ NOT NULL,
    end_at TIMESTAMPTZ,
    location TEXT,
    person_id TEXT,                      -- Liên kết với người (cho giỗ)
    tree_id UUID REFERENCES trees(id),
    created_by UUID REFERENCES auth.users(id) ON DELETE SET NULL,
    created_at TIMESTAMPTZ DEFAULT now(),
    updated_at TIMESTAMPTZ DEFAULT now()
);

CREATE TABLE IF NOT EXISTS event_rsvps (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    event_id UUID NOT NULL REFERENCES events(id) ON DELETE CASCADE,
    user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    status TEXT NOT NULL DEFAULT 'GOING'
        CHECK (status IN ('GOING', 'MAYBE', 'NOT_GOING')),
    created_at TIMESTAMPTZ DEFAULT now(),
    UNIQUE (event_id, user_id)
);

-- Indexes
CREATE INDEX IF NOT EXISTS idx_events_tree_id ON events(tree_id);
CREATE INDEX IF NOT EXISTS idx_events_start_at ON events(start_at);
CREATE INDEX IF NOT EXISTS idx_events_person_id ON events(person_id);
CREATE INDEX IF NOT EXISTS idx_event_rsvps_event_id ON event_rsvps(event_id);

-- Auto-update updated_at
DROP TRIGGER IF EXISTS events_updated_at ON events;
CREATE TRIGGER events_updated_at BEFORE UPDATE ON events
    FOR EACH ROW EXECUTE FUNCTION update_updated_at();

-- ╔══════════════════════════════════════════════════════════╗
-- ║  ROW LEVEL SECURITY                                      ║
-- ╚══════════════════════════════════════════════════════════╝

ALTER TABLE events ENABLE ROW LEVEL SECURITY;
ALTER TABLE event_rsvps ENABLE ROW LEVEL SECURITY;

-- Events
CREATE POLICY "anyone can read events" ON events
    FOR SELECT USING (true);
CREATE POLICY "authenticated can insert events" ON events
    FOR INSERT WITH CHECK (auth.role() = 'authenticated');
CREATE POLICY "creator or admin can update events" ON events
    FOR UPDATE USING (
        created_by = auth.uid() OR
        EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND role = 'admin')
    );
CREATE POLICY "admin can delete events" ON events
    FOR DELETE USING (
        EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND role = 'admin')
    );

-- RSVPs
CREATE POLICY "anyone can read rsvps" ON event_rsvps
    FOR SELECT USING (true);
CREATE POLICY "authenticated can insert own rsvp" ON event_rsvps
    FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "user can update own rsvp" ON event_rsvps
    FOR UPDATE USING (auth.uid() = user_id);

SELECT '✅ 009: Events + RSVPs created.' AS status;
