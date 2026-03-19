'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import {
    LayoutDashboard, Shield, ClipboardCheck, Bell, FileText, Database,
    BarChart3, ChevronLeft, ChevronRight, Settings, ArrowLeft, Menu,
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { Button } from '@/components/ui/button';
import { useState } from 'react';
import { Sheet, SheetContent, SheetTitle } from '@/components/ui/sheet';

const adminNavItems = [
    { href: '/admin', label: 'Dashboard', icon: LayoutDashboard, exact: true },
    { href: '/admin/users', label: 'Quản lý Users', icon: Shield },
    { href: '/admin/edits', label: 'Kiểm duyệt', icon: ClipboardCheck },
    { href: '/admin/notifications', label: 'Nhắc sự kiện', icon: Bell },
    { href: '/admin/audit', label: 'Audit Log', icon: FileText },
    { href: '/admin/backup', label: 'Backup', icon: Database },
    { href: '/admin/thong-ke', label: 'Thống kê', icon: BarChart3 },
];

function AdminNav({ collapsed = false, onNavigate }: { collapsed?: boolean; onNavigate?: () => void }) {
    const pathname = usePathname();

    return (
        <>
            {adminNavItems.map(item => {
                const isActive = item.exact
                    ? pathname === item.href
                    : pathname.startsWith(item.href);
                return (
                    <Link key={item.href} href={item.href} onClick={onNavigate}>
                        <span className={cn(
                            'flex items-center gap-3 rounded-lg px-3 py-2.5 text-sm transition-colors',
                            isActive
                                ? 'bg-slate-800 text-white'
                                : 'text-slate-400 hover:bg-slate-800/50 hover:text-slate-200',
                        )}>
                            <item.icon className="h-4 w-4 shrink-0" />
                            {!collapsed && item.label}
                        </span>
                    </Link>
                );
            })}

            {/* Separator + Back to main */}
            <div className={cn('border-t border-slate-700 my-3', collapsed && 'mx-2')} />
            <Link href="/" onClick={onNavigate}>
                <span className="flex items-center gap-3 rounded-lg px-3 py-2.5 text-sm text-slate-400 hover:bg-slate-800/50 hover:text-slate-200 transition-colors">
                    <ArrowLeft className="h-4 w-4 shrink-0" />
                    {!collapsed && 'Về trang chính'}
                </span>
            </Link>
        </>
    );
}

/* ── Desktop Admin Sidebar ── */
export function AdminSidebar() {
    const [collapsed, setCollapsed] = useState(false);

    return (
        <aside className={cn(
            'hidden md:flex flex-col bg-slate-900 text-white transition-all duration-300 h-full',
            collapsed ? 'w-16' : 'w-60',
        )}>
            {/* Logo */}
            <div className="flex items-center gap-2 px-4 py-4 border-b border-slate-700 shrink-0">
                <Settings className="h-5 w-5 text-amber-400 shrink-0" />
                {!collapsed && (
                    <span className="font-bold text-sm leading-tight text-white">
                        Quản trị<br />
                        <span className="text-xs font-normal text-slate-400">Gia phả Nguyễn Duy</span>
                    </span>
                )}
            </div>

            {/* Navigation */}
            <nav className="flex-1 min-h-0 px-2 py-4 space-y-1 overflow-y-auto">
                <AdminNav collapsed={collapsed} />
            </nav>

            {/* Collapse toggle */}
            <div className="border-t border-slate-700 p-2 shrink-0">
                <Button
                    variant="ghost"
                    size="sm"
                    className="w-full text-slate-400 hover:text-white hover:bg-slate-800"
                    onClick={() => setCollapsed(!collapsed)}
                >
                    {collapsed ? <ChevronRight className="h-4 w-4" /> : <ChevronLeft className="h-4 w-4" />}
                    {!collapsed && <span className="ml-2">Thu gọn</span>}
                </Button>
            </div>
        </aside>
    );
}

/* ── Mobile Admin Sidebar ── */
export function MobileAdminSidebar() {
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
                <SheetContent side="left" className="w-60 p-0 bg-slate-900 border-slate-700" showCloseButton={false}>
                    <SheetTitle className="sr-only">Menu quản trị</SheetTitle>
                    <div className="flex items-center gap-2 px-4 py-4 border-b border-slate-700">
                        <Settings className="h-5 w-5 text-amber-400 shrink-0" />
                        <span className="font-bold text-sm leading-tight text-white">
                            Quản trị<br />
                            <span className="text-xs font-normal text-slate-400">Gia phả Nguyễn Duy</span>
                        </span>
                    </div>
                    <nav className="flex-1 px-2 py-4 space-y-1 overflow-y-auto">
                        <AdminNav onNavigate={() => setOpen(false)} />
                    </nav>
                </SheetContent>
            </Sheet>
        </>
    );
}
