'use client';

import { useEffect, useState, useMemo } from 'react';
import { BarChart3, Users, Heart, Baby, Calendar, MapPin, Briefcase, Loader2, Crown } from 'lucide-react';
import { supabase } from '@/lib/supabase';

interface Person {
    id: string;
    display_name: string;
    gender: number;
    generation: number;
    birth_year: number | null;
    death_year: number | null;
    is_living: boolean;
    is_patrilineal: boolean;
    birth_order: number | null;
    occupation: string | null;
    current_address: string | null;
}

interface Family {
    id: string;
    father_id: string | null;
    mother_id: string | null;
    child_ids: string[];
}

const CURRENT_YEAR = new Date().getFullYear();

export default function ThongKePage() {
    const [people, setPeople] = useState<Person[]>([]);
    const [families, setFamilies] = useState<Family[]>([]);
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        const fetchData = async () => {
            setLoading(true);
            try {
                const [pRes, fRes] = await Promise.all([
                    supabase
                        .from('people_safe')
                        .select('id, display_name, gender, generation, birth_year, death_year, is_living, is_patrilineal, birth_order, occupation, current_address')
                        .order('generation', { ascending: true }),
                    supabase
                        .from('families')
                        .select('id, father_id, mother_id, child_ids'),
                ]);
                if (pRes.data) setPeople(pRes.data);
                if (fRes.data) setFamilies(fRes.data);
            } catch { /* ignore */ }
            setLoading(false);
        };
        fetchData();
    }, []);

    const stats = useMemo(() => {
        if (!people.length) return null;

        const total = people.length;
        const generations = [...new Set(people.map(p => p.generation))].sort((a, b) => a - b);
        const totalGenerations = generations.length;
        const livingCount = people.filter(p => p.is_living).length;
        const deceasedCount = total - livingCount;
        const maleCount = people.filter(p => p.gender === 1).length;
        const femaleCount = people.filter(p => p.gender === 2).length;
        const patrilinealCount = people.filter(p => p.is_patrilineal).length;

        // Per generation distribution
        const genMap = new Map<number, number>();
        for (const p of people) {
            genMap.set(p.generation, (genMap.get(p.generation) || 0) + 1);
        }
        const perGeneration = generations.map(g => ({ gen: g, count: genMap.get(g) || 0 }));
        const maxGenCount = Math.max(...perGeneration.map(g => g.count));
        const busiestGen = perGeneration.reduce((a, b) => a.count > b.count ? a : b);

        // Average age at death
        const deceasedWithYears = people.filter(p => !p.is_living && p.birth_year && p.death_year);
        const avgDeathAge = deceasedWithYears.length > 0
            ? Math.round(deceasedWithYears.reduce((sum, p) => sum + (p.death_year! - p.birth_year!), 0) / deceasedWithYears.length)
            : null;

        // Average age of living people
        const livingWithBirth = people.filter(p => p.is_living && p.birth_year);
        const avgLivingAge = livingWithBirth.length > 0
            ? Math.round(livingWithBirth.reduce((sum, p) => sum + (CURRENT_YEAR - p.birth_year!), 0) / livingWithBirth.length)
            : null;

        // Family statistics
        const familiesWithChildren = families.filter(f => f.child_ids && f.child_ids.length > 0);
        const avgChildren = familiesWithChildren.length > 0
            ? (familiesWithChildren.reduce((sum, f) => sum + f.child_ids.length, 0) / familiesWithChildren.length).toFixed(1)
            : '0';

        // Largest family
        const personMap = new Map(people.map(p => [p.id, p]));
        let largestFamily: { father?: string; mother?: string; count: number } | null = null;
        for (const f of familiesWithChildren) {
            if (!largestFamily || f.child_ids.length > largestFamily.count) {
                largestFamily = {
                    father: f.father_id ? personMap.get(f.father_id)?.display_name : undefined,
                    mother: f.mother_id ? personMap.get(f.mother_id)?.display_name : undefined,
                    count: f.child_ids.length,
                };
            }
        }

        // Top 5 largest families
        const top5Families = [...familiesWithChildren]
            .sort((a, b) => b.child_ids.length - a.child_ids.length)
            .slice(0, 5)
            .map(f => ({
                father: f.father_id ? personMap.get(f.father_id)?.display_name : undefined,
                mother: f.mother_id ? personMap.get(f.mother_id)?.display_name : undefined,
                count: f.child_ids.length,
            }));

        // Top occupations
        const occMap = new Map<string, number>();
        for (const p of people) {
            if (p.occupation) {
                const occ = p.occupation.trim();
                if (occ) occMap.set(occ, (occMap.get(occ) || 0) + 1);
            }
        }
        const topOccupations = [...occMap.entries()]
            .sort((a, b) => b[1] - a[1])
            .slice(0, 5);

        // Top addresses (extract province/city)
        const addrMap = new Map<string, number>();
        for (const p of people) {
            if (p.current_address) {
                // Take last part (usually province/city)
                const parts = p.current_address.split(',').map(s => s.trim());
                const key = parts[parts.length - 1] || p.current_address.trim();
                if (key) addrMap.set(key, (addrMap.get(key) || 0) + 1);
            }
        }
        const topAddresses = [...addrMap.entries()]
            .sort((a, b) => b[1] - a[1])
            .slice(0, 5);

        // Oldest living person
        const oldestLiving = livingWithBirth
            .sort((a, b) => (a.birth_year || 9999) - (b.birth_year || 9999))[0];

        // Youngest generation
        const youngestGen = generations[generations.length - 1];

        return {
            total, totalGenerations, livingCount, deceasedCount, maleCount, femaleCount,
            patrilinealCount, perGeneration, maxGenCount, busiestGen,
            avgDeathAge, avgLivingAge, avgChildren, largestFamily, top5Families,
            topOccupations, topAddresses, oldestLiving, youngestGen,
        };
    }, [people, families]);

    if (loading) {
        return (
            <div className="flex items-center justify-center h-[60vh]">
                <div className="flex flex-col items-center gap-3">
                    <Loader2 className="h-8 w-8 animate-spin text-amber-500" />
                    <span className="text-sm text-muted-foreground">Đang tải dữ liệu thống kê...</span>
                </div>
            </div>
        );
    }

    if (!stats) {
        return (
            <div className="flex items-center justify-center h-[60vh]">
                <p className="text-muted-foreground">Không có dữ liệu</p>
            </div>
        );
    }

    return (
        <div className="max-w-5xl mx-auto px-4 py-6 space-y-6">
            {/* Header */}
            <div className="flex items-center gap-3">
                <div className="rounded-xl bg-gradient-to-br from-amber-100 to-orange-100 p-3">
                    <BarChart3 className="h-7 w-7 text-amber-700" />
                </div>
                <div>
                    <h1 className="text-2xl font-bold text-slate-800">Thống kê Gia phả</h1>
                    <p className="text-sm text-muted-foreground">{stats.total} thành viên · {stats.totalGenerations} thế hệ</p>
                </div>
            </div>

            {/* Overview cards */}
            <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3">
                <StatCard label="Tổng thành viên" value={stats.total} icon={<Users className="h-4 w-4" />} color="blue" />
                <StatCard label="Thế hệ" value={stats.totalGenerations} icon={<Crown className="h-4 w-4" />} color="amber" />
                <StatCard label="Còn sống" value={stats.livingCount} icon={<Heart className="h-4 w-4" />} color="emerald" />
                <StatCard label="Đã mất" value={stats.deceasedCount} icon={<Calendar className="h-4 w-4" />} color="slate" />
                <StatCard label="Nam" value={stats.maleCount} icon={<span className="text-xs font-bold">♂</span>} color="indigo" />
                <StatCard label="Nữ" value={stats.femaleCount} icon={<span className="text-xs font-bold">♀</span>} color="rose" />
            </div>

            {/* Generation distribution */}
            <div className="bg-white border rounded-xl p-4 shadow-sm">
                <h2 className="text-sm font-semibold text-slate-700 mb-3">Phân bố theo đời</h2>
                <div className="space-y-1.5">
                    {stats.perGeneration.map(({ gen, count }) => (
                        <div key={gen} className="flex items-center gap-2 text-xs">
                            <span className="w-8 text-right text-slate-500 font-mono font-medium">Đ{gen}</span>
                            <div className="flex-1 h-5 bg-slate-100 rounded overflow-hidden">
                                <div
                                    className="h-full bg-gradient-to-r from-amber-400 to-orange-500 rounded transition-all flex items-center"
                                    style={{ width: `${(count / stats.maxGenCount) * 100}%`, minWidth: count > 0 ? '20px' : '0' }}
                                >
                                    <span className="px-1.5 text-[10px] font-bold text-white drop-shadow-sm">{count}</span>
                                </div>
                            </div>
                        </div>
                    ))}
                </div>
                <p className="text-[10px] text-muted-foreground mt-2">
                    Đời đông nhất: Đời {stats.busiestGen.gen} ({stats.busiestGen.count} người)
                </p>
            </div>

            {/* Key metrics */}
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
                {/* Age stats */}
                <div className="bg-white border rounded-xl p-4 shadow-sm">
                    <h3 className="text-xs font-semibold text-slate-500 uppercase tracking-wider mb-3">Tuổi thọ</h3>
                    <div className="space-y-3">
                        {stats.avgDeathAge !== null && (
                            <div>
                                <p className="text-2xl font-bold text-slate-800">{stats.avgDeathAge} <span className="text-sm font-normal text-slate-500">tuổi</span></p>
                                <p className="text-[11px] text-slate-500">Tuổi TB khi mất ({people.filter(p => !p.is_living && p.birth_year && p.death_year).length} người có đủ dữ liệu)</p>
                            </div>
                        )}
                        {stats.avgLivingAge !== null && (
                            <div>
                                <p className="text-2xl font-bold text-emerald-600">{stats.avgLivingAge} <span className="text-sm font-normal text-slate-500">tuổi</span></p>
                                <p className="text-[11px] text-slate-500">Tuổi TB người sống ({people.filter(p => p.is_living && p.birth_year).length} người)</p>
                            </div>
                        )}
                        {stats.oldestLiving && (
                            <div className="pt-2 border-t">
                                <p className="text-xs text-slate-500">Cao tuổi nhất (còn sống)</p>
                                <p className="text-sm font-semibold text-slate-800">{stats.oldestLiving.display_name}</p>
                                <p className="text-[11px] text-slate-500">{CURRENT_YEAR - stats.oldestLiving.birth_year!} tuổi · Đời {stats.oldestLiving.generation}</p>
                            </div>
                        )}
                    </div>
                </div>

                {/* Family stats */}
                <div className="bg-white border rounded-xl p-4 shadow-sm">
                    <h3 className="text-xs font-semibold text-slate-500 uppercase tracking-wider mb-3">Gia đình</h3>
                    <div className="space-y-3">
                        <div>
                            <p className="text-2xl font-bold text-slate-800">{stats.avgChildren} <span className="text-sm font-normal text-slate-500">con/gia đình</span></p>
                            <p className="text-[11px] text-slate-500">Số con trung bình ({families.filter(f => f.child_ids?.length > 0).length} gia đình có con)</p>
                        </div>
                        {stats.largestFamily && (
                            <div className="pt-2 border-t">
                                <p className="text-xs text-slate-500">Gia đình đông con nhất</p>
                                <p className="text-sm font-semibold text-slate-800">
                                    {stats.largestFamily.father || stats.largestFamily.mother}
                                    {stats.largestFamily.father && stats.largestFamily.mother && (
                                        <span className="text-slate-400 font-normal"> & {stats.largestFamily.mother}</span>
                                    )}
                                </p>
                                <p className="text-[11px] text-amber-600 font-medium">{stats.largestFamily.count} người con</p>
                            </div>
                        )}
                        <div className="pt-2 border-t">
                            <p className="text-xs text-slate-500">Nội tộc vs Ngoại tộc</p>
                            <div className="flex items-center gap-2 mt-1">
                                <div className="flex-1 h-3 bg-slate-100 rounded-full overflow-hidden flex">
                                    <div className="h-full bg-indigo-500 rounded-l-full" style={{ width: `${(stats.patrilinealCount / stats.total) * 100}%` }} />
                                    <div className="h-full bg-rose-400 rounded-r-full" style={{ width: `${((stats.total - stats.patrilinealCount) / stats.total) * 100}%` }} />
                                </div>
                            </div>
                            <div className="flex justify-between text-[10px] text-slate-500 mt-0.5">
                                <span>Nội tộc: {stats.patrilinealCount} ({Math.round(stats.patrilinealCount / stats.total * 100)}%)</span>
                                <span>Ngoại tộc: {stats.total - stats.patrilinealCount}</span>
                            </div>
                        </div>
                    </div>
                </div>

                {/* Gender + Living */}
                <div className="bg-white border rounded-xl p-4 shadow-sm">
                    <h3 className="text-xs font-semibold text-slate-500 uppercase tracking-wider mb-3">Giới tính & Tình trạng</h3>
                    <div className="space-y-3">
                        {/* Gender bar */}
                        <div>
                            <div className="flex items-center gap-2">
                                <div className="flex-1 h-6 bg-slate-100 rounded-full overflow-hidden flex">
                                    <div className="h-full bg-indigo-500 rounded-l-full flex items-center justify-center"
                                        style={{ width: `${(stats.maleCount / stats.total) * 100}%` }}>
                                        <span className="text-[9px] font-bold text-white">♂ {stats.maleCount}</span>
                                    </div>
                                    <div className="h-full bg-rose-400 rounded-r-full flex items-center justify-center"
                                        style={{ width: `${(stats.femaleCount / stats.total) * 100}%` }}>
                                        <span className="text-[9px] font-bold text-white">♀ {stats.femaleCount}</span>
                                    </div>
                                </div>
                            </div>
                            <p className="text-[10px] text-slate-500 mt-1">Tỷ lệ nam/nữ: {(stats.maleCount / Math.max(stats.femaleCount, 1)).toFixed(1)}:1</p>
                        </div>
                        {/* Living bar */}
                        <div className="pt-2 border-t">
                            <div className="flex items-center gap-2">
                                <div className="flex-1 h-6 bg-slate-100 rounded-full overflow-hidden flex">
                                    <div className="h-full bg-emerald-500 rounded-l-full flex items-center justify-center"
                                        style={{ width: `${(stats.livingCount / stats.total) * 100}%` }}>
                                        <span className="text-[9px] font-bold text-white">{stats.livingCount} sống</span>
                                    </div>
                                    <div className="h-full bg-slate-400 rounded-r-full flex items-center justify-center"
                                        style={{ width: `${(stats.deceasedCount / stats.total) * 100}%` }}>
                                        <span className="text-[9px] font-bold text-white">{stats.deceasedCount} mất</span>
                                    </div>
                                </div>
                            </div>
                        </div>
                    </div>
                </div>
            </div>

            {/* Bottom section: Top lists */}
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
                {/* Top 5 families */}
                <div className="bg-white border rounded-xl p-4 shadow-sm">
                    <h3 className="text-xs font-semibold text-slate-500 uppercase tracking-wider mb-3 flex items-center gap-1.5">
                        <Baby className="h-3.5 w-3.5" /> Top 5 gia đình đông con
                    </h3>
                    <div className="space-y-2">
                        {stats.top5Families.map((f, i) => (
                            <div key={i} className="flex items-center gap-2 text-xs">
                                <span className="w-5 h-5 rounded-full bg-amber-100 text-amber-700 font-bold text-[10px] flex items-center justify-center shrink-0">
                                    {i + 1}
                                </span>
                                <span className="flex-1 truncate text-slate-700">{f.father || f.mother}</span>
                                <span className="font-semibold text-amber-600">{f.count} con</span>
                            </div>
                        ))}
                        {stats.top5Families.length === 0 && (
                            <p className="text-xs text-muted-foreground">Chưa có dữ liệu</p>
                        )}
                    </div>
                </div>

                {/* Top occupations */}
                {stats.topOccupations.length > 0 && (
                    <div className="bg-white border rounded-xl p-4 shadow-sm">
                        <h3 className="text-xs font-semibold text-slate-500 uppercase tracking-wider mb-3 flex items-center gap-1.5">
                            <Briefcase className="h-3.5 w-3.5" /> Nghề nghiệp phổ biến
                        </h3>
                        <div className="space-y-2">
                            {stats.topOccupations.map(([occ, count], i) => (
                                <div key={i} className="flex items-center gap-2 text-xs">
                                    <span className="w-5 h-5 rounded-full bg-blue-100 text-blue-700 font-bold text-[10px] flex items-center justify-center shrink-0">
                                        {i + 1}
                                    </span>
                                    <span className="flex-1 truncate text-slate-700">{occ}</span>
                                    <span className="font-semibold text-blue-600">{count}</span>
                                </div>
                            ))}
                        </div>
                    </div>
                )}

                {/* Top addresses */}
                {stats.topAddresses.length > 0 && (
                    <div className="bg-white border rounded-xl p-4 shadow-sm">
                        <h3 className="text-xs font-semibold text-slate-500 uppercase tracking-wider mb-3 flex items-center gap-1.5">
                            <MapPin className="h-3.5 w-3.5" /> Nơi sinh sống
                        </h3>
                        <div className="space-y-2">
                            {stats.topAddresses.map(([addr, count], i) => (
                                <div key={i} className="flex items-center gap-2 text-xs">
                                    <span className="w-5 h-5 rounded-full bg-emerald-100 text-emerald-700 font-bold text-[10px] flex items-center justify-center shrink-0">
                                        {i + 1}
                                    </span>
                                    <span className="flex-1 truncate text-slate-700">{addr}</span>
                                    <span className="font-semibold text-emerald-600">{count}</span>
                                </div>
                            ))}
                        </div>
                    </div>
                )}
            </div>
        </div>
    );
}

/* Stat card component */
function StatCard({ label, value, icon, color }: {
    label: string; value: number; icon: React.ReactNode;
    color: 'blue' | 'amber' | 'emerald' | 'slate' | 'indigo' | 'rose';
}) {
    const colors = {
        blue: 'from-blue-50 to-blue-100 text-blue-700',
        amber: 'from-amber-50 to-amber-100 text-amber-700',
        emerald: 'from-emerald-50 to-emerald-100 text-emerald-700',
        slate: 'from-slate-50 to-slate-100 text-slate-600',
        indigo: 'from-indigo-50 to-indigo-100 text-indigo-700',
        rose: 'from-rose-50 to-rose-100 text-rose-700',
    };
    return (
        <div className="bg-white border rounded-xl p-3 shadow-sm">
            <div className={`w-8 h-8 rounded-lg bg-gradient-to-br ${colors[color]} flex items-center justify-center mb-2`}>
                {icon}
            </div>
            <p className="text-xl font-bold text-slate-800">{value}</p>
            <p className="text-[10px] text-slate-500">{label}</p>
        </div>
    );
}
