'use client';

import { useEffect, useState } from 'react';
import {
    Users, Search, Loader2, Shield, ShieldCheck,
} from 'lucide-react';
import { supabase } from '@/lib/supabase';

interface UserProfile {
    id: string;
    email: string;
    display_name: string | null;
    role: string;
    is_superadmin: boolean;
    created_at: string;
}

export default function SuperadminUsersPage() {
    const [users, setUsers] = useState<UserProfile[]>([]);
    const [loading, setLoading] = useState(true);
    const [search, setSearch] = useState('');

    const fetchUsers = async () => {
        const { data } = await supabase
            .from('profiles')
            .select('id, email, display_name, role, is_superadmin, created_at')
            .order('created_at', { ascending: true });
        setUsers((data || []) as UserProfile[]);
        setLoading(false);
    };

    useEffect(() => { fetchUsers(); }, []);

    const toggleSuperadmin = async (user: UserProfile) => {
        await supabase
            .from('profiles')
            .update({ is_superadmin: !user.is_superadmin })
            .eq('id', user.id);
        fetchUsers();
    };

    const filtered = users.filter(u =>
        (u.email || '').toLowerCase().includes(search.toLowerCase()) ||
        (u.display_name || '').toLowerCase().includes(search.toLowerCase())
    );

    return (
        <div className="max-w-6xl mx-auto space-y-6">
            <div>
                <h1 className="text-2xl font-bold text-slate-800">Quản lý Users</h1>
                <p className="text-sm text-slate-500 mt-1">Tất cả tài khoản trên nền tảng ({users.length} users)</p>
            </div>

            {/* Search */}
            <div className="relative">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400" />
                <input type="text" value={search} onChange={e => setSearch(e.target.value)}
                    placeholder="Tìm theo email hoặc tên..."
                    className="w-full pl-10 pr-4 py-2.5 border rounded-lg text-sm focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 outline-none" />
            </div>

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
                                    <th className="text-left px-5 py-3 text-xs font-medium text-slate-500">User</th>
                                    <th className="text-left px-5 py-3 text-xs font-medium text-slate-500 hidden sm:table-cell">Email</th>
                                    <th className="text-center px-5 py-3 text-xs font-medium text-slate-500">Role</th>
                                    <th className="text-center px-5 py-3 text-xs font-medium text-slate-500">Superadmin</th>
                                    <th className="text-right px-5 py-3 text-xs font-medium text-slate-500 hidden md:table-cell">Ngày tạo</th>
                                </tr>
                            </thead>
                            <tbody>
                                {filtered.map(user => (
                                    <tr key={user.id} className="border-b hover:bg-slate-50 transition-colors">
                                        <td className="px-5 py-3">
                                            <div className="flex items-center gap-2">
                                                <div className="w-7 h-7 rounded-full bg-gradient-to-br from-indigo-100 to-purple-100 flex items-center justify-center shrink-0">
                                                    <span className="text-[10px] font-bold text-indigo-700">
                                                        {(user.display_name || user.email)[0].toUpperCase()}
                                                    </span>
                                                </div>
                                                <span className="font-medium text-slate-800">
                                                    {user.display_name || user.email.split('@')[0]}
                                                </span>
                                            </div>
                                        </td>
                                        <td className="px-5 py-3 hidden sm:table-cell text-slate-500 text-xs">
                                            {user.email}
                                        </td>
                                        <td className="px-5 py-3 text-center">
                                            <span className={`text-[10px] px-2 py-0.5 rounded-full font-medium ${
                                                user.role === 'admin' ? 'bg-red-100 text-red-700' :
                                                user.role === 'editor' ? 'bg-blue-100 text-blue-700' :
                                                'bg-slate-100 text-slate-600'
                                            }`}>
                                                {user.role}
                                            </span>
                                        </td>
                                        <td className="px-5 py-3 text-center">
                                            <button onClick={() => toggleSuperadmin(user)}
                                                className="inline-flex items-center gap-1">
                                                {user.is_superadmin ? (
                                                    <ShieldCheck className="h-4 w-4 text-red-500" />
                                                ) : (
                                                    <Shield className="h-4 w-4 text-slate-300" />
                                                )}
                                            </button>
                                        </td>
                                        <td className="px-5 py-3 text-right text-xs text-slate-400 hidden md:table-cell">
                                            {new Date(user.created_at).toLocaleDateString('vi-VN')}
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
