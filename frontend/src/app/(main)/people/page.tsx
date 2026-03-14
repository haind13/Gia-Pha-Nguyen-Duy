'use client';

import { useEffect, useState, useMemo } from 'react';
import { Users, Search, ChevronRight } from 'lucide-react';
import { Input } from '@/components/ui/input';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { useAuth } from '@/components/auth-provider';
import Link from 'next/link';
import { RequireAuth } from '@/components/require-auth';

interface Person {
    id: string;
    displayName: string;
    gender: number;
    birthYear?: number;
    deathYear?: number;
    isLiving: boolean;
    isPrivacyFiltered: boolean;
    generation: number;
}

export default function PeopleListPage() {
    const [people, setPeople] = useState<Person[]>([]);
    const [loading, setLoading] = useState(true);
    const [search, setSearch] = useState('');
    const [genderFilter, setGenderFilter] = useState<number | null>(null);
    const [livingFilter, setLivingFilter] = useState<boolean | null>(null);
    const { isLoggedIn, loading: authLoading } = useAuth();

    useEffect(() => {
        const fetchPeople = async () => {
            try {
                const { supabase } = await import('@/lib/supabase');
                const { data, error } = await supabase
                    .from('people')
                    .select('id, display_name, gender, birth_year, death_year, is_living, is_privacy_filtered, generation')
                    .order('generation', { ascending: true })
                    .order('display_name', { ascending: true });
                if (!error && data) {
                    setPeople(data.map((row: Record<string, unknown>) => ({
                        id: row.id as string,
                        displayName: row.display_name as string,
                        gender: row.gender as number,
                        birthYear: row.birth_year as number | undefined,
                        deathYear: row.death_year as number | undefined,
                        isLiving: row.is_living as boolean,
                        isPrivacyFiltered: row.is_privacy_filtered as boolean,
                        generation: (row.generation as number) || 0,
                    })));
                }
            } catch { /* ignore */ }
            setLoading(false);
        };
        fetchPeople();
    }, []);

    // Auth guard
    if (!authLoading && !isLoggedIn) {
        return <RequireAuth>{null}</RequireAuth>;
    }

    const filtered = people.filter((p) => {
        if (search && !p.displayName.toLowerCase().includes(search.toLowerCase())) return false;
        if (genderFilter !== null && p.gender !== genderFilter) return false;
        if (livingFilter !== null && p.isLiving !== livingFilter) return false;
        return true;
    });

    // Group by generation
    const grouped = useMemo(() => {
        const map = new Map<number, Person[]>();
        for (const p of filtered) {
            const gen = p.generation || 0;
            if (!map.has(gen)) map.set(gen, []);
            map.get(gen)!.push(p);
        }
        // Sort generations ascending
        return Array.from(map.entries()).sort(([a], [b]) => a - b);
    }, [filtered]);

    return (
        <div className="space-y-6">
            <div>
                <h1 className="text-2xl font-bold tracking-tight flex items-center gap-2">
                    <Users className="h-6 w-6" />
                    Thành viên gia phả
                </h1>
                <p className="text-muted-foreground">{people.length} người trong gia phả</p>
            </div>

            {/* Filters */}
            <div className="flex flex-wrap gap-2 sm:gap-3 items-center">
                <div className="relative w-full sm:flex-1 sm:min-w-[200px] sm:max-w-sm">
                    <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                    <Input placeholder="Tìm theo tên..." value={search} onChange={(e) => setSearch(e.target.value)} className="pl-9" />
                </div>
                <div className="flex gap-1.5 sm:gap-2 flex-wrap">
                    <Button variant={genderFilter === null ? 'default' : 'outline'} size="sm" className="h-8 text-xs sm:text-sm" onClick={() => setGenderFilter(null)}>Tất cả</Button>
                    <Button variant={genderFilter === 1 ? 'default' : 'outline'} size="sm" className="h-8 text-xs sm:text-sm" onClick={() => setGenderFilter(1)}>Nam</Button>
                    <Button variant={genderFilter === 2 ? 'default' : 'outline'} size="sm" className="h-8 text-xs sm:text-sm" onClick={() => setGenderFilter(2)}>Nữ</Button>
                </div>
                <div className="flex gap-1.5 sm:gap-2 flex-wrap">
                    <Button variant={livingFilter === null ? 'default' : 'outline'} size="sm" className="h-8 text-xs sm:text-sm" onClick={() => setLivingFilter(null)}>Tất cả</Button>
                    <Button variant={livingFilter === true ? 'default' : 'outline'} size="sm" className="h-8 text-xs sm:text-sm" onClick={() => setLivingFilter(true)}>Còn sống</Button>
                    <Button variant={livingFilter === false ? 'default' : 'outline'} size="sm" className="h-8 text-xs sm:text-sm" onClick={() => setLivingFilter(false)}>Đã mất</Button>
                </div>
            </div>

            {/* Members grouped by generation */}
            {loading ? (
                <div className="flex items-center justify-center h-48">
                    <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary" />
                </div>
            ) : filtered.length === 0 ? (
                <Card>
                    <CardContent className="py-12 text-center text-muted-foreground">
                        {search ? 'Không tìm thấy kết quả' : 'Chưa có dữ liệu gia phả'}
                    </CardContent>
                </Card>
            ) : (
                <div className="space-y-4">
                    {grouped.map(([gen, members]) => (
                        <Card key={gen}>
                            <CardContent className="p-0">
                                {/* Generation header */}
                                <div className="px-4 py-2.5 border-b border-slate-100 dark:border-slate-800 bg-slate-50/50 dark:bg-slate-800/30 flex items-center justify-between">
                                    <h3 className="text-sm font-semibold text-slate-700 dark:text-slate-200">
                                        {gen > 0 ? `Đời thứ ${gen}` : 'Chưa xác định đời'}
                                    </h3>
                                    <Badge variant="secondary" className="text-xs">{members.length} người</Badge>
                                </div>
                                {/* Member list */}
                                <div className="divide-y divide-slate-100 dark:divide-slate-800">
                                    {members.map((p) => (
                                        <Link
                                            key={p.id}
                                            href={`/people/${p.id}`}
                                            className="flex items-center px-4 py-3 gap-3 hover:bg-accent/50 transition-colors group"
                                        >
                                            {/* Avatar */}
                                            <div className={`w-9 h-9 rounded-full flex items-center justify-center text-sm font-bold shrink-0
                                                ${p.gender === 1 ? 'bg-blue-100 text-blue-700 dark:bg-blue-900 dark:text-blue-300' : 'bg-pink-100 text-pink-700 dark:bg-pink-900 dark:text-pink-300'}`}>
                                                {p.displayName.split(' ').pop()?.[0] || '?'}
                                            </div>
                                            {/* Name + info */}
                                            <div className="flex-1 min-w-0">
                                                <p className="font-medium text-sm truncate">
                                                    {p.displayName}
                                                    {p.isPrivacyFiltered && <span className="ml-1 text-amber-500">🔒</span>}
                                                </p>
                                                <div className="flex items-center gap-2 text-xs text-muted-foreground mt-0.5">
                                                    <Badge variant="outline" className="text-[10px] px-1.5 py-0">
                                                        {p.gender === 1 ? 'Nam' : p.gender === 2 ? 'Nữ' : '?'}
                                                    </Badge>
                                                    <span>{p.birthYear || '—'}{p.deathYear ? ` – ${p.deathYear}` : ''}</span>
                                                    {!p.isLiving && <span className="text-slate-400">✝</span>}
                                                </div>
                                            </div>
                                            {/* Arrow */}
                                            <ChevronRight className="h-4 w-4 text-muted-foreground shrink-0 opacity-0 group-hover:opacity-100 transition-opacity" />
                                        </Link>
                                    ))}
                                </div>
                            </CardContent>
                        </Card>
                    ))}
                </div>
            )}
        </div>
    );
}
