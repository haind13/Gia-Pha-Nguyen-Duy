import { NextRequest, NextResponse } from 'next/server';
import { createServiceClient } from '@/lib/supabase';

export async function POST(req: NextRequest) {
    try {
        const { email, password, displayName } = await req.json();

        if (!email || !password) {
            return NextResponse.json({ error: 'Email và mật khẩu là bắt buộc' }, { status: 400 });
        }

        const admin = createServiceClient();

        // Step 1: Sign up — Supabase sends confirmation email automatically
        const { data: signUpData, error: signUpErr } = await admin.auth.signUp({
            email,
            password,
            options: {
                data: { display_name: displayName || email.split('@')[0] },
                emailRedirectTo: `${process.env.NEXT_PUBLIC_SITE_URL || 'https://gia-pha-nguyen-duy.vercel.app'}/login?confirmed=true`,
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

        // Step 2: Create profile (user must confirm email before they can log in)
        const { error: profileErr } = await admin.from('profiles').upsert({
            id: userId,
            email,
            display_name: displayName || email.split('@')[0],
            role: 'viewer',
        });

        if (profileErr) {
            console.error('Profile upsert error:', profileErr.message);
            return NextResponse.json({ error: 'Tạo profile thất bại: ' + profileErr.message }, { status: 500 });
        }

        return NextResponse.json({ success: true, userId, requireEmailConfirm: true });
    } catch (err) {
        return NextResponse.json({ error: 'Lỗi server: ' + (err instanceof Error ? err.message : 'unknown') }, { status: 500 });
    }
}
