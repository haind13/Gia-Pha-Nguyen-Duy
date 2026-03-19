'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import {
    Shield, ClipboardCheck, Bell, FileText, Database, BarChart3,
    Users, Loader2, ChevronRight, Globe, Calendar, ExternalLink,
    Crown, Settings,
} from 'lucide-react';
import { supabase } from '@/lib/supabase';
import { useTenant } from '@/components/tenant-provider';

interface DashboardStats {
    totalPeople: number;
    totalUsers: number;
    pendingEdits: number;
    totalGenerations: number;
    upcomingEvents: number;
}

interface AdminUser {
    id: string;
    email: string;
    display_name: string | null;
    role: string;
    created_at: string;
}

export default function AdminDashboardPage() {
    const [stats, setStats] = useState<DashboardStats | null>(null);
    const [admins, setAdmins] = useState<AdminUser[]>([]);
    const [loading, setLoading] = useState(true);
    const { tenant, siteConfig, treeId } = useTenant();

    // Build website URL dynamically from tenant data
    const siteDomain = tenant?.custom_domain
        || (tenant?.slug ? `${tenant.slug}.giaphadaiviet.vn` : '');
    const cpDomain = siteDomain ? `cp.${siteDomain}` : '';

    useEffect(() => {
        const fetchAll = async () => {
            try {
                // Build queries with optional tree_id filter
                let peopleQuery = supabase.from('people_safe').select('id', { count: 'exact', head: true });
                let genQuery = supabase.from('people_safe').select('generation');
                let editsQuery = supabase.from('pending_edits').select('id', { count: 'exact', head: true }).eq('status', 'pending');

                if (treeId) {
                    peopleQuery = peopleQuery.eq('tree_id', treeId);
                    genQuery = genQuery.eq('tree_id', treeId);
                    editsQuery = editsQuery.eq('tree_id', treeId);
                }

                const [peopleRes, usersRes, editsRes, genRes, adminRes] = await Promise.all([
                    peopleQuery,
                    supabase.from('profiles').select('id', { count: 'exact', head: true }),
                    editsQuery,
                    genQuery,
                    supabase.from('profiles').select('id, email, display_name, role, created_at')
                        .in('role', ['admin', 'editor']).order('created_at', { ascending: true }),
                ]);

                const generations = genRes.data
                    ? new Set(genRes.data.map((p: { generation: number }) => p.generation)).size
                    : 0;

                setStats({
                    totalPeople: peopleRes.count ?? 0,
                    totalUsers: usersRes.count ?? 0,
                    pendingEdits: editsRes.count ?? 0,
                    totalGenerations: generations,
                    upcomingEvents: 0,
                });

                if (adminRes.data) setAdmins(adminRes.data);
            } catch {
                setStats({ totalPeople: 0, totalUsers: 0, pendingEdits: 0, totalGenerations: 0, upcomingEvents: 0 });
            }
            setLoading(false);
        };
        fetchAll();
    }, [treeId]);

    const quickLinks = [
        { href: '/admin/users', label: 'Quản lý Users', icon: Shield, description: 'Quản lý tài khoản, phân quyền, mời thành viên', color: 'bg-blue-50 text-blue-700 border-blue-200' },
        { href: '/admin/edits', label: 'Kiểm duyệt', icon: ClipboardCheck, description: 'Duyệt các đóng góp chỉnh sửa từ thành viên', color: 'bg-amber-50 text-amber-700 border-amber-200' },
        { href: '/admin/notifications', label: 'Nhắc sự kiện', icon: Bell, description: 'Cấu hình kênh thông báo Zalo, Telegram', color: 'bg-emerald-50 text-emerald-700 border-emerald-200' },
        { href: '/admin/audit', label: 'Audit Log', icon: FileText, description: 'Xem lịch sử thao tác hệ thống', color: 'bg-purple-50 text-purple-700 border-purple-200' },
        { href: '/admin/backup', label: 'Backup', icon: Database, description: 'Sao lưu và khôi phục dữ liệu', color: 'bg-slate-50 text-slate-700 border-slate-200' },
        { href: '/admin/thong-ke', label: 'Thống kê', icon: BarChart3, description: 'Dashboard thống kê gia phả chi tiết', color: 'bg-orange-50 text-orange-700 border-orange-200' },
    ];

    return (
        <div className="max-w-6xl mx-auto space-y-6">
            {/* Header */}
            <div className="flex items-center justify-between">
                <div>
                    <h1 className="text-2xl font-bold text-slate-800">Dashboard Quản trị</h1>
                    <p className="text-sm text-slate-500 mt-1">Tổng quan hệ thống gia phả</p>
                </div>
                <a href={siteDomain ? `https://${siteDomain}` : '#'} target="_blank" rel="noopener noreferrer"
                    className="hidden sm:flex items-center gap-1.5 text-xs text-blue-600 hover:text-blue-800 transition-colors bg-blue-50 px-3 py-1.5 rounded-full">
                    <Globe className="h-3.5 w-3.5" />
                    Website trực tuyến
                    <ExternalLink className="h-3 w-3" />
                </a>
            </div>

            {loading ? (
                <div className="flex items-center justify-center py-16">
                    <Loader2 className="h-7 w-7 animate-spin text-amber-500" />
                </div>
            ) : stats && (
                <>
                    {/* Stat cards row — 4 cols like cp.giaphadaiviet.vn */}
                    <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                        <StatCard icon={<Users className="h-5 w-5" />} value={stats.totalPeople}
                            label="Thành viên" color="blue" href="/admin/thong-ke" />
                        <StatCard icon={<Crown className="h-5 w-5" />} value={stats.totalGenerations}
                            label="Thế hệ" color="amber" />
                        <StatCard icon={<Shield className="h-5 w-5" />} value={stats.totalUsers}
                            label="Tài khoản" color="emerald" href="/admin/users" />
                        <StatCard icon={<ClipboardCheck className="h-5 w-5" />} value={stats.pendingEdits}
                            label="Chờ duyệt" color="rose" href="/admin/edits" />
                    </div>

                    {/* Two column layout */}
                    <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
                        {/* Left: System info */}
                        <div className="lg:col-span-2 space-y-4">
                            {/* Chi tiết hệ thống */}
                            <div className="bg-white border rounded-xl p-5 shadow-sm">
                                <h2 className="text-sm font-semibold text-slate-700 mb-4 flex items-center gap-2">
                                    <Settings className="h-4 w-4 text-slate-400" />
                                    Chi tiết hệ thống
                                </h2>
                                <div className="grid grid-cols-1 sm:grid-cols-2 gap-y-3 gap-x-6 text-sm">
                                    <div className="flex items-center justify-between py-1.5 border-b border-dashed">
                                        <span className="text-slate-500">Website</span>
                                        <a href={siteDomain ? `https://${siteDomain}` : '#'} target="_blank" rel="noopener noreferrer"
                                            className="text-blue-600 hover:underline font-medium text-xs">{siteDomain || 'Chưa cấu hình'}</a>
                                    </div>
                                    <div className="flex items-center justify-between py-1.5 border-b border-dashed">
                                        <span className="text-slate-500">Admin CP</span>
                                        <span className="text-slate-700 font-medium text-xs">{cpDomain || 'Chưa cấu hình'}</span>
                                    </div>
                                    <div className="flex items-center justify-between py-1.5 border-b border-dashed">
                                        <span className="text-slate-500">Số thành viên</span>
                                        <span className="text-slate-800 font-semibold">{stats.totalPeople}</span>
                                    </div>
                                    <div className="flex items-center justify-between py-1.5 border-b border-dashed">
                                        <span className="text-slate-500">Số thế hệ</span>
                                        <span className="text-slate-800 font-semibold">{stats.totalGenerations}</span>
                                    </div>
                                    <div className="flex items-center justify-between py-1.5 border-b border-dashed">
                                        <span className="text-slate-500">Quản trị viên</span>
                                        <span className="text-slate-800 font-semibold">{admins.length}</span>
                                    </div>
                                    <div className="flex items-center justify-between py-1.5 border-b border-dashed">
                                        <span className="text-slate-500">Tài khoản hệ thống</span>
                                        <span className="text-slate-800 font-semibold">{stats.totalUsers}</span>
                                    </div>
                                </div>
                            </div>

                            {/* Quick links */}
                            <div>
                                <h2 className="text-sm font-semibold text-slate-600 uppercase tracking-wider mb-3">
                                    Chức năng quản trị
                                </h2>
                                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
                                    {quickLinks.map(link => (
                                        <Link key={link.href} href={link.href}
                                            className="group bg-white border rounded-xl p-4 shadow-sm hover:shadow-md transition-all">
                                            <div className="flex items-start gap-3">
                                                <div className={`w-9 h-9 rounded-lg flex items-center justify-center shrink-0 ${link.color}`}>
                                                    <link.icon className="h-4 w-4" />
                                                </div>
                                                <div className="flex-1 min-w-0">
                                                    <div className="flex items-center gap-1">
                                                        <h3 className="font-semibold text-sm text-slate-800">{link.label}</h3>
                                                        <ChevronRight className="h-3.5 w-3.5 text-slate-400 opacity-0 group-hover:opacity-100 transition-opacity" />
                                                    </div>
                                                    <p className="text-xs text-slate-500 mt-0.5">{link.description}</p>
                                                </div>
                                            </div>
                                        </Link>
                                    ))}
                                </div>
                            </div>
                        </div>

                        {/* Right column */}
                        <div className="space-y-4">
                            {/* Ban quản trị */}
                            <div className="bg-white border rounded-xl p-5 shadow-sm">
                                <div className="flex items-center justify-between mb-4">
                                    <h2 className="text-sm font-semibold text-slate-700">Ban quản trị</h2>
                                    <span className="text-[10px] bg-blue-100 text-blue-700 px-2 py-0.5 rounded-full font-medium">
                                        {admins.length} thành viên
                                    </span>
                                </div>
                                {admins.length === 0 ? (
                                    <p className="text-xs text-slate-400">Chưa có dữ liệu</p>
                                ) : (
                                    <div className="space-y-3">
                                        {admins.map(admin => (
                                            <div key={admin.id} className="flex items-center gap-3">
                                                <div className="w-8 h-8 rounded-full bg-gradient-to-br from-amber-100 to-orange-100 flex items-center justify-center shrink-0">
                                                    <span className="text-xs font-bold text-amber-700">
                                                        {(admin.display_name || admin.email)[0].toUpperCase()}
                                                    </span>
                                                </div>
                                                <div className="flex-1 min-w-0">
                                                    <p className="text-sm font-medium text-slate-800 truncate">
                                                        {admin.display_name || admin.email.split('@')[0]}
                                                    </p>
                                                    <p className="text-[10px] text-slate-400 truncate">{admin.email}</p>
                                                </div>
                                                <span className={`text-[10px] px-1.5 py-0.5 rounded font-medium shrink-0 ${
                                                    admin.role === 'admin'
                                                        ? 'bg-red-100 text-red-700'
                                                        : 'bg-blue-100 text-blue-700'
                                                }`}>
                                                    {admin.role === 'admin' ? 'QTV' : 'BTV'}
                                                </span>
                                            </div>
                                        ))}
                                    </div>
                                )}
                                <Link href="/admin/users"
                                    className="flex items-center justify-end gap-1 text-xs text-blue-600 hover:text-blue-800 mt-3 pt-3 border-t">
                                    Xem tất cả <ChevronRight className="h-3 w-3" />
                                </Link>
                            </div>

                            {/* Sự kiện sắp diễn ra placeholder */}
                            <div className="bg-white border rounded-xl p-5 shadow-sm">
                                <div className="flex items-center justify-between mb-4">
                                    <h2 className="text-sm font-semibold text-slate-700">Sự kiện sắp diễn ra</h2>
                                    <Calendar className="h-4 w-4 text-slate-400" />
                                </div>
                                <p className="text-xs text-slate-400 italic">Không có sự kiện nào sắp diễn ra.</p>
                                <Link href="/admin/notifications"
                                    className="flex items-center justify-end gap-1 text-xs text-blue-600 hover:text-blue-800 mt-3 pt-3 border-t">
                                    Xem tất cả <ChevronRight className="h-3 w-3" />
                                </Link>
                            </div>
                        </div>
                    </div>
                </>
            )}
        </div>
    );
}

function StatCard({ icon, value, label, color, href }: {
    icon: React.ReactNode; value: number; label: string;
    color: 'blue' | 'amber' | 'emerald' | 'rose';
    href?: string;
}) {
    const colors = {
        blue: 'bg-blue-100 text-blue-600',
        amber: 'bg-amber-100 text-amber-600',
        emerald: 'bg-emerald-100 text-emerald-600',
        rose: 'bg-rose-100 text-rose-600',
    };

    const inner = (
        <div className="bg-white border rounded-xl p-4 shadow-sm hover:shadow-md transition-shadow">
            <div className="flex items-center gap-3">
                <div className={`w-10 h-10 rounded-lg flex items-center justify-center shrink-0 ${colors[color]}`}>
                    {icon}
                </div>
                <div>
                    <p className="text-2xl font-bold text-slate-800">{value}</p>
                    <p className="text-xs text-slate-500">{label}</p>
                </div>
            </div>
        </div>
    );

    if (href) return <Link href={href}>{inner}</Link>;
    return inner;
}
