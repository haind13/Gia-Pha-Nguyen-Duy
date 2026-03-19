'use client';

import { useAuth } from '@/components/auth-provider';
import { SuperadminSidebar, MobileSuperadminSidebar } from '@/components/layout/superadmin-sidebar';
import { useRouter } from 'next/navigation';
import { useEffect } from 'react';
import { Loader2 } from 'lucide-react';

export default function SuperadminLayout({ children }: { children: React.ReactNode }) {
    const { isSuperAdmin, isLoggedIn, loading: authLoading } = useAuth();
    const router = useRouter();

    useEffect(() => {
        if (!authLoading && (!isLoggedIn || !isSuperAdmin)) {
            router.replace('/login');
        }
    }, [authLoading, isLoggedIn, isSuperAdmin, router]);

    if (authLoading) {
        return (
            <div className="flex items-center justify-center h-screen bg-indigo-50">
                <div className="flex flex-col items-center gap-3">
                    <Loader2 className="h-8 w-8 animate-spin text-indigo-500" />
                    <span className="text-sm text-muted-foreground">Đang xác thực Superadmin...</span>
                </div>
            </div>
        );
    }

    if (!isSuperAdmin) return null;

    return (
        <div className="flex h-screen overflow-hidden bg-slate-50">
            <SuperadminSidebar />
            <div className="flex flex-1 min-w-0 flex-col h-full">
                {/* Header */}
                <header className="flex items-center justify-between px-4 py-3 border-b bg-white shadow-sm shrink-0">
                    <div className="flex items-center gap-3">
                        <MobileSuperadminSidebar />
                        <h1 className="text-sm font-semibold text-slate-700 hidden sm:block">
                            Superadmin — Gia Phả Đại Việt
                        </h1>
                    </div>
                    <span className="text-[10px] bg-red-100 text-red-700 px-2 py-0.5 rounded-full font-medium">
                        SUPERADMIN
                    </span>
                </header>
                {/* Content */}
                <main className="flex-1 min-h-0 min-w-0 overflow-y-auto p-4 lg:p-6">
                    {children}
                </main>
            </div>
        </div>
    );
}
