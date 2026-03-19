'use client';

import { useAuth } from '@/components/auth-provider';
import { AdminSidebar, MobileAdminSidebar } from '@/components/layout/admin-sidebar';
import { useRouter } from 'next/navigation';
import { useEffect } from 'react';
import { Loader2 } from 'lucide-react';

export default function AdminLayout({ children }: { children: React.ReactNode }) {
    const { isAdmin, isLoggedIn, loading: authLoading } = useAuth();
    const router = useRouter();

    useEffect(() => {
        if (!authLoading && (!isLoggedIn || !isAdmin)) {
            router.replace('/login');
        }
    }, [authLoading, isLoggedIn, isAdmin, router]);

    if (authLoading) {
        return (
            <div className="flex items-center justify-center h-screen bg-slate-50">
                <div className="flex flex-col items-center gap-3">
                    <Loader2 className="h-8 w-8 animate-spin text-amber-500" />
                    <span className="text-sm text-muted-foreground">Đang xác thực...</span>
                </div>
            </div>
        );
    }

    if (!isAdmin) return null;

    return (
        <div className="flex h-screen overflow-hidden bg-slate-50">
            <AdminSidebar />
            <div className="flex flex-1 min-w-0 flex-col h-full">
                {/* Admin Header */}
                <header className="flex items-center justify-between px-4 py-3 border-b bg-white shadow-sm shrink-0">
                    <div className="flex items-center gap-3">
                        <MobileAdminSidebar />
                        <h1 className="text-sm font-semibold text-slate-700 hidden sm:block">Quản trị Gia phả</h1>
                    </div>
                </header>
                {/* Content */}
                <main className="flex-1 min-h-0 min-w-0 overflow-y-auto p-4 lg:p-6">
                    {children}
                </main>
            </div>
        </div>
    );
}
