'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import {
    LayoutDashboard, Building2, Users, FileText, ChevronLeft, ChevronRight,
    CreditCard, Menu, Shield, ArrowLeft, Settings2,
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { Button } from '@/components/ui/button';
import { useState } from 'react';
import { Sheet, SheetContent, SheetTitle } from '@/components/ui/sheet';

const superadminNavItems = [
    { href: '/superadmin', label: 'Dashboard', icon: LayoutDashboard, exact: true },
    { href: '/superadmin/tenants', label: 'Gia phả (Tenants)', icon: Building2 },
    { href: '/superadmin/users', label: 'Tất cả Users', icon: Users },
    { href: '/superadmin/plans', label: 'Gói dịch vụ', icon: CreditCard },
    { href: '/superadmin/logs', label: 'System Logs', icon: FileText },
];

function SuperadminNav({ collapsed = false, onNavigate }: { collapsed?: boolean; onNavigate?: () => void }) {
    const pathname = usePathname();

    return (
        <>
            {superadminNavItems.map(item => {
                const isActive = item.exact
                    ? pathname === item.href
                    : pathname.startsWith(item.href);
                return (
                    <Link key={item.href} href={item.href} onClick={onNavigate}>
                        <span className={cn(
                            'flex items-center gap-3 rounded-lg px-3 py-2.5 text-sm transition-colors',
                            isActive
                                ? 'bg-indigo-800 text-white'
                                : 'text-indigo-300 hover:bg-indigo-800/50 hover:text-indigo-100',
                        )}>
                            <item.icon className="h-4 w-4 shrink-0" />
                            {!collapsed && item.label}
                        </span>
                    </Link>
                );
            })}

            <div className={cn('border-t border-indigo-700 my-3', collapsed && 'mx-2')} />
            <Link href="/" onClick={onNavigate}>
                <span className="flex items-center gap-3 rounded-lg px-3 py-2.5 text-sm text-indigo-300 hover:bg-indigo-800/50 hover:text-indigo-100 transition-colors">
                    <ArrowLeft className="h-4 w-4 shrink-0" />
                    {!collapsed && 'Về trang chính'}
                </span>
            </Link>
        </>
    );
}

/* ── Desktop Superadmin Sidebar ── */
export function SuperadminSidebar() {
    const [collapsed, setCollapsed] = useState(false);

    return (
        <aside className={cn(
            'hidden md:flex flex-col bg-indigo-950 text-white transition-all duration-300 h-full',
            collapsed ? 'w-16' : 'w-60',
        )}>
            {/* Logo */}
            <div className="flex items-center gap-2 px-4 py-4 border-b border-indigo-800 shrink-0">
                <Shield className="h-5 w-5 text-indigo-400 shrink-0" />
                {!collapsed && (
                    <span className="font-bold text-sm leading-tight text-white">
                        Superadmin<br />
                        <span className="text-xs font-normal text-indigo-400">Gia Phả Đại Việt</span>
                    </span>
                )}
            </div>

            {/* Navigation */}
            <nav className="flex-1 min-h-0 px-2 py-4 space-y-1 overflow-y-auto">
                <SuperadminNav collapsed={collapsed} />
            </nav>

            {/* Collapse toggle */}
            <div className="border-t border-indigo-800 p-2 shrink-0">
                <Button
                    variant="ghost"
                    size="sm"
                    className="w-full text-indigo-400 hover:text-white hover:bg-indigo-800"
                    onClick={() => setCollapsed(!collapsed)}
                >
                    {collapsed ? <ChevronRight className="h-4 w-4" /> : <ChevronLeft className="h-4 w-4" />}
                    {!collapsed && <span className="ml-2">Thu gọn</span>}
                </Button>
            </div>
        </aside>
    );
}

/* ── Mobile Superadmin Sidebar ── */
export function MobileSuperadminSidebar() {
    const [open, setOpen] = useState(false);

    return (
        <>
            <Button
                variant="ghost"
                size="icon"
                className="md:hidden h-9 w-9"
                onClick={() => setOpen(true)}
                aria-label="Mở menu"
            >
                <Menu className="h-5 w-5" />
            </Button>

            <Sheet open={open} onOpenChange={setOpen}>
                <SheetContent side="left" className="w-60 p-0 bg-indigo-950 border-indigo-800" showCloseButton={false}>
                    <SheetTitle className="sr-only">Menu Superadmin</SheetTitle>
                    <div className="flex items-center gap-2 px-4 py-4 border-b border-indigo-800">
                        <Shield className="h-5 w-5 text-indigo-400 shrink-0" />
                        <span className="font-bold text-sm leading-tight text-white">
                            Superadmin<br />
                            <span className="text-xs font-normal text-indigo-400">Gia Phả Đại Việt</span>
                        </span>
                    </div>
                    <nav className="flex-1 px-2 py-4 space-y-1 overflow-y-auto">
                        <SuperadminNav onNavigate={() => setOpen(false)} />
                    </nav>
                </SheetContent>
            </Sheet>
        </>
    );
}
