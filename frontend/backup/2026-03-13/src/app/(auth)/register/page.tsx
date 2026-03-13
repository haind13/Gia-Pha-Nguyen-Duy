'use client';

import { useState } from 'react';
import Link from 'next/link';
import { TreePine, Eye, EyeOff, LogIn, Mail, CheckCircle } from 'lucide-react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';

const registerSchema = z.object({
    email: z.string().email('Email không hợp lệ'),
    displayName: z.string().min(2, 'Tên tối thiểu 2 ký tự').max(100),
    password: z.string().min(8, 'Mật khẩu tối thiểu 8 ký tự'),
    confirmPassword: z.string(),
}).refine((data) => data.password === data.confirmPassword, {
    message: 'Mật khẩu xác nhận không khớp',
    path: ['confirmPassword'],
});

type RegisterForm = z.infer<typeof registerSchema>;

export default function RegisterPage() {
    const [showPassword, setShowPassword] = useState(false);
    const [error, setError] = useState('');
    const [emailSent, setEmailSent] = useState(false);
    const [registeredEmail, setRegisteredEmail] = useState('');
    const [loading, setLoading] = useState(false);

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
                }),
            });
            const result = await res.json();

            if (!res.ok) {
                setError(result.error || 'Đăng ký thất bại');
                return;
            }

            // Show email confirmation screen
            setRegisteredEmail(data.email);
            setEmailSent(true);
        } catch {
            setError('Đăng ký thất bại. Vui lòng thử lại.');
        } finally {
            setLoading(false);
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
                        <TreePine className="h-8 w-8 text-primary" />
                    </div>
                </div>
                <CardTitle className="text-2xl font-bold">Tham gia Gia phả họ Nguyễn Duy</CardTitle>
                <CardDescription>Đăng ký tài khoản để đóng góp thông tin dòng họ</CardDescription>
            </CardHeader>
            <CardContent>
                <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
                    {error && (
                        <div className="rounded-md bg-destructive/10 p-3 text-sm text-destructive">{error}</div>
                    )}

                    <div className="space-y-2">
                        <label className="text-sm font-medium" htmlFor="displayName">Tên hiển thị</label>
                        <Input id="displayName" placeholder="Nguyễn Văn A" {...register('displayName')} />
                        {errors.displayName && <p className="text-xs text-destructive">{errors.displayName.message}</p>}
                    </div>

                    <div className="space-y-2">
                        <label className="text-sm font-medium" htmlFor="email">Email</label>
                        <Input id="email" type="email" placeholder="email@example.com" {...register('email')} />
                        {errors.email && <p className="text-xs text-destructive">{errors.email.message}</p>}
                    </div>

                    <div className="space-y-2">
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
                        {errors.password && <p className="text-xs text-destructive">{errors.password.message}</p>}
                    </div>

                    <div className="space-y-2">
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

                    <div className="relative my-2">
                        <div className="absolute inset-0 flex items-center"><div className="w-full border-t" /></div>
                        <div className="relative flex justify-center text-xs uppercase"><span className="bg-card px-2 text-muted-foreground">hoặc</span></div>
                    </div>

                    <Link href="/login">
                        <Button type="button" variant="outline" className="w-full">
                            <LogIn className="h-4 w-4 mr-2" /> Đã có tài khoản? Đăng nhập
                        </Button>
                    </Link>
                </form>
            </CardContent>
        </Card>
    );
}
