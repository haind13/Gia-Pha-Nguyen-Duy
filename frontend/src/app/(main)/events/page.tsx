'use client';

import { useState, useMemo } from 'react';
import {
    CalendarDays,
    Search,
    Filter,
} from 'lucide-react';
import { Card, CardContent } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { MOCK_MEMORIALS, type MemorialEvent } from '@/lib/mock-data';

/* ── Lunar month names ── */
const LUNAR_MONTH_NAMES = [
    '', 'Giêng', 'Hai', 'Ba', 'Tư', 'Năm', 'Sáu',
    'Bảy', 'Tám', 'Chín', 'Mười', 'Mười Một', 'Chạp',
];

/* ── Group memorials by month ── */
function groupByMonth(memorials: MemorialEvent[]): Map<number, MemorialEvent[]> {
    const map = new Map<number, MemorialEvent[]>();
    for (const m of memorials) {
        if (!map.has(m.month)) map.set(m.month, []);
        map.get(m.month)!.push(m);
    }
    return map;
}

/* ── Memorial card for a single person ── */
function MemorialCard({ memorial }: { memorial: MemorialEvent }) {
    const isSpouse = memorial.personHandle.startsWith('S_');
    return (
        <div className="flex items-center gap-4 p-4 rounded-xl bg-white border border-stone-200/80 shadow-sm
            hover:shadow-md hover:border-amber-300/60 transition-all duration-200 group">
            {/* Date circle */}
            <div className={`flex-shrink-0 w-14 h-14 rounded-full flex flex-col items-center justify-center
                border-2 transition-colors
                ${memorial.isLunar
                    ? 'bg-gradient-to-br from-amber-50 to-orange-50 border-amber-200 group-hover:from-amber-100 group-hover:to-orange-100'
                    : 'bg-gradient-to-br from-sky-50 to-blue-50 border-sky-200 group-hover:from-sky-100 group-hover:to-blue-100'
                }`}>
                <span className={`text-lg font-bold leading-none ${memorial.isLunar ? 'text-amber-700' : 'text-sky-700'}`}>
                    {memorial.day}
                </span>
                <span className={`text-[10px] font-medium ${memorial.isLunar ? 'text-amber-500' : 'text-sky-500'}`}>
                    tháng {memorial.month}
                </span>
            </div>

            {/* Person info */}
            <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2 flex-wrap">
                    <h3 className="font-semibold text-slate-800 text-sm">{memorial.personName}</h3>
                    <span className="px-1.5 py-0.5 rounded bg-amber-100 text-amber-700 text-[11px] font-semibold border border-amber-200/60">
                        Đời {memorial.generation}
                    </span>
                    {isSpouse && (
                        <span className="px-1.5 py-0.5 rounded bg-pink-50 text-pink-600 text-[10px] border border-pink-200/60">
                            Thân quyến
                        </span>
                    )}
                </div>
                <p className="text-xs text-slate-500 mt-0.5">
                    Ngày giỗ: {memorial.day}/{memorial.month}
                    {memorial.isLunar ? ' Âm lịch' : ' Dương lịch'}
                    {memorial.deathYear && (
                        <span className="ml-1.5 text-slate-400">· Mất năm {memorial.deathYear}</span>
                    )}
                </p>
            </div>

            {/* Memorial icon */}
            <div className="flex-shrink-0 text-2xl opacity-60 group-hover:opacity-100 transition-opacity">
                🕯️
            </div>
        </div>
    );
}

export default function EventsPage() {
    const [search, setSearch] = useState('');
    const [filterGen, setFilterGen] = useState<number | null>(null);
    const [filterType, setFilterType] = useState<'all' | 'lunar' | 'solar'>('all');

    // Get unique generations for filter
    const generations = useMemo(() => {
        const gens = [...new Set(MOCK_MEMORIALS.map(m => m.generation))].sort((a, b) => a - b);
        return gens;
    }, []);

    // Filter memorials
    const filtered = useMemo(() => {
        let result = MOCK_MEMORIALS;
        if (search.trim()) {
            const q = search.toLowerCase().trim();
            result = result.filter(m =>
                m.personName.toLowerCase().includes(q)
            );
        }
        if (filterGen !== null) {
            result = result.filter(m => m.generation === filterGen);
        }
        if (filterType === 'lunar') {
            result = result.filter(m => m.isLunar);
        } else if (filterType === 'solar') {
            result = result.filter(m => !m.isLunar);
        }
        return result;
    }, [search, filterGen, filterType]);

    // Group by month
    const grouped = useMemo(() => groupByMonth(filtered), [filtered]);
    const sortedMonths = useMemo(() => [...grouped.keys()].sort((a, b) => a - b), [grouped]);

    const lunarCount = MOCK_MEMORIALS.filter(m => m.isLunar).length;
    const solarCount = MOCK_MEMORIALS.filter(m => !m.isLunar).length;

    return (
        <div className="space-y-6">
            {/* Header */}
            <div>
                <h1 className="text-2xl font-bold tracking-tight flex items-center gap-2">
                    <CalendarDays className="h-6 w-6" />
                    Ngày Giỗ Trong Họ Tộc
                </h1>
                <p className="text-muted-foreground">
                    Lịch ngày giỗ {MOCK_MEMORIALS.length} vị tiền nhân và thân quyến dòng họ Nguyễn Duy
                </p>
            </div>

            {/* Search + Filter bar */}
            <div className="flex flex-col sm:flex-row gap-3">
                <div className="relative flex-1">
                    <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                    <Input
                        placeholder="Tìm theo tên..."
                        className="pl-9"
                        value={search}
                        onChange={e => setSearch(e.target.value)}
                    />
                </div>
                <div className="flex items-center gap-2">
                    <Filter className="h-4 w-4 text-muted-foreground flex-shrink-0" />
                    <select
                        className="rounded-md border px-3 py-2 text-sm bg-background"
                        value={filterGen ?? ''}
                        onChange={e => setFilterGen(e.target.value ? parseInt(e.target.value) : null)}
                    >
                        <option value="">Tất cả đời</option>
                        {generations.map(g => (
                            <option key={g} value={g}>Đời {g}</option>
                        ))}
                    </select>
                    <select
                        className="rounded-md border px-3 py-2 text-sm bg-background"
                        value={filterType}
                        onChange={e => setFilterType(e.target.value as 'all' | 'lunar' | 'solar')}
                    >
                        <option value="all">Tất cả</option>
                        <option value="lunar">🌙 Âm lịch ({lunarCount})</option>
                        <option value="solar">☀️ Dương lịch ({solarCount})</option>
                    </select>
                </div>
            </div>

            {/* Memorial listings grouped by month */}
            {filtered.length === 0 ? (
                <Card>
                    <CardContent className="flex flex-col items-center justify-center py-12">
                        <CalendarDays className="h-12 w-12 text-muted-foreground mb-4" />
                        <p className="text-muted-foreground">Không tìm thấy ngày giỗ phù hợp</p>
                    </CardContent>
                </Card>
            ) : (
                <div className="space-y-6">
                    {sortedMonths.map(month => {
                        const memorials = grouped.get(month)!;
                        const monthName = LUNAR_MONTH_NAMES[month] || `${month}`;
                        return (
                            <div key={month}>
                                {/* Month header */}
                                <div className="flex items-center gap-3 mb-3">
                                    <div className="flex items-center gap-2 px-3 py-1.5 rounded-lg bg-gradient-to-r from-amber-600 to-orange-600 text-white shadow-sm">
                                        <span className="text-sm font-bold">Tháng {monthName}</span>
                                        <span className="text-xs opacity-80">({month})</span>
                                    </div>
                                    <span className="text-xs text-muted-foreground">{memorials.length} ngày giỗ</span>
                                    <div className="flex-1 h-px bg-gradient-to-r from-amber-200 to-transparent" />
                                </div>

                                {/* Memorial cards */}
                                <div className="space-y-2 ml-2">
                                    {memorials.map(m => (
                                        <MemorialCard key={m.personHandle} memorial={m} />
                                    ))}
                                </div>
                            </div>
                        );
                    })}
                </div>
            )}

            {/* Summary */}
            <Card className="bg-stone-50 border-stone-200">
                <CardContent className="py-4">
                    <div className="flex items-center justify-between text-sm flex-wrap gap-2">
                        <span className="text-muted-foreground">
                            Tổng cộng <strong className="text-stone-800">{MOCK_MEMORIALS.length}</strong> ngày giỗ,
                            từ Đời {Math.min(...MOCK_MEMORIALS.map(m => m.generation))} đến Đời {Math.max(...MOCK_MEMORIALS.map(m => m.generation))}
                        </span>
                        <div className="flex items-center gap-3 text-xs text-muted-foreground">
                            <span>🌙 Âm lịch: {lunarCount}</span>
                            <span>☀️ Dương lịch: {solarCount}</span>
                        </div>
                    </div>
                </CardContent>
            </Card>
        </div>
    );
}
