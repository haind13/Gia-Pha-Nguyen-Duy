'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { TreePine, Eye, EyeOff, KeyRound, CheckCircle2, ArrowLeft } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { supabase } from '@/lib/supabase';

export default function ResetPasswordPage() {
    const router = useRouter();
    const [newPassword, setNewPassword] = useState('');
    const [confirmPassword, setConfirmPassword] = useState('');
    const [showNew, setShowNew] = useState(false);
    const [showConfirm, setShowConfirm] = useState(false);
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState('');
    const [success, setSuccess] = useState(false);
    const [sessionReady, setSessionReady] = useState(false);
    const [sessionError, setSessionError] = useState(false);

    // Listen for the PASSWORD_RECOVERY event from Supabase
    useEffect(() => {
        // Check if there's already a session (user clicked the reset link)
        supabase.auth.getSession().then(({ data: { session } }) => {
            if (session) {
                setSessionReady(true);
            }
        });

        const { data: { subscription } } = supabase.auth.onAuthStateChange((event, session) => {
            if (event === 'PASSWORD_RECOVERY') {
                setSessionReady(true);
            } else if (event === 'SIGNED_IN' && session) {
                setSessionReady(true);
            }
        });

        // If no session after 5 seconds, show error
        const timeout = setTimeout(() => {
            setSessionReady((ready) => {
                if (!ready) setSessionError(true);
                return ready;
            });
        }, 5000);

        return () => {
            subscription.unsubscribe();
            clearTimeout(timeout);
        };
    }, []);

    const handleReset = async () => {
        setError('');

        if (newPassword.length < 6) {
            setError('Mật khẩu mới phải có ít nhất 6 ký tự');
            return;
        }
        if (newPassword !== confirmPassword) {
            setError('Xác nhận mật khẩu không khớp');
            return;
        }

        setLoading(true);
        try {
            const { error: updateErr } = await supabase.auth.updateUser({
                password: newPassword,
            });
            if (updateErr) {
                setError(updateErr.message);
            } else {
                setSuccess(true);
                // Redirect to tree page after 3 seconds
                setTimeout(() => router.push('/tree'), 3000);
            }
        } catch {
            setError('Có lỗi xảy ra');
        } finally {
            setLoading(false);
        }
    };

    // Show loading while waiting for session
    if (!sessionReady && !sessionError) {
        return (
            <Card className="border-0 shadow-2xl">
                <CardContent className="py-12 text-center">
                    <div className="animate-pulse text-muted-foreground flex flex-col items-center gap-3">
                        <TreePine className="w-8 h-8 text-primary" />
                        <span className="text-sm">Đang xác thực...</span>
                    </div>
                </CardContent>
            </Card>
        );
    }

    // No valid session / token
    if (sessionError && !sessionReady) {
        return (
            <Card className="border-0 shadow-2xl">
                <CardHeader className="text-center space-y-2">
                    <div className="flex justify-center">
                        <div className="rounded-full bg-destructive/10 p-3">
                            <KeyRound className="h-8 w-8 text-destructive" />
                        </div>
                    </div>
                    <CardTitle className="text-xl">Link không hợp lệ</CardTitle>
                    <CardDescription>
                        Link đặt lại mật khẩu đã hết hạn hoặc không hợp lệ. Vui lòng yêu cầu link mới.
                    </CardDescription>
                </CardHeader>
                <CardContent className="space-y-3">
                    <Link href="/forgot-password">
                        <Button className="w-full">Yêu cầu link mới</Button>
                    </Link>
                    <Link href="/login">
                        <Button variant="outline" className="w-full">
                            <ArrowLeft className="mr-2 h-4 w-4" />
                            Quay lại đăng nhập
                        </Button>
                    </Link>
                </CardContent>
            </Card>
        );
    }

    // Success state
    if (success) {
        return (
            <Card className="border-0 shadow-2xl">
                <CardHeader className="text-center space-y-2">
                    <div className="flex justify-center">
                        <div className="rounded-full bg-green-500/10 p-3">
                            <CheckCircle2 className="h-8 w-8 text-green-600" />
                        </div>
                    </div>
                    <CardTitle className="text-xl">Đặt lại mật khẩu thành công!</CardTitle>
                    <CardDescription>
                        Mật khẩu đã được cập nhật. Bạn sẽ được chuyển hướng trong giây lát...
                    </CardDescription>
                </CardHeader>
                <CardContent>
                    <Link href="/tree">
                        <Button className="w-full">Đi đến Phả đồ</Button>
                    </Link>
                </CardContent>
            </Card>
        );
    }

    // Reset password form
    return (
        <Card className="border-0 shadow-2xl">
            <CardHeader className="text-center space-y-2">
                <div className="flex justify-center">
                    <div className="rounded-full bg-primary/10 p-3">
                        <KeyRound className="h-8 w-8 text-primary" />
                    </div>
                </div>
                <CardTitle className="text-2xl font-bold">Đặt lại mật khẩu</CardTitle>
                <CardDescription>Nhập mật khẩu mới cho tài khoản của bạn</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
                {error && (
                    <div className="rounded-md bg-destructive/10 p-3 text-sm text-destructive">{error}</div>
                )}

                {/* New password */}
                <div className="space-y-2">
                    <label className="text-sm font-medium" htmlFor="newPassword">Mật khẩu mới</label>
                    <div className="relative">
                        <Input
                            id="newPassword"
                            type={showNew ? 'text' : 'password'}
                            value={newPassword}
                            onChange={(e) => { setNewPassword(e.target.value); setError(''); }}
                            placeholder="Tối thiểu 6 ký tự..."
                        />
                        <button
                            type="button"
                            className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
                            onClick={() => setShowNew(!showNew)}
                        >
                            {showNew ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                        </button>
                    </div>
                </div>

                {/* Confirm password */}
                <div className="space-y-2">
                    <label className="text-sm font-medium" htmlFor="confirmPassword">Xác nhận mật khẩu</label>
                    <div className="relative">
                        <Input
                            id="confirmPassword"
                            type={showConfirm ? 'text' : 'password'}
                            value={confirmPassword}
                            onChange={(e) => { setConfirmPassword(e.target.value); setError(''); }}
                            placeholder="Nhập lại mật khẩu mới..."
                        />
                        <button
                            type="button"
                            className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
                            onClick={() => setShowConfirm(!showConfirm)}
                        >
                            {showConfirm ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                        </button>
                    </div>
                </div>

                <Button
                    onClick={handleReset}
                    disabled={loading || !newPassword || !confirmPassword}
                    className="w-full"
                >
                    {loading ? 'Đang cập nhật...' : 'Đặt lại mật khẩu'}
                </Button>

                <div className="text-center">
                    <Link href="/login" className="text-sm text-muted-foreground hover:text-primary transition-colors">
                        <ArrowLeft className="inline h-3 w-3 mr-1" />
                        Quay lại đăng nhập
                    </Link>
                </div>
            </CardContent>
        </Card>
    );
}
