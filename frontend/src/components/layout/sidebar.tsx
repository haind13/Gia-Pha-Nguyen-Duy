'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import {
    Home,
    TreePine,
    Users,
    Image,
    Shield,
    FileText,
    Database,
    ChevronLeft,
    ChevronRight,
    BookOpen,
    ClipboardCheck,
    Contact,
    Newspaper,
    CalendarDays,
    MessageCircle,
    LogIn,
    UserPlus,
    Menu,
    Bell,
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { Button } from '@/components/ui/button';
import { useState } from 'react';
import { useAuth } from '@/components/auth-provider';
import {
    Sheet,
    SheetContent,
    SheetTitle,
} from '@/components/ui/sheet';

/* Public navigation — always visible */
const publicNavItems = [
    { href: '/', label: 'Trang chủ', icon: Home },
    { href: '/pha-do', label: 'Phả đồ', icon: TreePine },
    { href: '/media', label: 'Thư viện', icon: Image },
];

/* Auth-required navigation — only when logged in */
const authNavItems = [
    { href: '/feed', label: 'Bảng tin', icon: Newspaper },
    { href: '/directory', label: 'Danh bạ', icon: Contact },
    { href: '/events', label: 'Sự kiện', icon: CalendarDays },
    { href: '/book', label: 'Sách gia phả', icon: BookOpen },
    { href: '/kinship', label: 'Xưng hô', icon: MessageCircle },
    { href: '/people', label: 'Thành viên', icon: Users },
];

const adminItems = [
    { href: '/admin/users', label: 'Quản lý Users', icon: Shield },
    { href: '/admin/edits', label: 'Kiểm duyệt', icon: ClipboardCheck },
    { href: '/admin/notifications', label: 'Nhắc sự kiện', icon: Bell },
    { href: '/admin/audit', label: 'Audit Log', icon: FileText },
    { href: '/admin/backup', label: 'Backup', icon: Database },
];

/* ── Shared navigation content (used in both desktop sidebar and mobile drawer) ── */
function SidebarNav({ collapsed = false, onNavigate }: { collapsed?: boolean; onNavigate?: () => void }) {
    const pathname = usePathname();
    const { isAdmin, isLoggedIn } = useAuth();

    const renderNavItem = (item: { href: string; label: string; icon: React.ElementType }) => {
        const isActive = pathname === item.href || (item.href !== '/' && pathname.startsWith(item.href));
        return (
            <Link key={item.href} href={item.href} onClick={onNavigate}>
                <span
                    className={cn(
                        'flex items-center gap-3 rounded-lg px-3 py-2.5 text-sm transition-colors',
                        isActive
                            ? 'bg-primary text-primary-foreground'
                            : 'text-muted-foreground hover:bg-accent hover:text-accent-foreground',
                    )}
                >
                    <item.icon className="h-4 w-4 shrink-0" />
                    {!collapsed && item.label}
                </span>
            </Link>
        );
    };

    return (
        <>
            {/* Public items — always visible */}
            {publicNavItems.map(renderNavItem)}

            {/* Auth-required items — only when logged in */}
            {isLoggedIn && (
                <>
                    {!collapsed && (
                        <div className="pt-3 pb-1">
                            <span className="px-3 text-xs font-semibold uppercase text-muted-foreground tracking-wider">
                                Tính năng
                            </span>
                        </div>
                    )}
                    {collapsed && <div className="border-t my-2" />}
                    {authNavItems.map(renderNavItem)}
                </>
            )}

            {/* Login prompt — when NOT logged in */}
            {!isLoggedIn && (
                <>
                    {collapsed ? (
                        <div className="border-t my-2" />
                    ) : (
                        <div className="pt-4 pb-2">
                            <span className="px-3 text-xs font-semibold uppercase text-muted-foreground tracking-wider">
                                Tài khoản
                            </span>
                        </div>
                    )}
                    <Link href="/login" onClick={onNavigate}>
                        <span className="flex items-center gap-3 rounded-lg px-3 py-2.5 text-sm transition-colors text-muted-foreground hover:bg-accent hover:text-accent-foreground">
                            <LogIn className="h-4 w-4 shrink-0" />
                            {!collapsed && 'Đăng nhập'}
                        </span>
                    </Link>
                    <Link href="/register" onClick={onNavigate}>
                        <span className="flex items-center gap-3 rounded-lg px-3 py-2.5 text-sm transition-colors text-muted-foreground hover:bg-accent hover:text-accent-foreground">
                            <UserPlus className="h-4 w-4 shrink-0" />
                            {!collapsed && 'Đăng ký'}
                        </span>
                    </Link>
                </>
            )}

            {/* Admin section — only visible for admin users */}
            {isAdmin && (
                <>
                    {!collapsed && (
                        <div className="pt-4 pb-2">
                            <span className="px-3 text-xs font-semibold uppercase text-muted-foreground tracking-wider">
                                Quản trị
                            </span>
                        </div>
                    )}
                    {collapsed && <div className="border-t my-2" />}
                    {adminItems.map((item) => {
                        const isActive = pathname.startsWith(item.href);
                        return (
                            <Link key={item.href} href={item.href} onClick={onNavigate}>
                                <span
                                    className={cn(
                                        'flex items-center gap-3 rounded-lg px-3 py-2.5 text-sm transition-colors',
                                        isActive
                                            ? 'bg-primary text-primary-foreground'
                                            : 'text-muted-foreground hover:bg-accent hover:text-accent-foreground',
                                    )}
                                >
                                    <item.icon className="h-4 w-4 shrink-0" />
                                    {!collapsed && item.label}
                                </span>
                            </Link>
                        );
                    })}
                </>
            )}
        </>
    );
}

/* ── Desktop Sidebar (hidden on mobile) ── */
export function Sidebar() {
    const [collapsed, setCollapsed] = useState(false);

    return (
        <aside
            className={cn(
                'hidden md:flex flex-col border-r bg-card transition-all duration-300 h-full',
                collapsed ? 'w-16' : 'w-64',
            )}
        >
            {/* Logo */}
            <div className="flex items-center gap-2 px-4 py-4 border-b shrink-0">
                <TreePine className="h-6 w-6 text-primary shrink-0" />
                {!collapsed && <span className="font-bold text-sm leading-tight">Họ Nguyễn Duy<br /><span className="text-xs font-normal text-muted-foreground">(nhánh cụ Khoan Giản) - Làng Nghìn, An Bài, Quỳnh Phụ, Thái Bình</span></span>}
            </div>

            {/* Navigation — scrollable */}
            <nav className="flex-1 min-h-0 px-2 py-4 space-y-1 overflow-y-auto">
                <SidebarNav collapsed={collapsed} />
            </nav>

            {/* Collapse toggle — always fixed at bottom */}
            <div className="border-t p-2 shrink-0">
                <Button variant="ghost" size="sm" className="w-full" onClick={() => setCollapsed(!collapsed)}>
                    {collapsed ? <ChevronRight className="h-4 w-4" /> : <ChevronLeft className="h-4 w-4" />}
                    {!collapsed && <span className="ml-2">Thu gọn</span>}
                </Button>
            </div>
        </aside>
    );
}

/* ── Mobile Sidebar Drawer (visible only on mobile) ── */
export function MobileSidebar() {
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
                <SheetContent side="left" className="w-72 p-0" showCloseButton={false}>
                    <SheetTitle className="sr-only">Menu điều hướng</SheetTitle>
                    {/* Logo */}
                    <div className="flex items-center gap-2 px-4 py-4 border-b">
                        <TreePine className="h-6 w-6 text-primary shrink-0" />
                        <span className="font-bold text-sm leading-tight">
                            Họ Nguyễn Duy<br />
                            <span className="text-xs font-normal text-muted-foreground">
                                (nhánh cụ Khoan Giản)
                            </span>
                        </span>
                    </div>

                    {/* Navigation */}
                    <nav className="flex-1 px-2 py-4 space-y-1 overflow-y-auto">
                        <SidebarNav onNavigate={() => setOpen(false)} />
                    </nav>

                </SheetContent>
            </Sheet>
        </>
    );
}
