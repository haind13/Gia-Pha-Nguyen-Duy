'use client';

import { useState, useMemo } from 'react';
import {
    CalendarDays,
    Search,
    Filter,
    X,
    ChevronLeft,
    ChevronRight,
    ChevronsLeft,
    ChevronsRight,
} from 'lucide-react';
import { Card, CardContent } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { MOCK_MEMORIALS, type MemorialEvent } from '@/lib/mock-data';
import { RequireAuth } from '@/components/require-auth';

/* ── Constants ── */
const WEEKDAY_HEADERS = ['CN', 'T2', 'T3', 'T4', 'T5', 'T6', 'T7'];
const SOLAR_MONTH_NAMES = [
    '', 'Tháng 1', 'Tháng 2', 'Tháng 3', 'Tháng 4', 'Tháng 5', 'Tháng 6',
    'Tháng 7', 'Tháng 8', 'Tháng 9', 'Tháng 10', 'Tháng 11', 'Tháng 12',
];

/* ── Calendar helpers ── */
function getDaysInMonth(year: number, month: number): number {
    return new Date(year, month, 0).getDate();
}

function getFirstDayOfWeek(year: number, month: number): number {
    return new Date(year, month - 1, 1).getDay();
}

/* ═══════════════════════════════════════════════════════
   Lunar ↔ Solar conversion (approximate for 2025–2027)
   ═══════════════════════════════════════════════════════ */
const LUNAR_YEAR_DATA: Record<number, { month: number; solarMonth: number; solarDay: number; solarYear: number }[]> = {
    2025: [
        { month: 1,  solarMonth: 1,  solarDay: 29, solarYear: 2025 },
        { month: 2,  solarMonth: 2,  solarDay: 28, solarYear: 2025 },
        { month: 3,  solarMonth: 3,  solarDay: 29, solarYear: 2025 },
        { month: 4,  solarMonth: 4,  solarDay: 28, solarYear: 2025 },
        { month: 5,  solarMonth: 5,  solarDay: 27, solarYear: 2025 },
        { month: 6,  solarMonth: 6,  solarDay: 25, solarYear: 2025 },
        { month: 7,  solarMonth: 7,  solarDay: 25, solarYear: 2025 },
        { month: 8,  solarMonth: 8,  solarDay: 23, solarYear: 2025 },
        { month: 9,  solarMonth: 9,  solarDay: 22, solarYear: 2025 },
        { month: 10, solarMonth: 10, solarDay: 22, solarYear: 2025 },
        { month: 11, solarMonth: 11, solarDay: 21, solarYear: 2025 },
        { month: 12, solarMonth: 12, solarDay: 20, solarYear: 2025 },
    ],
    2026: [
        { month: 1,  solarMonth: 2,  solarDay: 17, solarYear: 2026 },
        { month: 2,  solarMonth: 3,  solarDay: 19, solarYear: 2026 },
        { month: 3,  solarMonth: 4,  solarDay: 17, solarYear: 2026 },
        { month: 4,  solarMonth: 5,  solarDay: 17, solarYear: 2026 },
        { month: 5,  solarMonth: 6,  solarDay: 15, solarYear: 2026 },
        { month: 6,  solarMonth: 7,  solarDay: 15, solarYear: 2026 },
        { month: 7,  solarMonth: 8,  solarDay: 13, solarYear: 2026 },
        { month: 8,  solarMonth: 9,  solarDay: 12, solarYear: 2026 },
        { month: 9,  solarMonth: 10, solarDay: 11, solarYear: 2026 },
        { month: 10, solarMonth: 11, solarDay: 10, solarYear: 2026 },
        { month: 11, solarMonth: 12, solarDay: 9,  solarYear: 2026 },
        { month: 12, solarMonth: 1,  solarDay: 8,  solarYear: 2027 },
    ],
    2027: [
        { month: 1,  solarMonth: 2,  solarDay: 6,  solarYear: 2027 },
        { month: 2,  solarMonth: 3,  solarDay: 8,  solarYear: 2027 },
        { month: 3,  solarMonth: 4,  solarDay: 7,  solarYear: 2027 },
        { month: 4,  solarMonth: 5,  solarDay: 6,  solarYear: 2027 },
        { month: 5,  solarMonth: 6,  solarDay: 5,  solarYear: 2027 },
        { month: 6,  solarMonth: 7,  solarDay: 4,  solarYear: 2027 },
        { month: 7,  solarMonth: 8,  solarDay: 3,  solarYear: 2027 },
        { month: 8,  solarMonth: 9,  solarDay: 1,  solarYear: 2027 },
        { month: 9,  solarMonth: 10, solarDay: 1,  solarYear: 2027 },
        { month: 10, solarMonth: 10, solarDay: 30, solarYear: 2027 },
        { month: 11, solarMonth: 11, solarDay: 29, solarYear: 2027 },
        { month: 12, solarMonth: 12, solarDay: 29, solarYear: 2027 },
    ],
};

function lunarToSolar(lunarMonth: number, lunarDay: number, lunarYear: number): { month: number; day: number; year: number } {
    const yearData = LUNAR_YEAR_DATA[lunarYear];
    if (!yearData) {
        // Fallback: use same month/day
        return { month: lunarMonth, day: lunarDay, year: lunarYear };
    }
    const monthStart = yearData.find(m => m.month === lunarMonth);
    if (!monthStart) return { month: lunarMonth, day: lunarDay, year: lunarYear };

    const startDate = new Date(monthStart.solarYear, monthStart.solarMonth - 1, monthStart.solarDay);
    startDate.setDate(startDate.getDate() + (lunarDay - 1));

    return {
        month: startDate.getMonth() + 1,
        day: startDate.getDate(),
        year: startDate.getFullYear(),
    };
}

/* ── Build events on solar calendar for a given year ── */
interface CalendarEvent extends MemorialEvent {
    solarMonth: number;
    solarDay: number;
    solarYear: number;
    lunarLabel: string;
}

function buildCalendarEvents(memorials: MemorialEvent[], year: number): CalendarEvent[] {
    return memorials.map(m => {
        if (m.isLunar) {
            const solar = lunarToSolar(m.month, m.day, year);
            return {
                ...m,
                solarMonth: solar.month,
                solarDay: solar.day,
                solarYear: solar.year,
                lunarLabel: `${m.day}/${m.month} ÂL`,
            };
        } else {
            return {
                ...m,
                solarMonth: m.month,
                solarDay: m.day,
                solarYear: year,
                lunarLabel: `${m.day}/${m.month} DL`,
            };
        }
    });
}

function buildSolarEventMap(events: CalendarEvent[]): Map<string, CalendarEvent[]> {
    const map = new Map<string, CalendarEvent[]>();
    for (const e of events) {
        const key = `${e.solarYear}-${e.solarMonth}-${e.solarDay}`;
        if (!map.has(key)) map.set(key, []);
        map.get(key)!.push(e);
    }
    return map;
}

/* ═══════════════════════════════════════════
   Big Single-Month Calendar Component
   ═══════════════════════════════════════════ */
function BigCalendar({
    year,
    month,
    eventMap,
    selectedDay,
    onSelectDay,
}: {
    year: number;
    month: number;
    eventMap: Map<string, CalendarEvent[]>;
    selectedDay: { year: number; month: number; day: number } | null;
    onSelectDay: (year: number, month: number, day: number) => void;
}) {
    const daysInMonth = getDaysInMonth(year, month);
    const firstDay = getFirstDayOfWeek(year, month);

    const cells: (number | null)[] = [];
    for (let i = 0; i < firstDay; i++) cells.push(null);
    for (let d = 1; d <= daysInMonth; d++) cells.push(d);
    // Trailing empty cells to fill last row
    while (cells.length % 7 !== 0) cells.push(null);

    const today = new Date();
    const isCurrentMonth = today.getFullYear() === year && today.getMonth() + 1 === month;

    return (
        <div className="border rounded-xl bg-white shadow-sm overflow-hidden">
            {/* Weekday headers */}
            <div className="grid grid-cols-7 bg-gradient-to-r from-amber-50 to-orange-50 border-b">
                {WEEKDAY_HEADERS.map(d => (
                    <div key={d} className={`text-center text-sm font-semibold py-2.5
                        ${d === 'CN' ? 'text-red-500' : d === 'T7' ? 'text-blue-500' : 'text-stone-600'}`}>
                        {d}
                    </div>
                ))}
            </div>

            {/* Days grid */}
            <div className="grid grid-cols-7">
                {cells.map((day, i) => {
                    if (day === null) {
                        return <div key={`empty-${i}`} className="border-b border-r border-stone-100 min-h-[70px] lg:min-h-[80px]" />;
                    }

                    const key = `${year}-${month}-${day}`;
                    const events = eventMap.get(key);
                    const hasEvents = events && events.length > 0;
                    const isSelected = selectedDay?.year === year && selectedDay?.month === month && selectedDay?.day === day;
                    const isToday = isCurrentMonth && today.getDate() === day;
                    const dayOfWeek = (firstDay + day - 1) % 7;
                    const isSunday = dayOfWeek === 0;
                    const isSaturday = dayOfWeek === 6;

                    return (
                        <button
                            key={day}
                            onClick={() => hasEvents && onSelectDay(year, month, day)}
                            className={`
                                relative border-b border-r border-stone-100 min-h-[70px] lg:min-h-[80px]
                                p-1 text-left transition-all duration-150 flex flex-col
                                ${hasEvents ? 'cursor-pointer hover:bg-amber-50/80' : 'cursor-default'}
                                ${isSelected ? 'bg-amber-100 ring-2 ring-amber-400 ring-inset z-10' : ''}
                            `}
                        >
                            {/* Day number */}
                            <div className="flex items-center gap-1">
                                <span className={`
                                    text-sm font-medium leading-none
                                    ${isToday ? 'bg-amber-500 text-white w-6 h-6 rounded-full flex items-center justify-center' : ''}
                                    ${!isToday && isSunday ? 'text-red-500' : ''}
                                    ${!isToday && isSaturday ? 'text-blue-500' : ''}
                                    ${!isToday && !isSunday && !isSaturday ? 'text-stone-700' : ''}
                                `}>
                                    {day}
                                </span>
                            </div>

                            {/* Events on this day */}
                            {hasEvents && (
                                <div className="mt-0.5 space-y-0.5 flex-1 overflow-hidden">
                                    {events.map((evt, idx) => (
                                        <div
                                            key={idx}
                                            className={`text-[10px] leading-tight px-1 py-0.5 rounded truncate font-medium
                                                ${evt.isLunar
                                                    ? 'bg-amber-100 text-amber-800 border border-amber-200/60'
                                                    : 'bg-sky-100 text-sky-800 border border-sky-200/60'
                                                }
                                            `}
                                            title={`${evt.personName} — Giỗ ${evt.day}/${evt.month} ${evt.isLunar ? 'ÂL' : 'DL'}`}
                                        >
                                            🕯️ {evt.personName.split(' ').slice(-2).join(' ')}
                                        </div>
                                    ))}
                                </div>
                            )}
                        </button>
                    );
                })}
            </div>
        </div>
    );
}

/* ── Memorial card ── */
function MemorialCard({ memorial }: { memorial: CalendarEvent }) {
    const isSpouse = memorial.personHandle.startsWith('S_');
    return (
        <div className="flex items-center gap-3 p-3 rounded-xl bg-white border border-stone-200/80 shadow-sm
            hover:shadow-md hover:border-amber-300/60 transition-all duration-200 group">
            <div className={`flex-shrink-0 w-12 h-12 rounded-full flex flex-col items-center justify-center
                border-2 transition-colors
                ${memorial.isLunar
                    ? 'bg-gradient-to-br from-amber-50 to-orange-50 border-amber-200'
                    : 'bg-gradient-to-br from-sky-50 to-blue-50 border-sky-200'
                }`}>
                <span className={`text-base font-bold leading-none ${memorial.isLunar ? 'text-amber-700' : 'text-sky-700'}`}>
                    {memorial.day}
                </span>
                <span className={`text-[9px] font-medium ${memorial.isLunar ? 'text-amber-500' : 'text-sky-500'}`}>
                    th.{memorial.month}
                </span>
            </div>
            <div className="flex-1 min-w-0">
                <div className="flex items-center gap-1.5 flex-wrap">
                    <h3 className="font-semibold text-slate-800 text-sm">{memorial.personName}</h3>
                    <span className="px-1.5 py-0.5 rounded bg-amber-100 text-amber-700 text-[10px] font-semibold border border-amber-200/60">
                        Đời {memorial.generation}
                    </span>
                    {isSpouse && (
                        <span className="px-1 py-0.5 rounded bg-pink-50 text-pink-600 text-[9px] border border-pink-200/60">
                            Thân quyến
                        </span>
                    )}
                </div>
                <p className="text-xs text-slate-500 mt-0.5">
                    Giỗ: {memorial.day}/{memorial.month} {memorial.isLunar ? 'ÂL' : 'DL'}
                    {' → '}{memorial.solarDay}/{memorial.solarMonth} DL
                    {memorial.deathYear && (
                        <span className="ml-1 text-slate-400">· Mất {memorial.deathYear}</span>
                    )}
                </p>
            </div>
            <div className="flex-shrink-0 text-xl opacity-60 group-hover:opacity-100 transition-opacity">
                🕯️
            </div>
        </div>
    );
}

/* ═══════════════════════════════════════════
   Main Page
   ═══════════════════════════════════════════ */
export default function EventsPage() {
    const [search, setSearch] = useState('');
    const [filterGen, setFilterGen] = useState<number | null>(null);
    const [filterType, setFilterType] = useState<'all' | 'lunar' | 'solar'>('all');
    const [selectedDay, setSelectedDay] = useState<{ year: number; month: number; day: number } | null>(null);
    const [calendarYear, setCalendarYear] = useState(2026);
    const [calendarMonth, setCalendarMonth] = useState(new Date().getMonth() + 1);

    // Convert all events to solar calendar positions for current year
    const calendarEvents = useMemo(() => buildCalendarEvents(MOCK_MEMORIALS, calendarYear), [calendarYear]);
    const eventMap = useMemo(() => buildSolarEventMap(calendarEvents), [calendarEvents]);

    // Events in current month (for the list on the right)
    const currentMonthEvents = useMemo(() => {
        return calendarEvents.filter(e => e.solarMonth === calendarMonth && e.solarYear === calendarYear);
    }, [calendarEvents, calendarMonth, calendarYear]);

    // Get unique generations for filter
    const generations = useMemo(() => {
        const gens = [...new Set(MOCK_MEMORIALS.map(m => m.generation))].sort((a, b) => a - b);
        return gens;
    }, []);

    // Filter memorials — show events of current month, or selected day
    const filtered = useMemo(() => {
        let result: CalendarEvent[];
        if (selectedDay) {
            result = calendarEvents.filter(m =>
                m.solarYear === selectedDay.year && m.solarMonth === selectedDay.month && m.solarDay === selectedDay.day
            );
        } else {
            result = currentMonthEvents;
        }

        if (search.trim()) {
            const q = search.toLowerCase().trim();
            result = result.filter(m => m.personName.toLowerCase().includes(q));
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
    }, [calendarEvents, currentMonthEvents, search, filterGen, filterType, selectedDay]);

    const lunarCount = calendarEvents.filter(m => m.isLunar).length;
    const solarCount = calendarEvents.filter(m => !m.isLunar).length;

    const handleSelectDay = (year: number, month: number, day: number) => {
        if (selectedDay?.year === year && selectedDay?.month === month && selectedDay?.day === day) {
            setSelectedDay(null);
        } else {
            setSelectedDay({ year, month, day });
        }
    };

    const clearSelection = () => setSelectedDay(null);

    const prevMonth = () => {
        setSelectedDay(null);
        if (calendarMonth === 1) {
            setCalendarMonth(12);
            setCalendarYear(y => y - 1);
        } else {
            setCalendarMonth(m => m - 1);
        }
    };

    const nextMonth = () => {
        setSelectedDay(null);
        if (calendarMonth === 12) {
            setCalendarMonth(1);
            setCalendarYear(y => y + 1);
        } else {
            setCalendarMonth(m => m + 1);
        }
    };

    const prevYear = () => {
        setSelectedDay(null);
        setCalendarYear(y => y - 1);
    };

    const nextYear = () => {
        setSelectedDay(null);
        setCalendarYear(y => y + 1);
    };

    const goToToday = () => {
        const now = new Date();
        setCalendarYear(now.getFullYear());
        setCalendarMonth(now.getMonth() + 1);
        setSelectedDay(null);
    };

    return (
        <RequireAuth>
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

            {/* Two-column layout */}
            <div className="grid grid-cols-1 lg:grid-cols-[1fr_380px] gap-6">

                {/* ══════ LEFT: Single Month Calendar ══════ */}
                <div className="space-y-3">
                    {/* Month/Year navigation */}
                    <div className="flex items-center justify-between">
                        <div className="flex items-center gap-1">
                            <Button variant="ghost" size="icon" className="h-8 w-8" onClick={prevYear} title="Năm trước">
                                <ChevronsLeft className="h-4 w-4" />
                            </Button>
                            <Button variant="ghost" size="icon" className="h-8 w-8" onClick={prevMonth} title="Tháng trước">
                                <ChevronLeft className="h-4 w-4" />
                            </Button>
                        </div>

                        <div className="flex items-center gap-3">
                            <h2 className="text-lg font-bold text-stone-800">
                                {SOLAR_MONTH_NAMES[calendarMonth]} — {calendarYear}
                            </h2>
                            <Button variant="outline" size="sm" className="text-xs h-7" onClick={goToToday}>
                                Hôm nay
                            </Button>
                        </div>

                        <div className="flex items-center gap-1">
                            <Button variant="ghost" size="icon" className="h-8 w-8" onClick={nextMonth} title="Tháng sau">
                                <ChevronRight className="h-4 w-4" />
                            </Button>
                            <Button variant="ghost" size="icon" className="h-8 w-8" onClick={nextYear} title="Năm sau">
                                <ChevronsRight className="h-4 w-4" />
                            </Button>
                        </div>
                    </div>

                    {/* Legend */}
                    <div className="flex items-center gap-4 text-[11px] text-muted-foreground">
                        <span className="flex items-center gap-1">
                            <span className="w-3 h-3 rounded bg-amber-100 border border-amber-200" /> Ngày giỗ Âm lịch
                        </span>
                        <span className="flex items-center gap-1">
                            <span className="w-3 h-3 rounded bg-sky-100 border border-sky-200" /> Ngày giỗ Dương lịch
                        </span>
                        <span className="text-stone-400">
                            💡 Ấn vào ngày có sự kiện để xem chi tiết
                        </span>
                    </div>

                    {/* Calendar */}
                    <BigCalendar
                        year={calendarYear}
                        month={calendarMonth}
                        eventMap={eventMap}
                        selectedDay={selectedDay}
                        onSelectDay={handleSelectDay}
                    />

                    {/* Month event count */}
                    <div className="text-xs text-muted-foreground text-center">
                        {currentMonthEvents.length > 0
                            ? `${SOLAR_MONTH_NAMES[calendarMonth]} có ${currentMonthEvents.length} ngày giỗ`
                            : `${SOLAR_MONTH_NAMES[calendarMonth]} không có ngày giỗ`
                        }
                        {' · '}Tổng năm {calendarYear}: {calendarEvents.length} ngày giỗ
                    </div>
                </div>

                {/* ══════ RIGHT: Event List ══════ */}
                <div className="space-y-4">
                    {/* Title */}
                    <div className="flex items-center justify-between flex-wrap gap-2">
                        <h2 className="text-base font-semibold text-stone-800 flex items-center gap-2">
                            🕯️
                            {selectedDay
                                ? <span>Ngày {selectedDay.day}/{selectedDay.month}/{selectedDay.year}</span>
                                : <span>{SOLAR_MONTH_NAMES[calendarMonth]}</span>
                            }
                        </h2>
                        {selectedDay && (
                            <Button variant="ghost" size="sm" onClick={clearSelection} className="gap-1 text-xs h-7">
                                <X className="h-3 w-3" /> Cả tháng
                            </Button>
                        )}
                    </div>

                    {/* Search + Filter */}
                    <div className="space-y-2">
                        <div className="relative">
                            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                            <Input
                                placeholder="Tìm theo tên..."
                                className="pl-9 h-8 text-sm"
                                value={search}
                                onChange={e => setSearch(e.target.value)}
                            />
                        </div>
                        <div className="flex items-center gap-2">
                            <Filter className="h-3.5 w-3.5 text-muted-foreground flex-shrink-0" />
                            <select
                                className="rounded-md border px-2 py-1 text-xs bg-background flex-1"
                                value={filterGen ?? ''}
                                onChange={e => setFilterGen(e.target.value ? parseInt(e.target.value) : null)}
                            >
                                <option value="">Tất cả đời</option>
                                {generations.map(g => (
                                    <option key={g} value={g}>Đời {g}</option>
                                ))}
                            </select>
                            <select
                                className="rounded-md border px-2 py-1 text-xs bg-background"
                                value={filterType}
                                onChange={e => setFilterType(e.target.value as 'all' | 'lunar' | 'solar')}
                            >
                                <option value="all">Tất cả</option>
                                <option value="lunar">🌙 Âm ({lunarCount})</option>
                                <option value="solar">☀️ DL ({solarCount})</option>
                            </select>
                        </div>
                    </div>

                    {/* Memorial list */}
                    <div className="space-y-2 max-h-[calc(100vh-340px)] overflow-y-auto pr-1">
                        {filtered.length === 0 ? (
                            <Card>
                                <CardContent className="flex flex-col items-center justify-center py-8">
                                    <CalendarDays className="h-10 w-10 text-muted-foreground mb-3" />
                                    <p className="text-sm text-muted-foreground text-center">
                                        {selectedDay
                                            ? `Không có ngày giỗ vào ${selectedDay.day}/${selectedDay.month}`
                                            : `Không có ngày giỗ trong ${SOLAR_MONTH_NAMES[calendarMonth]}`
                                        }
                                    </p>
                                    {selectedDay && (
                                        <Button variant="link" size="sm" onClick={clearSelection} className="mt-1 text-xs">
                                            Xem cả tháng
                                        </Button>
                                    )}
                                </CardContent>
                            </Card>
                        ) : (
                            filtered
                                .sort((a, b) => a.solarDay - b.solarDay)
                                .map(m => <MemorialCard key={m.personHandle} memorial={m} />)
                        )}
                    </div>

                    {/* Summary */}
                    <Card className="bg-stone-50 border-stone-200">
                        <CardContent className="py-2.5">
                            <div className="flex items-center justify-between text-xs flex-wrap gap-1">
                                <span className="text-muted-foreground">
                                    <strong>{filtered.length}</strong> ngày giỗ
                                </span>
                                <div className="flex items-center gap-2 text-muted-foreground">
                                    <span>🌙 {filtered.filter(m => m.isLunar).length}</span>
                                    <span>☀️ {filtered.filter(m => !m.isLunar).length}</span>
                                </div>
                            </div>
                        </CardContent>
                    </Card>
                </div>
            </div>
        </div>
        </RequireAuth>
    );
}
