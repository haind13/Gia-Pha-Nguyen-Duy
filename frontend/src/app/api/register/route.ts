import { NextRequest, NextResponse } from 'next/server';
import { createServiceClient } from '@/lib/supabase';

export async function POST(req: NextRequest) {
    try {
        const { email, password, displayName } = await req.json();

        if (!email || !password) {
            return NextResponse.json({ error: 'Email và mật khẩu là bắt buộc' }, { status: 400 });
        }

        const admin = createServiceClient();

        // Step 1: Sign up via normal auth (creates user, may require email confirm)
        const { data: signUpData, error: signUpErr } = await admin.auth.signUp({
            email,
            password,
            options: {
                data: { display_name: displayName || email.split('@')[0] },
            },
        });

        if (signUpErr) {
            if (signUpErr.message.includes('already registered') || signUpErr.message.includes('already exists')) {
                return NextResponse.json({ error: 'Email đã được đăng ký. Vui lòng đăng nhập.' }, { status: 409 });
            }
            return NextResponse.json({ error: signUpErr.message }, { status: 400 });
        }

        const userId = signUpData.user?.id;
        if (!userId) {
            return NextResponse.json({ error: 'Không thể tạo tài khoản' }, { status: 500 });
        }

        // Step 2: Auto-confirm email via admin API
        const { error: confirmErr } = await admin.auth.admin.updateUserById(userId, {
            email_confirm: true,
        });

        if (confirmErr) {
            console.error('Email confirm error:', confirmErr.message);
        }

        // Step 3: Upsert profile with admin role (using service role bypasses RLS)
        const { error: profileErr } = await admin.from('profiles').upsert({
            id: userId,
            email,
            display_name: displayName || email.split('@')[0],
            role: 'admin',
        });

        if (profileErr) {
            console.error('Profile upsert error:', profileErr.message);
            return NextResponse.json({ error: 'Tạo profile thất bại: ' + profileErr.message }, { status: 500 });
        }

        return NextResponse.json({ success: true, userId });
    } catch (err) {
        return NextResponse.json({ error: 'Lỗi server: ' + (err instanceof Error ? err.message : 'unknown') }, { status: 500 });
    }
}
