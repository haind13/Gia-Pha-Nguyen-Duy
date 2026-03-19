'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import {
    Building2, Plus, Search, Loader2, ExternalLink, ToggleLeft, ToggleRight,
} from 'lucide-react';
import { supabase } from '@/lib/supabase';
import { Button } from '@/components/ui/button';
import type { Tenant } from '@/lib/tenant';
import { formatPlanPrice } from '@/lib/tenant';

export default function SuperadminTenantsPage() {
    const [tenants, setTenants] = useState<Tenant[]>([]);
    const [loading, setLoading] = useState(true);
    const [search, setSearch] = useState('');
    const [showCreate, setShowCreate] = useState(false);

    const fetchTenants = async () => {
        const { data } = await supabase
            .from('tenants')
            .select('*')
            .order('created_at', { ascending: true });
        setTenants((data || []) as Tenant[]);
        setLoading(false);
    };

    useEffect(() => { fetchTenants(); }, []);

    const toggleActive = async (tenant: Tenant) => {
        await supabase
            .from('tenants')
            .update({ is_active: !tenant.is_active })
            .eq('id', tenant.id);
        fetchTenants();
    };

    const filtered = tenants.filter(t =>
        t.name.toLowerCase().includes(search.toLowerCase()) ||
        t.slug.toLowerCase().includes(search.toLowerCase())
    );

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
                    <h1 className="text-2xl font-bold text-slate-800">Quản lý Gia phả</h1>
                    <p className="text-sm text-slate-500 mt-1">Tạo, quản lý và theo dõi tất cả gia phả trên nền tảng</p>
                </div>
                <Button onClick={() => setShowCreate(!showCreate)}
                    className="bg-indigo-600 hover:bg-indigo-700 text-white gap-2">
                    <Plus className="h-4 w-4" />
                    Tạo gia phả
                </Button>
            </div>

            {/* Create form */}
            {showCreate && <CreateTenantForm onCreated={() => { setShowCreate(false); fetchTenants(); }} onCancel={() => setShowCreate(false)} />}

            {/* Search */}
            <div className="relative">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400" />
                <input
                    type="text"
                    value={search}
                    onChange={e => setSearch(e.target.value)}
                    placeholder="Tìm theo tên hoặc slug..."
                    className="w-full pl-10 pr-4 py-2.5 border rounded-lg text-sm focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 outline-none"
                />
            </div>

            {/* Table */}
            {loading ? (
                <div className="flex items-center justify-center py-16">
                    <Loader2 className="h-7 w-7 animate-spin text-indigo-500" />
                </div>
            ) : (
                <div className="bg-white border rounded-xl shadow-sm overflow-hidden">
                    <div className="overflow-x-auto">
                        <table className="w-full text-sm">
                            <thead>
                                <tr className="border-b bg-slate-50">
                                    <th className="text-left px-5 py-3 text-xs font-medium text-slate-500">Gia phả</th>
                                    <th className="text-left px-5 py-3 text-xs font-medium text-slate-500 hidden sm:table-cell">Slug</th>
                                    <th className="text-left px-5 py-3 text-xs font-medium text-slate-500 hidden md:table-cell">Domain</th>
                                    <th className="text-center px-5 py-3 text-xs font-medium text-slate-500">Gói</th>
                                    <th className="text-center px-5 py-3 text-xs font-medium text-slate-500">Giới hạn</th>
                                    <th className="text-center px-5 py-3 text-xs font-medium text-slate-500">Active</th>
                                    <th className="text-right px-5 py-3 text-xs font-medium text-slate-500"></th>
                                </tr>
                            </thead>
                            <tbody>
                                {filtered.map(tenant => (
                                    <tr key={tenant.id} className="border-b hover:bg-slate-50 transition-colors">
                                        <td className="px-5 py-3">
                                            <p className="font-medium text-slate-800">{tenant.name}</p>
                                            <p className="text-[10px] text-slate-400 mt-0.5">{tenant.description}</p>
                                        </td>
                                        <td className="px-5 py-3 hidden sm:table-cell">
                                            <code className="text-xs bg-slate-100 px-1.5 py-0.5 rounded">{tenant.slug}</code>
                                        </td>
                                        <td className="px-5 py-3 hidden md:table-cell">
                                            {tenant.custom_domain ? (
                                                <a href={`https://${tenant.custom_domain}`} target="_blank" rel="noopener noreferrer"
                                                    className="text-xs text-blue-600 hover:underline flex items-center gap-1">
                                                    {tenant.custom_domain}
                                                    <ExternalLink className="h-3 w-3" />
                                                </a>
                                            ) : (
                                                <span className="text-xs text-slate-400">{tenant.slug}.giaphadaiviet.vn</span>
                                            )}
                                        </td>
                                        <td className="px-5 py-3 text-center">
                                            <span className={`text-[10px] px-2 py-0.5 rounded-full font-medium ${planColors[tenant.plan]}`}>
                                                {tenant.plan}
                                            </span>
                                        </td>
                                        <td className="px-5 py-3 text-center">
                                            <span className="text-[10px] text-slate-500">
                                                {tenant.max_members === -1 ? '∞' : tenant.max_members} TV / {tenant.max_admins} QTV
                                            </span>
                                        </td>
                                        <td className="px-5 py-3 text-center">
                                            <button onClick={() => toggleActive(tenant)}
                                                className="text-slate-500 hover:text-slate-700">
                                                {tenant.is_active ? (
                                                    <ToggleRight className="h-5 w-5 text-emerald-500" />
                                                ) : (
                                                    <ToggleLeft className="h-5 w-5 text-slate-400" />
                                                )}
                                            </button>
                                        </td>
                                        <td className="px-5 py-3 text-right">
                                            <Link href={`/superadmin/tenants/${tenant.id}`}
                                                className="text-xs text-indigo-600 hover:text-indigo-800">
                                                Chi tiết →
                                            </Link>
                                        </td>
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                    </div>
                </div>
            )}
        </div>
    );
}

function CreateTenantForm({ onCreated, onCancel }: { onCreated: () => void; onCancel: () => void }) {
    const [slug, setSlug] = useState('');
    const [name, setName] = useState('');
    const [description, setDescription] = useState('');
    const [plan, setPlan] = useState('basic');
    const [saving, setSaving] = useState(false);
    const [error, setError] = useState('');

    const handleCreate = async () => {
        if (!slug || !name) {
            setError('Vui lòng điền đầy đủ slug và tên.');
            return;
        }
        setSaving(true);
        setError('');
        try {
            // Create tree first
            const { data: tree, error: treeErr } = await supabase
                .from('trees')
                .insert({ name, slug, description })
                .select()
                .single();
            if (treeErr) throw treeErr;

            // Plan limits
            const planLimits: Record<string, { max_members: number; max_admins: number; max_storage_gb: number }> = {
                free: { max_members: 50, max_admins: 1, max_storage_gb: 1 },
                basic: { max_members: 200, max_admins: 1, max_storage_gb: 2 },
                standard: { max_members: 500, max_admins: 2, max_storage_gb: 3 },
                premium: { max_members: 2000, max_admins: 5, max_storage_gb: 10 },
                pro: { max_members: 10000, max_admins: 10, max_storage_gb: 25 },
                enterprise: { max_members: -1, max_admins: 15, max_storage_gb: 50 },
            };
            const limits = planLimits[plan] || planLimits.basic;

            // Create tenant
            const { data: tenant, error: tenantErr } = await supabase
                .from('tenants')
                .insert({
                    slug, name, description,
                    tree_id: tree.id,
                    plan,
                    ...limits,
                })
                .select()
                .single();
            if (tenantErr) throw tenantErr;

            // Create default site_config
            await supabase.from('site_config').insert({
                tenant_id: tenant.id,
                site_name: name,
                description,
            });

            onCreated();
        } catch (e: unknown) {
            const msg = e instanceof Error ? e.message : 'Lỗi tạo gia phả';
            setError(msg);
        }
        setSaving(false);
    };

    return (
        <div className="bg-white border rounded-xl p-5 shadow-sm space-y-4">
            <h2 className="text-sm font-semibold text-slate-700 flex items-center gap-2">
                <Building2 className="h-4 w-4 text-slate-400" />
                Tạo gia phả mới
            </h2>

            {error && <p className="text-xs text-red-600 bg-red-50 px-3 py-2 rounded">{error}</p>}

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                    <label className="block text-xs font-medium text-slate-600 mb-1">Slug *</label>
                    <input type="text" value={slug} onChange={e => setSlug(e.target.value.toLowerCase().replace(/[^a-z0-9-]/g, ''))}
                        placeholder="ho-tran" className="w-full px-3 py-2 border rounded-lg text-sm outline-none focus:ring-2 focus:ring-indigo-500" />
                    <p className="text-[10px] text-slate-400 mt-1">{slug}.giaphadaiviet.vn</p>
                </div>
                <div>
                    <label className="block text-xs font-medium text-slate-600 mb-1">Tên gia phả *</label>
                    <input type="text" value={name} onChange={e => setName(e.target.value)}
                        placeholder="Gia phả họ Trần" className="w-full px-3 py-2 border rounded-lg text-sm outline-none focus:ring-2 focus:ring-indigo-500" />
                </div>
                <div>
                    <label className="block text-xs font-medium text-slate-600 mb-1">Mô tả</label>
                    <input type="text" value={description} onChange={e => setDescription(e.target.value)}
                        placeholder="Họ Trần - Thái Bình" className="w-full px-3 py-2 border rounded-lg text-sm outline-none focus:ring-2 focus:ring-indigo-500" />
                </div>
                <div>
                    <label className="block text-xs font-medium text-slate-600 mb-1">Gói dịch vụ</label>
                    <select value={plan} onChange={e => setPlan(e.target.value)}
                        className="w-full px-3 py-2 border rounded-lg text-sm outline-none focus:ring-2 focus:ring-indigo-500">
                        <option value="free">Miễn phí</option>
                        <option value="basic">Gói Cơ bản (500K/năm)</option>
                        <option value="standard">Gói Đoàn viên (1M/năm)</option>
                        <option value="premium">Gói Đồng tâm (2M/năm)</option>
                        <option value="pro">Gói Thịnh vượng (5M/năm)</option>
                        <option value="enterprise">Gói Bản sắc (10M/năm)</option>
                    </select>
                </div>
            </div>

            <div className="flex items-center gap-3 justify-end">
                <Button variant="outline" onClick={onCancel}>Hủy</Button>
                <Button onClick={handleCreate} disabled={saving}
                    className="bg-indigo-600 hover:bg-indigo-700 text-white gap-2">
                    {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : <Plus className="h-4 w-4" />}
                    Tạo gia phả
                </Button>
            </div>
        </div>
    );
}
