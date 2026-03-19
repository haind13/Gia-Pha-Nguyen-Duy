-- ============================================================
-- Migration 016: Multi-Tenant SaaS Support
-- Adds tenants, site_config, tenant_members tables
-- Backfills existing data as first tenant
-- ============================================================

-- ── 1. Tenants table ──
CREATE TABLE IF NOT EXISTS tenants (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    slug TEXT UNIQUE NOT NULL,                      -- 'nguyenduy', 'hotran'
    name TEXT NOT NULL,                             -- 'Gia phả họ Nguyễn Duy'
    description TEXT,                               -- Mô tả ngắn
    custom_domain TEXT UNIQUE,                      -- 'donghonguyenduy.asia' (nullable)
    tree_id UUID REFERENCES trees(id),              -- Liên kết với tree
    plan TEXT DEFAULT 'free'                        -- 'free', 'basic', 'standard', 'premium', 'enterprise'
        CHECK (plan IN ('free', 'basic', 'standard', 'premium', 'enterprise')),
    max_members INT DEFAULT 200,                    -- Giới hạn thành viên theo gói
    max_admins INT DEFAULT 1,                       -- Giới hạn số quản lý
    max_storage_gb INT DEFAULT 2,                   -- Giới hạn dung lượng (GB)
    is_active BOOLEAN DEFAULT true,
    expires_at TIMESTAMPTZ,                         -- Ngày hết hạn gói
    created_at TIMESTAMPTZ DEFAULT now(),
    updated_at TIMESTAMPTZ DEFAULT now()
);

-- ── 2. Site configuration per tenant ──
CREATE TABLE IF NOT EXISTS site_config (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id UUID REFERENCES tenants(id) ON DELETE CASCADE UNIQUE,
    site_name TEXT,                                 -- Tên hiển thị
    description TEXT,                               -- Mô tả ngắn
    introduction TEXT,                              -- Lời nói đầu
    logo_url TEXT,
    favicon_url TEXT,
    banner_url TEXT,
    google_map_url TEXT,
    facebook_url TEXT,
    youtube_url TEXT,
    zalo_url TEXT,
    theme_color TEXT DEFAULT '#d97706',             -- amber-600
    updated_at TIMESTAMPTZ DEFAULT now()
);

-- ── 3. Tenant members (replaces single profiles.role for multi-tenant) ──
CREATE TABLE IF NOT EXISTS tenant_members (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id UUID REFERENCES tenants(id) ON DELETE CASCADE,
    user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE,
    role TEXT NOT NULL DEFAULT 'viewer'
        CHECK (role IN ('admin', 'editor', 'viewer', 'member')),
    created_at TIMESTAMPTZ DEFAULT now(),
    UNIQUE(tenant_id, user_id)
);

-- ── 4. Add is_superadmin to profiles ──
ALTER TABLE profiles ADD COLUMN IF NOT EXISTS is_superadmin BOOLEAN DEFAULT false;

-- ── 5. Plan definitions (for reference / UI display) ──
CREATE TABLE IF NOT EXISTS plans (
    id TEXT PRIMARY KEY,                            -- 'free', 'basic', etc.
    name TEXT NOT NULL,                             -- 'Gói Cơ bản'
    price_yearly INT DEFAULT 0,                     -- VND/year (500000 = 500K)
    max_members INT DEFAULT 200,
    max_admins INT DEFAULT 1,
    max_storage_gb INT DEFAULT 2,
    features JSONB DEFAULT '[]'::jsonb,             -- Extra features list
    sort_order INT DEFAULT 0,
    is_active BOOLEAN DEFAULT true
);

-- Insert plan definitions matching giaphadaiviet.vn pricing
INSERT INTO plans (id, name, price_yearly, max_members, max_admins, max_storage_gb, sort_order) VALUES
    ('free',       'Miễn phí',    0,        50,    1,  1,  0),
    ('basic',      'Gói Cơ bản',  500000,   200,   1,  2,  1),
    ('standard',   'Gói Đoàn viên', 1000000, 500,   2,  3,  2),
    ('premium',    'Gói Đồng tâm', 2000000, 2000,  5,  10, 3),
    ('pro',        'Gói Thịnh vượng', 5000000, 10000, 10, 25, 4),
    ('enterprise', 'Gói Bản sắc', 10000000, -1,    15, 50, 5)  -- -1 = unlimited
ON CONFLICT (id) DO NOTHING;

-- ── 6. Backfill: Create first tenant from existing tree ──
DO $$
DECLARE
    _tree_id UUID;
    _tenant_id UUID;
BEGIN
    -- Get the first (default) tree
    SELECT id INTO _tree_id FROM trees WHERE is_default = true LIMIT 1;
    IF _tree_id IS NULL THEN
        SELECT id INTO _tree_id FROM trees LIMIT 1;
    END IF;

    IF _tree_id IS NOT NULL THEN
        -- Create tenant
        INSERT INTO tenants (slug, name, description, tree_id, custom_domain, plan, max_members, max_admins, max_storage_gb)
        VALUES (
            'nguyenduy',
            'Gia phả họ Nguyễn Duy (nhánh cụ Khoan Giản)',
            'Họ Nguyễn Duy - Làng Nghìn, An Bài, Quỳnh Phụ, Thái Bình',
            _tree_id,
            'donghonguyenduy-langnghin.asia',
            'enterprise',
            -1, 15, 50
        )
        ON CONFLICT (slug) DO NOTHING
        RETURNING id INTO _tenant_id;

        IF _tenant_id IS NOT NULL THEN
            -- Create site_config
            INSERT INTO site_config (tenant_id, site_name, description)
            VALUES (
                _tenant_id,
                'Gia phả họ Nguyễn Duy (nhánh cụ Khoan Giản)',
                'Họ Nguyễn Duy - Làng Nghìn, An Bài, Quỳnh Phụ, Thái Bình'
            );

            -- Migrate existing users as tenant members
            INSERT INTO tenant_members (tenant_id, user_id, role)
            SELECT _tenant_id, p.id, p.role
            FROM profiles p
            WHERE p.role IN ('admin', 'editor', 'viewer', 'member')
            ON CONFLICT (tenant_id, user_id) DO NOTHING;

            -- Set existing admins as superadmin
            UPDATE profiles SET is_superadmin = true WHERE role = 'admin';
        END IF;
    END IF;
END $$;

-- ── 7. RLS Policies ──

-- Enable RLS
ALTER TABLE tenants ENABLE ROW LEVEL SECURITY;
ALTER TABLE site_config ENABLE ROW LEVEL SECURITY;
ALTER TABLE tenant_members ENABLE ROW LEVEL SECURITY;
ALTER TABLE plans ENABLE ROW LEVEL SECURITY;

-- Plans: everyone can read
CREATE POLICY "plans_read" ON plans FOR SELECT USING (true);

-- Tenants: active tenants are public, superadmin can do anything
CREATE POLICY "tenants_read_active" ON tenants FOR SELECT USING (is_active = true);
CREATE POLICY "tenants_superadmin_all" ON tenants FOR ALL USING (
    EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND is_superadmin = true)
);

-- Site config: public read, tenant admin can update
CREATE POLICY "site_config_read" ON site_config FOR SELECT USING (true);
CREATE POLICY "site_config_admin_update" ON site_config FOR UPDATE USING (
    EXISTS (
        SELECT 1 FROM tenant_members tm
        WHERE tm.tenant_id = site_config.tenant_id
        AND tm.user_id = auth.uid()
        AND tm.role = 'admin'
    )
    OR EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND is_superadmin = true)
);
CREATE POLICY "site_config_superadmin_insert" ON site_config FOR INSERT WITH CHECK (
    EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND is_superadmin = true)
);

-- Tenant members: members of same tenant can read, admin can manage
CREATE POLICY "tenant_members_read" ON tenant_members FOR SELECT USING (
    tenant_id IN (
        SELECT tm.tenant_id FROM tenant_members tm WHERE tm.user_id = auth.uid()
    )
    OR EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND is_superadmin = true)
);
CREATE POLICY "tenant_members_admin_manage" ON tenant_members FOR ALL USING (
    EXISTS (
        SELECT 1 FROM tenant_members tm
        WHERE tm.tenant_id = tenant_members.tenant_id
        AND tm.user_id = auth.uid()
        AND tm.role = 'admin'
    )
    OR EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND is_superadmin = true)
);

-- ── 8. Indexes ──
CREATE INDEX IF NOT EXISTS idx_tenants_slug ON tenants(slug);
CREATE INDEX IF NOT EXISTS idx_tenants_custom_domain ON tenants(custom_domain) WHERE custom_domain IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_tenants_tree_id ON tenants(tree_id);
CREATE INDEX IF NOT EXISTS idx_site_config_tenant ON site_config(tenant_id);
CREATE INDEX IF NOT EXISTS idx_tenant_members_tenant ON tenant_members(tenant_id);
CREATE INDEX IF NOT EXISTS idx_tenant_members_user ON tenant_members(user_id);
CREATE INDEX IF NOT EXISTS idx_profiles_superadmin ON profiles(is_superadmin) WHERE is_superadmin = true;

-- ── 9. Updated_at trigger for tenants ──
CREATE OR REPLACE FUNCTION update_updated_at()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = now();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER tenants_updated_at BEFORE UPDATE ON tenants
    FOR EACH ROW EXECUTE FUNCTION update_updated_at();

CREATE TRIGGER site_config_updated_at BEFORE UPDATE ON site_config
    FOR EACH ROW EXECUTE FUNCTION update_updated_at();
