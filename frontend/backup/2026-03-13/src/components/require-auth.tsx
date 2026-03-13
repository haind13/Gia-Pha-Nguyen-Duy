'use client';

import { useAuth } from '@/components/auth-provider';
import Link from 'next/link';
import { Lock, LogIn, UserPlus } from 'lucide-react';
import { Button } from '@/components/ui/button';

export function RequireAuth({ children }: { children: React.ReactNode }) {
    const { isLoggedIn, loading } = useAuth();

    if (loading) {
        return (
            <div className="flex items-center justify-center h-[60vh]">
                <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary" />
            </div>
        );
    }

    if (!isLoggedIn) {
        return (
            <div className="flex flex-col items-center justify-center h-[60vh] space-y-6">
                <div className="rounded-full bg-amber-50 dark:bg-amber-950/30 p-5">
                    <Lock className="h-10 w-10 text-amber-600 dark:text-amber-400" />
                </div>
                <div className="text-center space-y-2">
                    <h2 className="text-2xl font-bold">Yêu cầu đăng nhập</h2>
                    <p className="text-muted-foreground max-w-md">
                        Bạn cần đăng nhập để truy cập tính năng này.<br />
                        Vui lòng đăng nhập hoặc đăng ký tài khoản thành viên.
                    </p>
                </div>
                <div className="flex gap-3">
                    <Link href="/login">
                        <Button size="lg">
                            <LogIn className="h-4 w-4 mr-2" />
                            Đăng nhập
                        </Button>
                    </Link>
                    <Link href="/register">
                        <Button variant="outline" size="lg">
                            <UserPlus className="h-4 w-4 mr-2" />
                            Đăng ký
                        </Button>
                    </Link>
                </div>
            </div>
        );
    }

    return <>{children}</>;
}
