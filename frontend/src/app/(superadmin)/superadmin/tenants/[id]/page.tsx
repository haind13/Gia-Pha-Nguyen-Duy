'use client';

import { useEffect, useState } from 'react';
import { useParams, useRouter } from 'next/navigation';
import Link from 'next/link';
import {
    ArrowLeft, Building2, Globe, Users, CreditCard, Loader2, Save,
    ExternalLink, Settings, Shield, Trash2,
} from 'lucide-react';
import { supabase } from '@/lib/supabase';
import { Button } from '@/components/ui/button';
import type { Tenant, SiteConfig, TenantMember } from '@/lib/tenant';

interface MemberWithProfile extends TenantMember {
    profiles?: {
        email: string;
        display_name: string | null;
    };
}

export default function TenantDetailPage() {
    const params = useParams();
    const router = useRouter();
    const tenantId = params.id as string;

    const [tenant, setTenant] = useState<Tenant | null>(null);
    const [config, setConfig] = useState<SiteConfig | null>(null);
    const [members, setMembers] = useState<MemberWithProfile[]>([]);
    const [loading, setLoading] = useState(true);
    const [saving, setSaving] = useState(false);

    useEffect(() => {
        const fetch = async () => {
            const [tenantRes, configRes, membersRes] = await Promise.all([
                supabase.from('tenants').select('*').eq('id', tenantId).single(),
                supabase.from('site_config').select('*').eq('tenant_id', tenantId).maybeSingle(),
                supabase.from('tenant_members').select('*, profiles(email, display_name)')
                    .eq('tenant_id', tenantId).order('created_at'),
            ]);
            setTenant(tenantRes.data as Tenant);
            setConfig(configRes.data as SiteConfig);
            setMembers((membersRes.data || []) as MemberWithProfile[]);
            setLoading(false);
        };
        fetch();
    }, [tenantId]);

    const handleSaveTenant = async () => {
        if (!tenant) return;
        setSaving(true);
        await supabase.from('tenants').update({
            name: tenant.name,
            description: tenant.description,
            custom_domain: tenant.custom_domain,
            plan: tenant.plan,
            max_members: tenant.max_members,
            max_admins: tenant.max_admins,
            max_storage_gb: tenant.max_storage_gb,
            is_active: tenant.is_active,
        }).eq('id', tenant.id);
        setSaving(false);
    };

    const updateTenant = (key: keyof Tenant, value: unknown) => {
        setTenant(prev => prev ? { ...prev, [key]: value } as Tenant : null);
    };

    const planColors: Record<string, string> = {
        free: 'bg-slate-100 text-slate-600',
        basic: 'bg-green-100 text-green-700',
        standard: 'bg-blue-100 text-blue-700',
        premium: 'bg-amber-100 text-amber-700',
        pro: 'bg-purple-100 text-purple-700',
        enterprise: 'bg-red-100 text-red-700',
    };

    if (loading) {
        return (
            <div className="flex items-center justify-center py-16">
                <Loader2 className="h-7 w-7 animate-spin text-indigo-500" />
            </div>
        );
    }

    if (!tenant) {
        return <p className="text-center text-slate-500 py-16">Không tìm thấy gia phả.</p>;
    }

    const websiteUrl = tenant.custom_domain
        ? `https://${tenant.custom_domain}`
        : `https://${tenant.slug}.giaphadaiviet.vn`;

    return (
        <div className="max-w-4xl mx-auto space-y-6">
            {/* Back */}
            <Link href="/superadmin/tenants"
                className="flex items-center gap-1.5 text-xs text-indigo-600 hover:text-indigo-800">
                <ArrowLeft className="h-3.5 w-3.5" />
                Quay lại danh sách
            </Link>

            {/* Header */}
            <div className="flex items-center justify-between">
                <div>
                    <h1 className="text-2xl font-bold text-slate-800">{tenant.name}</h1>
                    <div className="flex items-center gap-2 mt-1">
                        <code className="text-xs bg-slate-100 px-2 py-0.5 rounded">{tenant.slug}</code>
                        <span className={`text-[10px] px-2 py-0.5 rounded-full font-medium ${planColors[tenant.plan]}`}>
                            {tenant.plan}
                        </span>
                        <span className={`w-2 h-2 rounded-full ${tenant.is_active ? 'bg-emerald-500' : 'bg-red-400'}`} />
                    </div>
                </div>
                <a href={websiteUrl} target="_blank" rel="noopener noreferrer"
                    className="flex items-center gap-1.5 text-xs text-blue-600 hover:text-blue-800 bg-blue-50 px-3 py-1.5 rounded-full">
                    <Globe className="h-3.5 w-3.5" />
                    Xem website
                    <ExternalLink className="h-3 w-3" />
                </a>
            </div>

            {/* Tenant settings */}
            <div className="bg-white border rounded-xl p-5 shadow-sm space-y-4">
                <h2 className="text-sm font-semibold text-slate-700 flex items-center gap-2">
                    <Settings className="h-4 w-4 text-slate-400" />
                    Cấu hình Tenant
                </h2>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                    <div>
                        <label className="block text-xs font-medium text-slate-600 mb-1">Tên gia phả</label>
                        <input type="text" value={tenant.name}
                            onChange={e => updateTenant('name', e.target.value)}
                            className="w-full px-3 py-2 border rounded-lg text-sm outline-none focus:ring-2 focus:ring-indigo-500" />
                    </div>
                    <div>
                        <label className="block text-xs font-medium text-slate-600 mb-1">Custom Domain</label>
                        <input type="text" value={tenant.custom_domain || ''}
                            onChange={e => updateTenant('custom_domain', e.target.value || null)}
                            placeholder="donghonguyenduy.asia"
                            className="w-full px-3 py-2 border rounded-lg text-sm outline-none focus:ring-2 focus:ring-indigo-500" />
                    </div>
                    <div>
                        <label className="block text-xs font-medium text-slate-600 mb-1">Gói dịch vụ</label>
                        <select value={tenant.plan}
                            onChange={e => updateTenant('plan', e.target.value)}
                            className="w-full px-3 py-2 border rounded-lg text-sm outline-none focus:ring-2 focus:ring-indigo-500">
                            <option value="free">Miễn phí</option>
                            <option value="basic">Cơ bản</option>
                            <option value="standard">Đoàn viên</option>
                            <option value="premium">Đồng tâm</option>
                            <option value="pro">Thịnh vượng</option>
                            <option value="enterprise">Bản sắc</option>
                        </select>
                    </div>
                    <div>
                        <label className="block text-xs font-medium text-slate-600 mb-1">Trạng thái</label>
                        <select value={tenant.is_active ? 'active' : 'inactive'}
                            onChange={e => updateTenant('is_active', e.target.value === 'active')}
                            className="w-full px-3 py-2 border rounded-lg text-sm outline-none focus:ring-2 focus:ring-indigo-500">
                            <option value="active">Hoạt động</option>
                            <option value="inactive">Tạm ngưng</option>
                        </select>
                    </div>
                    <div>
                        <label className="block text-xs font-medium text-slate-600 mb-1">Giới hạn thành viên</label>
                        <input type="number" value={tenant.max_members}
                            onChange={e => updateTenant('max_members', parseInt(e.target.value) || 0)}
                            className="w-full px-3 py-2 border rounded-lg text-sm outline-none focus:ring-2 focus:ring-indigo-500" />
                        <p className="text-[10px] text-slate-400 mt-0.5">-1 = không giới hạn</p>
                    </div>
                    <div>
                        <label className="block text-xs font-medium text-slate-600 mb-1">Giới hạn quản lý</label>
                        <input type="number" value={tenant.max_admins}
                            onChange={e => updateTenant('max_admins', parseInt(e.target.value) || 1)}
                            className="w-full px-3 py-2 border rounded-lg text-sm outline-none focus:ring-2 focus:ring-indigo-500" />
                    </div>
                </div>
                <div className="flex justify-end">
                    <Button onClick={handleSaveTenant} disabled={saving}
                        className="bg-indigo-600 hover:bg-indigo-700 text-white gap-2">
                        {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />}
                        Lưu thay đổi
                    </Button>
                </div>
            </div>

            {/* Members */}
            <div className="bg-white border rounded-xl p-5 shadow-sm">
                <div className="flex items-center justify-between mb-4">
                    <h2 className="text-sm font-semibold text-slate-700 flex items-center gap-2">
                        <Users className="h-4 w-4 text-slate-400" />
                        Thành viên quản trị ({members.length})
                    </h2>
                </div>
                {members.length === 0 ? (
                    <p className="text-xs text-slate-400 italic">Chưa có thành viên nào.</p>
                ) : (
                    <div className="space-y-2">
                        {members.map(m => (
                            <div key={m.id} className="flex items-center justify-between py-2 border-b last:border-0">
                                <div className="flex items-center gap-3">
                                    <div className="w-7 h-7 rounded-full bg-indigo-100 flex items-center justify-center shrink-0">
                                        <span className="text-[10px] font-bold text-indigo-700">
                                            {(m.profiles?.display_name || m.profiles?.email || '?')[0].toUpperCase()}
                                        </span>
                                    </div>
                                    <div>
                                        <p className="text-sm text-slate-800">{m.profiles?.display_name || m.profiles?.email}</p>
                                        <p className="text-[10px] text-slate-400">{m.profiles?.email}</p>
                                    </div>
                                </div>
                                <span className={`text-[10px] px-2 py-0.5 rounded-full font-medium ${
                                    m.role === 'admin' ? 'bg-red-100 text-red-700' :
                                    m.role === 'editor' ? 'bg-blue-100 text-blue-700' :
                                    'bg-slate-100 text-slate-600'
                                }`}>
                                    {m.role}
                                </span>
                            </div>
                        ))}
                    </div>
                )}
            </div>
        </div>
    );
}
