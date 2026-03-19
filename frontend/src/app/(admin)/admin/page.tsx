'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import {
    Shield, ClipboardCheck, Bell, FileText, Database, BarChart3,
    Users, Loader2, ChevronRight,
} from 'lucide-react';
import { supabase } from '@/lib/supabase';

interface DashboardStats {
    totalPeople: number;
    totalUsers: number;
    pendingEdits: number;
}

export default function AdminDashboardPage() {
    const [stats, setStats] = useState<DashboardStats | null>(null);
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        const fetchStats = async () => {
            try {
                const [peopleRes, usersRes, editsRes] = await Promise.all([
                    supabase.from('people_safe').select('id', { count: 'exact', head: true }),
                    supabase.from('profiles').select('id', { count: 'exact', head: true }),
                    supabase.from('pending_edits').select('id', { count: 'exact', head: true }).eq('status', 'pending'),
                ]);
                setStats({
                    totalPeople: peopleRes.count ?? 0,
                    totalUsers: usersRes.count ?? 0,
                    pendingEdits: editsRes.count ?? 0,
                });
            } catch {
                setStats({ totalPeople: 0, totalUsers: 0, pendingEdits: 0 });
            }
            setLoading(false);
        };
        fetchStats();
    }, []);

    const quickLinks = [
        { href: '/admin/users', label: 'Quản lý Users', icon: Shield, description: 'Quản lý tài khoản, phân quyền, mời thành viên', color: 'bg-blue-50 text-blue-700 border-blue-200' },
        { href: '/admin/edits', label: 'Kiểm duyệt', icon: ClipboardCheck, description: 'Duyệt các đóng góp chỉnh sửa từ thành viên', color: 'bg-amber-50 text-amber-700 border-amber-200' },
        { href: '/admin/notifications', label: 'Nhắc sự kiện', icon: Bell, description: 'Cấu hình kênh thông báo Zalo, Telegram', color: 'bg-emerald-50 text-emerald-700 border-emerald-200' },
        { href: '/admin/audit', label: 'Audit Log', icon: FileText, description: 'Xem lịch sử thao tác hệ thống', color: 'bg-purple-50 text-purple-700 border-purple-200' },
        { href: '/admin/backup', label: 'Backup', icon: Database, description: 'Sao lưu và khôi phục dữ liệu', color: 'bg-slate-50 text-slate-700 border-slate-200' },
        { href: '/admin/thong-ke', label: 'Thống kê', icon: BarChart3, description: 'Dashboard thống kê gia phả chi tiết', color: 'bg-orange-50 text-orange-700 border-orange-200' },
    ];

    return (
        <div className="max-w-5xl mx-auto space-y-6">
            {/* Header */}
            <div>
                <h1 className="text-2xl font-bold text-slate-800">Dashboard Quản trị</h1>
                <p className="text-sm text-slate-500 mt-1">Tổng quan hệ thống gia phả</p>
            </div>

            {/* Quick stats */}
            {loading ? (
                <div className="flex items-center justify-center py-12">
                    <Loader2 className="h-6 w-6 animate-spin text-amber-500" />
                </div>
            ) : stats && (
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                    <div className="bg-white border rounded-xl p-4 shadow-sm">
                        <div className="flex items-center gap-3">
                            <div className="w-10 h-10 rounded-lg bg-blue-100 flex items-center justify-center">
                                <Users className="h-5 w-5 text-blue-600" />
                            </div>
                            <div>
                                <p className="text-2xl font-bold text-slate-800">{stats.totalPeople}</p>
                                <p className="text-xs text-slate-500">Thành viên gia phả</p>
                            </div>
                        </div>
                    </div>
                    <div className="bg-white border rounded-xl p-4 shadow-sm">
                        <div className="flex items-center gap-3">
                            <div className="w-10 h-10 rounded-lg bg-emerald-100 flex items-center justify-center">
                                <Shield className="h-5 w-5 text-emerald-600" />
                            </div>
                            <div>
                                <p className="text-2xl font-bold text-slate-800">{stats.totalUsers}</p>
                                <p className="text-xs text-slate-500">Tài khoản hệ thống</p>
                            </div>
                        </div>
                    </div>
                    <div className="bg-white border rounded-xl p-4 shadow-sm">
                        <div className="flex items-center gap-3">
                            <div className="w-10 h-10 rounded-lg bg-amber-100 flex items-center justify-center">
                                <ClipboardCheck className="h-5 w-5 text-amber-600" />
                            </div>
                            <div>
                                <p className="text-2xl font-bold text-slate-800">{stats.pendingEdits}</p>
                                <p className="text-xs text-slate-500">Đóng góp chờ duyệt</p>
                            </div>
                        </div>
                    </div>
                </div>
            )}

            {/* Quick links */}
            <div>
                <h2 className="text-sm font-semibold text-slate-600 uppercase tracking-wider mb-3">Chức năng quản trị</h2>
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
    );
}
