'use client';

import { useEffect, useState, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import {
    Contact, Search, Phone, Mail, MapPin, User, LogIn, Lock,
    Briefcase, MessageCircle, ExternalLink, Users, UserCheck,
} from 'lucide-react';
import { Input } from '@/components/ui/input';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { supabase } from '@/lib/supabase';
import { useAuth } from '@/components/auth-provider';

// ─── Types ────────────────────────────────────────────────────────
interface DirectoryMember {
    id: string;
    email: string;
    display_name: string | null;
    avatar_url: string | null;
    role: string;
    status: string;
    created_at: string;
}

interface GenealogyContact {
    handle: string;
    displayName: string;
    gender: number;
    generation: number;
    isLiving: boolean;
    phone?: string;
    email?: string;
    zalo?: string;
    facebook?: string;
    currentAddress?: string;
    occupation?: string;
    company?: string;
}

// Map snake_case DB row to camelCase
function dbRowToContact(row: Record<string, unknown>): GenealogyContact {
    return {
        handle: row.handle as string,
        displayName: row.display_name as string,
        gender: row.gender as number,
        generation: row.generation as number,
        isLiving: row.is_living as boolean,
        phone: row.phone as string | undefined,
        email: row.email as string | undefined,
        zalo: row.zalo as string | undefined,
        facebook: row.facebook as string | undefined,
        currentAddress: row.current_address as string | undefined,
        occupation: row.occupation as string | undefined,
        company: row.company as string | undefined,
    };
}

// ─── Main Page ──────────────────────────────────────────────────
export default function DirectoryPage() {
    const router = useRouter();
    const { isLoggedIn, loading: authLoading } = useAuth();
    const [members, setMembers] = useState<DirectoryMember[]>([]);
    const [contacts, setContacts] = useState<GenealogyContact[]>([]);
    const [loading, setLoading] = useState(true);
    const [search, setSearch] = useState('');
    const [tab, setTab] = useState('contacts');

    const fetchData = useCallback(async () => {
        if (!isLoggedIn) return;
        setLoading(true);
        try {
            const [profilesRes, peopleRes] = await Promise.all([
                supabase
                    .from('profiles')
                    .select('*')
                    .eq('status', 'active')
                    .order('created_at', { ascending: true }),
                supabase
                    .from('people')
                    .select('handle, display_name, gender, generation, is_living, phone, email, zalo, facebook, current_address, occupation, company')
                    .order('generation', { ascending: true })
                    .order('display_name', { ascending: true }),
            ]);
            if (profilesRes.data) setMembers(profilesRes.data);
            if (peopleRes.data) {
                // Show all living people (contact info may be added later)
                const mapped = (peopleRes.data as Record<string, unknown>[]).map(dbRowToContact);
                setContacts(mapped.filter((p) => p.isLiving));
            }
        } catch { /* ignore */ }
        finally { setLoading(false); }
    }, [isLoggedIn]);

    useEffect(() => { fetchData(); }, [fetchData]);

    // Auth loading
    if (authLoading) {
        return (
            <div className="flex items-center justify-center h-[60vh]">
                <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary" />
            </div>
        );
    }

    // Not logged in
    if (!isLoggedIn) {
        return (
            <div className="flex flex-col items-center justify-center h-[60vh] space-y-6">
                <div className="h-20 w-20 rounded-full bg-muted flex items-center justify-center">
                    <Lock className="h-10 w-10 text-muted-foreground" />
                </div>
                <div className="text-center space-y-2">
                    <h2 className="text-xl font-semibold">Yêu cầu đăng nhập</h2>
                    <p className="text-muted-foreground max-w-sm">
                        Danh bạ chứa thông tin cá nhân của các thành viên. Vui lòng đăng nhập để xem.
                    </p>
                </div>
                <Button onClick={() => router.push('/login')} className="gap-2">
                    <LogIn className="h-4 w-4" />
                    Đăng nhập
                </Button>
            </div>
        );
    }

    // Filter logic
    const q = search.toLowerCase();
    const filteredContacts = contacts.filter((c) =>
        c.displayName.toLowerCase().includes(q) ||
        (c.phone || '').includes(q) ||
        (c.email || '').toLowerCase().includes(q) ||
        (c.currentAddress || '').toLowerCase().includes(q) ||
        (c.occupation || '').toLowerCase().includes(q)
    );
    const filteredMembers = members.filter((m) =>
        (m.display_name || '').toLowerCase().includes(q) ||
        m.email.toLowerCase().includes(q)
    );

    const getRoleBadge = (role: string) => {
        const colors: Record<string, string> = {
            admin: 'bg-red-100 text-red-800 dark:bg-red-900/30 dark:text-red-400',
            editor: 'bg-blue-100 text-blue-800 dark:bg-blue-900/30 dark:text-blue-400',
            member: 'bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-400',
            viewer: 'bg-gray-100 text-gray-700 dark:bg-gray-800/50 dark:text-gray-400',
        };
        return <Badge variant="secondary" className={colors[role] || ''}>{role}</Badge>;
    };

    return (
        <div className="space-y-6">
            <div>
                <h1 className="text-2xl font-bold tracking-tight flex items-center gap-2">
                    <Contact className="h-6 w-6" />
                    Danh bạ
                </h1>
                <p className="text-muted-foreground">Thông tin liên lạc thành viên dòng họ</p>
            </div>

            <div className="flex flex-col sm:flex-row gap-3 sm:items-center">
                <div className="relative flex-1 sm:max-w-sm">
                    <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                    <Input
                        placeholder="Tìm theo tên, SĐT, email, địa chỉ..."
                        value={search}
                        onChange={(e) => setSearch(e.target.value)}
                        className="pl-9"
                    />
                </div>
            </div>

            <Tabs value={tab} onValueChange={setTab}>
                <TabsList>
                    <TabsTrigger value="contacts" className="gap-1.5">
                        <Users className="h-4 w-4" />
                        Gia phả ({contacts.length})
                    </TabsTrigger>
                    <TabsTrigger value="accounts" className="gap-1.5">
                        <UserCheck className="h-4 w-4" />
                        Tài khoản ({members.length})
                    </TabsTrigger>
                </TabsList>

                {/* ── Tab 1: Genealogy Contacts ── */}
                <TabsContent value="contacts" className="mt-4">
                    {loading ? (
                        <div className="flex items-center justify-center h-48">
                            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary" />
                        </div>
                    ) : filteredContacts.length === 0 ? (
                        <Card>
                            <CardContent className="flex flex-col items-center justify-center py-12">
                                <Contact className="h-12 w-12 text-muted-foreground mb-4" />
                                <p className="text-muted-foreground">
                                    {search ? 'Không tìm thấy kết quả' : 'Chưa có thông tin liên lạc nào'}
                                </p>
                            </CardContent>
                        </Card>
                    ) : (
                        <div className="grid gap-3 md:grid-cols-2 lg:grid-cols-3">
                            {filteredContacts.map((c) => (
                                <Card key={c.handle} className="hover:shadow-md transition-shadow">
                                    <CardContent className="p-4">
                                        <div className="flex items-start gap-3 mb-3">
                                            <div className={`h-10 w-10 rounded-full flex items-center justify-center shrink-0 ${
                                                c.gender === 1 ? 'bg-blue-100 dark:bg-blue-900/30' : 'bg-pink-100 dark:bg-pink-900/30'
                                            }`}>
                                                <User className={`h-5 w-5 ${
                                                    c.gender === 1 ? 'text-blue-600 dark:text-blue-400' : 'text-pink-600 dark:text-pink-400'
                                                }`} />
                                            </div>
                                            <div className="flex-1 min-w-0">
                                                <p className="font-medium truncate">{c.displayName}</p>
                                                <div className="flex items-center gap-2 text-xs text-muted-foreground">
                                                    <span>Đời {c.generation}</span>
                                                    {c.occupation && (
                                                        <>
                                                            <span>·</span>
                                                            <span className="truncate">{c.occupation}</span>
                                                        </>
                                                    )}
                                                </div>
                                            </div>
                                        </div>

                                        <div className="space-y-1.5 text-sm">
                                            {c.phone && (
                                                <a href={`tel:${c.phone}`} className="flex items-center gap-2 text-muted-foreground hover:text-foreground transition-colors">
                                                    <Phone className="h-3.5 w-3.5 shrink-0" />
                                                    <span className="truncate">{c.phone}</span>
                                                </a>
                                            )}
                                            {c.email && (
                                                <a href={`mailto:${c.email}`} className="flex items-center gap-2 text-muted-foreground hover:text-foreground transition-colors">
                                                    <Mail className="h-3.5 w-3.5 shrink-0" />
                                                    <span className="truncate">{c.email}</span>
                                                </a>
                                            )}
                                            {c.zalo && (
                                                <div className="flex items-center gap-2 text-muted-foreground">
                                                    <MessageCircle className="h-3.5 w-3.5 shrink-0" />
                                                    <span className="truncate">Zalo: {c.zalo}</span>
                                                </div>
                                            )}
                                            {c.facebook && (
                                                <a href={c.facebook.startsWith('http') ? c.facebook : `https://facebook.com/${c.facebook}`} target="_blank" rel="noopener noreferrer" className="flex items-center gap-2 text-muted-foreground hover:text-foreground transition-colors">
                                                    <ExternalLink className="h-3.5 w-3.5 shrink-0" />
                                                    <span className="truncate">Facebook</span>
                                                </a>
                                            )}
                                            {c.currentAddress && (
                                                <div className="flex items-start gap-2 text-muted-foreground">
                                                    <MapPin className="h-3.5 w-3.5 shrink-0 mt-0.5" />
                                                    <span className="line-clamp-2">{c.currentAddress}</span>
                                                </div>
                                            )}
                                            {c.company && (
                                                <div className="flex items-center gap-2 text-muted-foreground">
                                                    <Briefcase className="h-3.5 w-3.5 shrink-0" />
                                                    <span className="truncate">{c.company}</span>
                                                </div>
                                            )}
                                            {!c.phone && !c.email && !c.zalo && !c.facebook && !c.currentAddress && !c.company && (
                                                <p className="text-xs text-muted-foreground/60 italic">Chưa cập nhật thông tin liên lạc</p>
                                            )}
                                        </div>
                                    </CardContent>
                                </Card>
                            ))}
                        </div>
                    )}
                </TabsContent>

                {/* ── Tab 2: Registered Accounts ── */}
                <TabsContent value="accounts" className="mt-4">
                    {loading ? (
                        <div className="flex items-center justify-center h-48">
                            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary" />
                        </div>
                    ) : filteredMembers.length === 0 ? (
                        <Card>
                            <CardContent className="flex flex-col items-center justify-center py-12">
                                <UserCheck className="h-12 w-12 text-muted-foreground mb-4" />
                                <p className="text-muted-foreground">Chưa có thành viên nào</p>
                            </CardContent>
                        </Card>
                    ) : (
                        <div className="grid gap-3 md:grid-cols-2 lg:grid-cols-3">
                            {filteredMembers.map((m) => (
                                <Card key={m.id} className="hover:shadow-md transition-shadow cursor-pointer" onClick={() => router.push(`/directory/${m.id}`)}>
                                    <CardContent className="p-4">
                                        <div className="flex items-center gap-3">
                                            <div className="h-10 w-10 rounded-full bg-primary/10 flex items-center justify-center">
                                                <User className="h-5 w-5 text-primary" />
                                            </div>
                                            <div className="flex-1 min-w-0">
                                                <p className="font-medium truncate">{m.display_name || m.email.split('@')[0]}</p>
                                                <p className="text-xs text-muted-foreground truncate">{m.email}</p>
                                            </div>
                                            {getRoleBadge(m.role)}
                                        </div>
                                    </CardContent>
                                </Card>
                            ))}
                        </div>
                    )}
                </TabsContent>
            </Tabs>
        </div>
    );
}
