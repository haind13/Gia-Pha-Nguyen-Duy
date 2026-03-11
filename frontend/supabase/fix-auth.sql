-- ============================================================
-- 🔧 Fix Auth: Sửa lỗi đăng ký "Database error saving new user"
-- ============================================================
-- Chạy file này trong: Supabase Dashboard → SQL Editor
-- ============================================================

-- 1. Cập nhật CHECK constraint cho profiles.role: thêm 'member'
ALTER TABLE profiles DROP CONSTRAINT IF EXISTS profiles_role_check;
ALTER TABLE profiles ADD CONSTRAINT profiles_role_check
    CHECK (role IN ('admin', 'viewer', 'member'));

-- 2. Fix trigger handle_new_user:
--    - ON CONFLICT (id) thay vì (email) để tránh lỗi update PK
--    - Thêm exception handling để không block user creation
--    - Lấy display_name từ user metadata
CREATE OR REPLACE FUNCTION handle_new_user()
RETURNS TRIGGER AS $$
DECLARE
    user_email TEXT;
    user_display_name TEXT;
BEGIN
    user_email := COALESCE(NEW.email, NEW.raw_user_meta_data->>'email', '');
    user_display_name := COALESCE(NEW.raw_user_meta_data->>'display_name', split_part(user_email, '@', 1));
    IF user_email != '' THEN
        INSERT INTO profiles (id, email, display_name, role)
        VALUES (
            NEW.id,
            user_email,
            user_display_name,
            'viewer'
        )
        ON CONFLICT (id) DO UPDATE SET
            email = EXCLUDED.email,
            display_name = COALESCE(EXCLUDED.display_name, profiles.display_name)
        ;
    END IF;
    RETURN NEW;
EXCEPTION WHEN OTHERS THEN
    -- Don't block user creation if profile insert fails
    RAISE WARNING 'handle_new_user failed: %', SQLERRM;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- 3. Đảm bảo trigger đúng
DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
CREATE TRIGGER on_auth_user_created
    AFTER INSERT ON auth.users
    FOR EACH ROW EXECUTE FUNCTION handle_new_user();

-- 4. Fix: cho phép user insert profile của mình (nếu trigger fail)
-- Drop and recreate policy to avoid error
DROP POLICY IF EXISTS "users can insert own profile" ON profiles;
CREATE POLICY "users can insert own profile" ON profiles
    FOR INSERT WITH CHECK (auth.uid() = id);

SELECT '✅ Auth fix complete! Registration should work now.' AS status;
