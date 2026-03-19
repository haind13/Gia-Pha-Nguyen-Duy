'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import {
    Building2, Users, Shield, Loader2, ChevronRight, Activity,
    CreditCard, TrendingUp, Globe, Plus,
} from 'lucide-react';
import { supabase } from '@/lib/supabase';
import { Button } from '@/components/ui/button';
import type { Tenant } from '@/lib/tenant';

interface SuperadminStats {
    totalTenants: number;
    activeTenants: number;
    totalUsers: number;
    totalMembers: number;
}

export default function SuperadminDashboardPage() {
    const [stats, setStats] = useState<SuperadminStats | null>(null);
    const [tenants, setTenants] = useState<(Tenant & { memberCount?: number })[]>([]);
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        const fetchAll = async () => {
            try {
                const [tenantsRes, usersRes, membersRes] = await Promise.all([
                    supabase.from('tenants').select('*').order('created_at', { ascending: true }),
                    supabase.from('profiles').select('id', { count: 'exact', head: true }),
                    supabase.from('tenant_members').select('id', { count: 'exact', head: true }),
                ]);

                const allTenants = (tenantsRes.data || []) as Tenant[];
                setTenants(allTenants);

                setStats({
                    totalTenants: allTenants.length,
                    activeTenants: allTenants.filter(t => t.is_active).length,
                    totalUsers: usersRes.count ?? 0,
                    totalMembers: membersRes.count ?? 0,
                });
            } catch {
                setStats({ totalTenants: 0, activeTenants: 0, totalUsers: 0, totalMembers: 0 });
            }
            setLoading(false);
        };
        fetchAll();
    }, []);

    const planColors: Record<string, string> = {
        free: 'bg-slate-100 text-slate-600',
        basic: 'bg-green-100 text-green-700',
        standard: 'bg-blue-100 text-blue-700',
        premium: 'bg-amber-100 text-amber-700',
        pro: 'bg-purple-100 text-purple-700',
        enterprise: 'bg-red-100 text-red-700',
    };

    return (
        <div className="max-w-6xl mx-auto space-y-6">
            {/* Header */}
            <div className="flex items-center justify-between">
                <div>
                    <h1 className="text-2xl font-bold text-slate-800">Superadmin Dashboard</h1>
                    <p className="text-sm text-slate-500 mt-1">Quản lý toàn bộ nền tảng Gia Phả Đại Việt</p>
                </div>
                <Link href="/superadmin/tenants">
                    <Button className="bg-indigo-600 hover:bg-indigo-700 text-white gap-2">
                        <Plus className="h-4 w-4" />
                        Tạo gia phả mới
                    </Button>
                </Link>
            </div>

            {loading ? (
                <div className="flex items-center justify-center py-16">
                    <Loader2 className="h-7 w-7 animate-spin text-indigo-500" />
                </div>
            ) : stats && (
                <>
                    {/* Stat cards */}
                    <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                        <StatCard icon={<Building2 className="h-5 w-5" />} value={stats.totalTenants}
                            label="Tổng gia phả" color="indigo" href="/superadmin/tenants" />
                        <StatCard icon={<Activity className="h-5 w-5" />} value={stats.activeTenants}
                            label="Đang hoạt động" color="emerald" />
                        <StatCard icon={<Users className="h-5 w-5" />} value={stats.totalUsers}
                            label="Tài khoản" color="blue" href="/superadmin/users" />
                        <StatCard icon={<Shield className="h-5 w-5" />} value={stats.totalMembers}
                            label="Thành viên" color="amber" />
                    </div>

                    {/* Tenants table */}
                    <div className="bg-white border rounded-xl shadow-sm overflow-hidden">
                        <div className="flex items-center justify-between px-5 py-4 border-b">
                            <h2 className="text-sm font-semibold text-slate-700 flex items-center gap-2">
                                <Building2 className="h-4 w-4 text-slate-400" />
                                Danh sách gia phả
                            </h2>
                            <Link href="/superadmin/tenants"
                                className="text-xs text-indigo-600 hover:text-indigo-800 flex items-center gap-1">
                                Xem tất cả <ChevronRight className="h-3 w-3" />
                            </Link>
                        </div>
                        <div className="overflow-x-auto">
                            <table className="w-full text-sm">
                                <thead>
                                    <tr className="border-b bg-slate-50">
                                        <th className="text-left px-5 py-2.5 text-xs font-medium text-slate-500">Gia phả</th>
                                        <th className="text-left px-5 py-2.5 text-xs font-medium text-slate-500 hidden sm:table-cell">Slug</th>
                                        <th className="text-left px-5 py-2.5 text-xs font-medium text-slate-500 hidden md:table-cell">Domain</th>
                                        <th className="text-center px-5 py-2.5 text-xs font-medium text-slate-500">Gói</th>
                                        <th className="text-center px-5 py-2.5 text-xs font-medium text-slate-500">Trạng thái</th>
                                        <th className="text-right px-5 py-2.5 text-xs font-medium text-slate-500"></th>
                                    </tr>
                                </thead>
                                <tbody>
                                    {tenants.map(tenant => (
                                        <tr key={tenant.id} className="border-b hover:bg-slate-50 transition-colors">
                                            <td className="px-5 py-3">
                                                <div>
                                                    <p className="font-medium text-slate-800">{tenant.name}</p>
                                                    {tenant.description && (
                                                        <p className="text-[10px] text-slate-400 mt-0.5 truncate max-w-[200px]">{tenant.description}</p>
                                                    )}
                                                </div>
                                            </td>
                                            <td className="px-5 py-3 hidden sm:table-cell">
                                                <code className="text-xs bg-slate-100 px-1.5 py-0.5 rounded">{tenant.slug}</code>
                                            </td>
                                            <td className="px-5 py-3 hidden md:table-cell">
                                                {tenant.custom_domain ? (
                                                    <span className="text-xs text-blue-600">{tenant.custom_domain}</span>
                                                ) : (
                                                    <span className="text-xs text-slate-400">—</span>
                                                )}
                                            </td>
                                            <td className="px-5 py-3 text-center">
                                                <span className={`text-[10px] px-2 py-0.5 rounded-full font-medium ${planColors[tenant.plan] || 'bg-slate-100 text-slate-600'}`}>
                                                    {tenant.plan}
                                                </span>
                                            </td>
                                            <td className="px-5 py-3 text-center">
                                                <span className={`w-2 h-2 rounded-full inline-block ${tenant.is_active ? 'bg-emerald-500' : 'bg-slate-300'}`} />
                                            </td>
                                            <td className="px-5 py-3 text-right">
                                                <Link href={`/superadmin/tenants/${tenant.id}`}
                                                    className="text-xs text-indigo-600 hover:text-indigo-800">
                                                    Chi tiết →
                                                </Link>
                                            </td>
                                        </tr>
                                    ))}
                                    {tenants.length === 0 && (
                                        <tr>
                                            <td colSpan={6} className="px-5 py-8 text-center text-slate-400 text-sm">
                                                Chưa có gia phả nào. Nhấn &quot;Tạo gia phả mới&quot; để bắt đầu.
                                            </td>
                                        </tr>
                                    )}
                                </tbody>
                            </table>
                        </div>
                    </div>

                    {/* Quick stats */}
                    <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
                        {/* Revenue potential */}
                        <div className="bg-white border rounded-xl p-5 shadow-sm">
                            <h2 className="text-sm font-semibold text-slate-700 mb-4 flex items-center gap-2">
                                <TrendingUp className="h-4 w-4 text-slate-400" />
                                Phân bố gói dịch vụ
                            </h2>
                            <div className="space-y-2">
                                {['free', 'basic', 'standard', 'premium', 'pro', 'enterprise'].map(plan => {
                                    const count = tenants.filter(t => t.plan === plan).length;
                                    if (count === 0) return null;
                                    return (
                                        <div key={plan} className="flex items-center justify-between text-sm">
                                            <span className={`text-[10px] px-2 py-0.5 rounded-full font-medium ${planColors[plan]}`}>
                                                {plan}
                                            </span>
                                            <span className="text-slate-700 font-semibold">{count}</span>
                                        </div>
                                    );
                                })}
                            </div>
                        </div>

                        {/* Platform info */}
                        <div className="bg-white border rounded-xl p-5 shadow-sm">
                            <h2 className="text-sm font-semibold text-slate-700 mb-4 flex items-center gap-2">
                                <Globe className="h-4 w-4 text-slate-400" />
                                Thông tin nền tảng
                            </h2>
                            <div className="space-y-2 text-sm">
                                <div className="flex items-center justify-between py-1.5 border-b border-dashed">
                                    <span className="text-slate-500">Platform</span>
                                    <span className="text-slate-700 font-medium">giaphadaiviet.vn</span>
                                </div>
                                <div className="flex items-center justify-between py-1.5 border-b border-dashed">
                                    <span className="text-slate-500">Phiên bản</span>
                                    <span className="text-slate-700 font-medium">1.0.0</span>
                                </div>
                                <div className="flex items-center justify-between py-1.5 border-b border-dashed">
                                    <span className="text-slate-500">Tổng gia phả</span>
                                    <span className="text-slate-800 font-semibold">{stats.totalTenants}</span>
                                </div>
                                <div className="flex items-center justify-between py-1.5">
                                    <span className="text-slate-500">Tổng tài khoản</span>
                                    <span className="text-slate-800 font-semibold">{stats.totalUsers}</span>
                                </div>
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
    color: 'indigo' | 'emerald' | 'blue' | 'amber';
    href?: string;
}) {
    const colors = {
        indigo: 'bg-indigo-100 text-indigo-600',
        emerald: 'bg-emerald-100 text-emerald-600',
        blue: 'bg-blue-100 text-blue-600',
        amber: 'bg-amber-100 text-amber-600',
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
