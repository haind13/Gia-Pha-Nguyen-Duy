'use client';

import { useAuth } from '@/components/auth-provider';
import { Sidebar } from '@/components/layout/sidebar';
import { Header } from '@/components/layout/header';
import { PublicHeader } from '@/components/layout/public-header';

export function MainShell({ children }: { children: React.ReactNode }) {
    const { isLoggedIn } = useAuth();

    /* ── Authenticated: sidebar + header (current layout) ── */
    if (isLoggedIn) {
        return (
            <div className="flex h-screen overflow-hidden">
                <Sidebar />
                <div className="flex flex-1 min-w-0 flex-col h-full">
                    <Header />
                    <div className="flex-1 min-w-0 relative flex flex-col">
                        <div className="crane-border-top" />
                        <main className="flex-1 min-w-0 overflow-y-auto vintage-paper p-3 sm:p-4 lg:p-6">
                            {children}
                        </main>
                        <div className="crane-border-bottom" />
                    </div>
                </div>
            </div>
        );
    }

    /* ── Public: horizontal nav, no sidebar ── */
    return (
        <div className="flex flex-col h-screen overflow-hidden">
            <PublicHeader />
            <div className="flex-1 min-w-0 relative flex flex-col">
                <div className="crane-border-top" />
                <main className="flex-1 min-w-0 overflow-y-auto vintage-paper p-3 sm:p-4 lg:p-6">
                    {children}
                </main>
                <div className="crane-border-bottom" />
            </div>
        </div>
    );
}
