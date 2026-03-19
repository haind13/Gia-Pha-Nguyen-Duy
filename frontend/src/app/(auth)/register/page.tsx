'use client';

import { useState } from 'react';
import Link from 'next/link';
import { Scroll, Eye, EyeOff, LogIn, Mail, CheckCircle } from 'lucide-react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { useAuth } from '@/components/auth-provider';

const passwordSchema = z.string()
    .min(8, 'Mật khẩu tối thiểu 8 ký tự')
    .regex(/[A-Z]/, 'Cần ít nhất 1 chữ viết hoa')
    .regex(/[a-z]/, 'Cần ít nhất 1 chữ viết thường')
    .regex(/[0-9]/, 'Cần ít nhất 1 chữ số')
    .regex(/[^A-Za-z0-9]/, 'Cần ít nhất 1 ký tự đặc biệt (!@#$...)');

const registerSchema = z.object({
    email: z.string().email('Email không hợp lệ'),
    displayName: z.string().min(2, 'Tên tối thiểu 2 ký tự').max(100),
    username: z.string()
        .min(3, 'Username tối thiểu 3 ký tự')
        .max(30, 'Username tối đa 30 ký tự')
        .regex(/^[a-zA-Z0-9_.-]+$/, 'Chỉ chấp nhận chữ, số, dấu chấm, gạch ngang và gạch dưới'),
    password: passwordSchema,
    confirmPassword: z.string(),
}).refine((data) => data.password === data.confirmPassword, {
    message: 'Mật khẩu xác nhận không khớp',
    path: ['confirmPassword'],
});

type RegisterForm = z.infer<typeof registerSchema>;

function GoogleIcon({ className }: { className?: string }) {
    return (
        <svg className={className} viewBox="0 0 24 24">
            <path d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92a5.06 5.06 0 0 1-2.2 3.32v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.1z" fill="#4285F4" />
            <path d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" fill="#34A853" />
            <path d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z" fill="#FBBC05" />
            <path d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" fill="#EA4335" />
        </svg>
    );
}

export default function RegisterPage() {
    const { signInWithGoogle } = useAuth();
    const [showPassword, setShowPassword] = useState(false);
    const [error, setError] = useState('');
    const [emailSent, setEmailSent] = useState(false);
    const [registeredEmail, setRegisteredEmail] = useState('');
    const [loading, setLoading] = useState(false);
    const [googleLoading, setGoogleLoading] = useState(false);

    const {
        register,
        handleSubmit,
        formState: { errors },
    } = useForm<RegisterForm>({ resolver: zodResolver(registerSchema) });

    const onSubmit = async (data: RegisterForm) => {
        try {
            setError('');
            setLoading(true);

            const res = await fetch('/api/register', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    email: data.email,
                    password: data.password,
                    displayName: data.displayName,
                    username: data.username,
                }),
            });
            const result = await res.json();

            if (!res.ok) {
                setError(result.error || 'Đăng ký thất bại');
                return;
            }

            setRegisteredEmail(data.email);
            setEmailSent(true);
        } catch {
            setError('Đăng ký thất bại. Vui lòng thử lại.');
        } finally {
            setLoading(false);
        }
    };

    const handleGoogleSignIn = async () => {
        setError('');
        setGoogleLoading(true);
        try {
            const result = await signInWithGoogle();
            if (result.error) setError(result.error);
        } finally {
            setGoogleLoading(false);
        }
    };

    // Email confirmation success screen
    if (emailSent) {
        return (
            <Card className="border-0 shadow-2xl">
                <CardHeader className="text-center space-y-4">
                    <div className="flex justify-center">
                        <div className="rounded-full bg-green-100 dark:bg-green-950/30 p-4">
                            <Mail className="h-10 w-10 text-green-600 dark:text-green-400" />
                        </div>
                    </div>
                    <CardTitle className="text-2xl font-bold">Kiểm tra email của bạn</CardTitle>
                    <CardDescription className="text-base">
                        Chúng tôi đã gửi email xác nhận đến
                    </CardDescription>
                </CardHeader>
                <CardContent className="space-y-6">
                    <div className="text-center">
                        <p className="font-semibold text-lg text-primary">{registeredEmail}</p>
                    </div>

                    <div className="rounded-lg bg-amber-50 dark:bg-amber-950/20 border border-amber-200 dark:border-amber-800 p-4 space-y-3">
                        <div className="flex items-start gap-3">
                            <CheckCircle className="h-5 w-5 text-amber-600 mt-0.5 shrink-0" />
                            <div className="text-sm text-amber-800 dark:text-amber-200 space-y-1">
                                <p className="font-medium">Hướng dẫn xác nhận:</p>
                                <ol className="list-decimal list-inside space-y-1 text-amber-700 dark:text-amber-300">
                                    <li>Mở hộp thư email <strong>{registeredEmail}</strong></li>
                                    <li>Tìm email từ <strong>Gia Phả Họ Nguyễn Duy</strong></li>
                                    <li>Nhấn vào nút <strong>&quot;Xác nhận tài khoản&quot;</strong> trong email</li>
                                    <li>Quay lại đây để đăng nhập</li>
                                </ol>
                            </div>
                        </div>
                    </div>

                    <p className="text-xs text-muted-foreground text-center">
                        Không nhận được email? Kiểm tra thư mục Spam/Junk hoặc chờ vài phút.
                    </p>

                    <Link href="/login">
                        <Button className="w-full" size="lg">
                            <LogIn className="h-4 w-4 mr-2" />
                            Đi đến trang Đăng nhập
                        </Button>
                    </Link>
                </CardContent>
            </Card>
        );
    }

    return (
        <Card className="border-0 shadow-2xl">
            <CardHeader className="text-center space-y-2">
                <div className="flex justify-center">
                    <div className="rounded-full bg-primary/10 p-3">
                        <Scroll className="h-8 w-8 text-primary" />
                    </div>
                </div>
                <CardTitle className="text-2xl font-bold">Tham gia Gia phả họ Nguyễn Duy</CardTitle>
                <CardDescription>Đăng ký tài khoản để đóng góp thông tin dòng họ</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
                {error && (
                    <div className="rounded-md bg-destructive/10 p-3 text-sm text-destructive">{error}</div>
                )}

                {/* Google Sign-up */}
                <Button
                    type="button"
                    variant="outline"
                    className="w-full h-11 gap-3 text-sm font-medium border-slate-300 hover:bg-slate-50 dark:border-slate-600 dark:hover:bg-slate-800"
                    onClick={handleGoogleSignIn}
                    disabled={googleLoading}
                >
                    {googleLoading ? (
                        <div className="w-5 h-5 border-2 border-slate-300 border-t-primary rounded-full animate-spin" />
                    ) : (
                        <GoogleIcon className="w-5 h-5" />
                    )}
                    Đăng ký với Google
                </Button>

                {/* Divider */}
                <div className="relative">
                    <div className="absolute inset-0 flex items-center"><div className="w-full border-t" /></div>
                    <div className="relative flex justify-center text-xs uppercase">
                        <span className="bg-card px-3 text-muted-foreground">hoặc đăng ký bằng email</span>
                    </div>
                </div>

                {/* Email/Password form */}
                <form onSubmit={handleSubmit(onSubmit)} className="space-y-3">
                    <div className="space-y-1.5">
                        <label className="text-sm font-medium" htmlFor="displayName">Tên hiển thị</label>
                        <Input id="displayName" placeholder="Nguyễn Văn A" {...register('displayName')} />
                        {errors.displayName && <p className="text-xs text-destructive">{errors.displayName.message}</p>}
                    </div>

                    <div className="space-y-1.5">
                        <label className="text-sm font-medium" htmlFor="username">Username</label>
                        <Input id="username" placeholder="nguyenvana" {...register('username')} />
                        {errors.username ? (
                            <p className="text-xs text-destructive">{errors.username.message}</p>
                        ) : (
                            <p className="text-[10px] text-muted-foreground">Dùng để đăng nhập, chỉ gồm chữ, số, dấu chấm, gạch ngang</p>
                        )}
                    </div>

                    <div className="space-y-1.5">
                        <label className="text-sm font-medium" htmlFor="email">Email</label>
                        <Input id="email" type="email" placeholder="email@example.com" {...register('email')} />
                        {errors.email && <p className="text-xs text-destructive">{errors.email.message}</p>}
                    </div>

                    <div className="space-y-1.5">
                        <label className="text-sm font-medium" htmlFor="password">Mật khẩu</label>
                        <div className="relative">
                            <Input
                                id="password"
                                type={showPassword ? 'text' : 'password'}
                                placeholder="Tối thiểu 8 ký tự"
                                {...register('password')}
                            />
                            <button
                                type="button"
                                className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
                                onClick={() => setShowPassword(!showPassword)}
                            >
                                {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                            </button>
                        </div>
                        {errors.password ? (
                            <p className="text-xs text-destructive">{errors.password.message}</p>
                        ) : (
                            <p className="text-[10px] text-muted-foreground">Chữ hoa, chữ thường, số và ký tự đặc biệt (!@#$...)</p>
                        )}
                    </div>

                    <div className="space-y-1.5">
                        <label className="text-sm font-medium" htmlFor="confirmPassword">Xác nhận mật khẩu</label>
                        <Input
                            id="confirmPassword"
                            type="password"
                            placeholder="Nhập lại mật khẩu"
                            {...register('confirmPassword')}
                        />
                        {errors.confirmPassword && <p className="text-xs text-destructive">{errors.confirmPassword.message}</p>}
                    </div>

                    <Button type="submit" className="w-full" disabled={loading}>
                        {loading ? 'Đang đăng ký...' : 'Đăng ký'}
                    </Button>
                </form>

                {/* Login link */}
                <p className="text-center text-sm text-muted-foreground">
                    Đã có tài khoản?{' '}
                    <Link href="/login" className="font-semibold text-primary hover:underline">
                        Đăng nhập
                    </Link>
                </p>
            </CardContent>
        </Card>
    );
}
