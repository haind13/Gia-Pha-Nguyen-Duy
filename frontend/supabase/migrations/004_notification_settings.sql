-- ╔══════════════════════════════════════════════════════════╗
-- ║  004: Notification Channels & Reminder Settings         ║
-- ║  Cấu hình gửi nhắc sự kiện qua Zalo/Telegram           ║
-- ╚══════════════════════════════════════════════════════════╝

-- Kênh thông báo (Zalo, Telegram, etc.)
CREATE TABLE IF NOT EXISTS notification_channels (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    name TEXT NOT NULL,                    -- "Nhóm Zalo dòng họ", "Telegram Bot"
    platform TEXT NOT NULL CHECK (platform IN ('zalo', 'telegram')),
    webhook_url TEXT NOT NULL,             -- Webhook URL / Bot API URL
    is_active BOOLEAN DEFAULT true,
    created_by UUID REFERENCES auth.users(id) ON DELETE SET NULL,
    created_at TIMESTAMPTZ DEFAULT now(),
    updated_at TIMESTAMPTZ DEFAULT now()
);

-- Cài đặt nhắc nhở cho từng kênh
CREATE TABLE IF NOT EXISTS reminder_settings (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    channel_id UUID NOT NULL REFERENCES notification_channels(id) ON DELETE CASCADE,
    event_type TEXT NOT NULL CHECK (event_type IN ('memorial', 'birthday', 'all')),
    days_before INT NOT NULL DEFAULT 1,    -- Nhắc trước bao nhiêu ngày
    reminder_time TEXT DEFAULT '08:00',    -- Giờ gửi nhắc (HH:MM)
    is_active BOOLEAN DEFAULT true,
    created_at TIMESTAMPTZ DEFAULT now()
);

-- Auto-update updated_at
CREATE OR REPLACE FUNCTION update_notification_channels_updated_at()
RETURNS TRIGGER AS $$ BEGIN NEW.updated_at = now(); RETURN NEW; END; $$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trigger_notification_channels_updated ON notification_channels;
CREATE TRIGGER trigger_notification_channels_updated
    BEFORE UPDATE ON notification_channels
    FOR EACH ROW EXECUTE FUNCTION update_notification_channels_updated_at();

-- ╔══════════════════════════════════════════════════════════╗
-- ║  ROW LEVEL SECURITY                                      ║
-- ╚══════════════════════════════════════════════════════════╝

ALTER TABLE notification_channels ENABLE ROW LEVEL SECURITY;
ALTER TABLE reminder_settings ENABLE ROW LEVEL SECURITY;

-- Admin can do everything
CREATE POLICY "admin can read notification_channels" ON notification_channels
    FOR SELECT USING (EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND role = 'admin'));
CREATE POLICY "admin can insert notification_channels" ON notification_channels
    FOR INSERT WITH CHECK (EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND role = 'admin'));
CREATE POLICY "admin can update notification_channels" ON notification_channels
    FOR UPDATE USING (EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND role = 'admin'));
CREATE POLICY "admin can delete notification_channels" ON notification_channels
    FOR DELETE USING (EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND role = 'admin'));

CREATE POLICY "admin can read reminder_settings" ON reminder_settings
    FOR SELECT USING (EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND role = 'admin'));
CREATE POLICY "admin can insert reminder_settings" ON reminder_settings
    FOR INSERT WITH CHECK (EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND role = 'admin'));
CREATE POLICY "admin can update reminder_settings" ON reminder_settings
    FOR UPDATE USING (EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND role = 'admin'));
CREATE POLICY "admin can delete reminder_settings" ON reminder_settings
    FOR DELETE USING (EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND role = 'admin'));

SELECT '✅ Notification channels & reminder settings tables created.' AS status;
