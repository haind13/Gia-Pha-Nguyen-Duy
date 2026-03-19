'use client';

import { useAuth } from '@/components/auth-provider';
import { useTenant } from '@/components/tenant-provider';
import { AdminSidebar, MobileAdminSidebar } from '@/components/layout/admin-sidebar';
import { useRouter } from 'next/navigation';
import { useEffect } from 'react';
import { Loader2 } from 'lucide-react';

export default function AdminLayout({ children }: { children: React.ReactNode }) {
    const { isAdmin, isSuperAdmin, isLoggedIn, loading: authLoading, setCurrentTenantId } = useAuth();
    const { tenant, siteConfig, loading: tenantLoading } = useTenant();
    const router = useRouter();

    // Sync tenant ID to auth context
    useEffect(() => {
        if (tenant?.id) {
            setCurrentTenantId(tenant.id);
        }
    }, [tenant?.id, setCurrentTenantId]);

    useEffect(() => {
        if (!authLoading && (!isLoggedIn || !isAdmin)) {
            router.replace('/login');
        }
    }, [authLoading, isLoggedIn, isAdmin, router]);

    if (authLoading || tenantLoading) {
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

    const headerTitle = siteConfig?.site_name || tenant?.name || 'Quản trị Gia phả';

    return (
        <div className="flex h-screen overflow-hidden bg-slate-50">
            <AdminSidebar />
            <div className="flex flex-1 min-w-0 flex-col h-full">
                {/* Admin Header */}
                <header className="flex items-center justify-between px-4 py-3 border-b bg-white shadow-sm shrink-0">
                    <div className="flex items-center gap-3">
                        <MobileAdminSidebar />
                        <h1 className="text-sm font-semibold text-slate-700 hidden sm:block">{headerTitle}</h1>
                    </div>
                    <div className="flex items-center gap-2">
                        {tenant?.plan && tenant.plan !== 'free' && (
                            <span className="text-[10px] bg-amber-100 text-amber-700 px-2 py-0.5 rounded-full font-medium uppercase">
                                {tenant.plan}
                            </span>
                        )}
                        {isSuperAdmin && (
                            <span className="text-[10px] bg-red-100 text-red-700 px-2 py-0.5 rounded-full font-medium">
                                Superadmin
                            </span>
                        )}
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
