'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { useState } from 'react';
import { TreePine, Moon, Sun, LogIn, Menu } from 'lucide-react';
import { useTheme } from 'next-themes';
import { cn } from '@/lib/utils';
import { Button } from '@/components/ui/button';
import { Sheet, SheetContent, SheetTitle } from '@/components/ui/sheet';
import { publicNavItems } from '@/components/layout/sidebar';

export function PublicHeader() {
    const pathname = usePathname();
    const { theme, setTheme } = useTheme();
    const [mobileOpen, setMobileOpen] = useState(false);

    return (
        <>
            <header className="sticky top-0 z-50 border-b bg-card/80 backdrop-blur-sm">
                <div className="flex h-14 items-center justify-between px-4 lg:px-8">
                    {/* Left: Logo */}
                    <Link href="/" className="flex items-center gap-2 shrink-0">
                        <TreePine className="h-6 w-6 text-primary" />
                        <span className="font-bold text-sm sm:text-base leading-tight hidden sm:block">
                            Họ Nguyễn Duy
                        </span>
                    </Link>

                    {/* Center: Desktop nav */}
                    <nav className="hidden md:flex items-center gap-1">
                        {publicNavItems.map((item) => {
                            const isActive = pathname === item.href || (item.href !== '/' && pathname.startsWith(item.href));
                            return (
                                <Link key={item.href} href={item.href}>
                                    <span
                                        className={cn(
                                            'flex items-center gap-2 rounded-lg px-4 py-2 text-sm font-medium transition-colors',
                                            isActive
                                                ? 'bg-primary text-primary-foreground'
                                                : 'text-muted-foreground hover:bg-accent hover:text-accent-foreground',
                                        )}
                                    >
                                        <item.icon className="h-4 w-4" />
                                        {item.label}
                                    </span>
                                </Link>
                            );
                        })}
                    </nav>

                    {/* Right: Theme + Login */}
                    <div className="flex items-center gap-2 shrink-0">
                        <Button
                            variant="ghost"
                            size="icon"
                            className="h-9 w-9"
                            onClick={() => setTheme(theme === 'dark' ? 'light' : 'dark')}
                            aria-label="Toggle theme"
                        >
                            <Sun className="h-4 w-4 rotate-0 scale-100 transition-all dark:-rotate-90 dark:scale-0" />
                            <Moon className="absolute h-4 w-4 rotate-90 scale-0 transition-all dark:rotate-0 dark:scale-100" />
                        </Button>

                        <Link href="/login">
                            <Button
                                variant="outline"
                                size="sm"
                                className="h-8 text-xs sm:text-sm hidden sm:flex"
                            >
                                <LogIn className="h-4 w-4 mr-1.5" />
                                Đăng nhập
                            </Button>
                        </Link>

                        {/* Mobile hamburger */}
                        <Button
                            variant="ghost"
                            size="icon"
                            className="md:hidden h-9 w-9"
                            onClick={() => setMobileOpen(true)}
                            aria-label="Mở menu"
                        >
                            <Menu className="h-5 w-5" />
                        </Button>
                    </div>
                </div>
            </header>

            {/* Mobile drawer */}
            <Sheet open={mobileOpen} onOpenChange={setMobileOpen}>
                <SheetContent side="left" className="w-72 p-0" showCloseButton={false}>
                    <SheetTitle className="sr-only">Menu điều hướng</SheetTitle>
                    <div className="flex items-center gap-2 px-4 py-4 border-b">
                        <TreePine className="h-6 w-6 text-primary shrink-0" />
                        <span className="font-bold text-sm leading-tight">
                            Họ Nguyễn Duy<br />
                            <span className="text-xs font-normal text-muted-foreground">
                                (nhánh cụ Khoan Giản)
                            </span>
                        </span>
                    </div>
                    <nav className="px-2 py-4 space-y-1">
                        {publicNavItems.map((item) => {
                            const isActive = pathname === item.href || (item.href !== '/' && pathname.startsWith(item.href));
                            return (
                                <Link key={item.href} href={item.href} onClick={() => setMobileOpen(false)}>
                                    <span
                                        className={cn(
                                            'flex items-center gap-3 rounded-lg px-3 py-2.5 text-sm transition-colors',
                                            isActive
                                                ? 'bg-primary text-primary-foreground'
                                                : 'text-muted-foreground hover:bg-accent hover:text-accent-foreground',
                                        )}
                                    >
                                        <item.icon className="h-4 w-4 shrink-0" />
                                        {item.label}
                                    </span>
                                </Link>
                            );
                        })}
                        <div className="border-t my-3" />
                        <Link href="/login" onClick={() => setMobileOpen(false)}>
                            <span className="flex items-center gap-3 rounded-lg px-3 py-2.5 text-sm text-muted-foreground hover:bg-accent hover:text-accent-foreground">
                                <LogIn className="h-4 w-4 shrink-0" />
                                Đăng nhập
                            </span>
                        </Link>
                    </nav>
                </SheetContent>
            </Sheet>
        </>
    );
}
