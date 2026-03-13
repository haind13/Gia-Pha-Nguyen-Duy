'use client';

import { useState, useMemo, useEffect, useCallback } from 'react';
import {
    CalendarDays, Search, Filter, X, ChevronLeft, ChevronRight,
    ChevronsLeft, ChevronsRight, Cake, Users,
} from 'lucide-react';
import { Card, CardContent } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Tabs, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { MOCK_MEMORIALS, type MemorialEvent } from '@/lib/mock-data';
import { RequireAuth } from '@/components/require-auth';
import { supabase } from '@/lib/supabase';

/* ── Types ── */
interface EventItem {
    personHandle: string;
    personName: string;
    generation: number;
    gender: number;
    day: number;
    month: number;
    year?: number;
    isLunar: boolean;
    isPatrilineal: boolean;
    type: 'memorial' | 'birthday';
}

interface CalendarEvent extends EventItem {
    solarMonth: number;
    solarDay: number;
    solarYear: number;
    lunarLabel: string;
}

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

/* ── Lunar ↔ Solar conversion (approximate 2025–2027) ── */
const LUNAR_YEAR_DATA: Record<number, { month: number; solarMonth: number; solarDay: number; solarYear: number }[]> = {
    2025: [
        { month: 1, solarMonth: 1, solarDay: 29, solarYear: 2025 },
        { month: 2, solarMonth: 2, solarDay: 28, solarYear: 2025 },
        { month: 3, solarMonth: 3, solarDay: 29, solarYear: 2025 },
        { month: 4, solarMonth: 4, solarDay: 28, solarYear: 2025 },
        { month: 5, solarMonth: 5, solarDay: 27, solarYear: 2025 },
        { month: 6, solarMonth: 6, solarDay: 25, solarYear: 2025 },
        { month: 7, solarMonth: 7, solarDay: 25, solarYear: 2025 },
        { month: 8, solarMonth: 8, solarDay: 23, solarYear: 2025 },
        { month: 9, solarMonth: 9, solarDay: 22, solarYear: 2025 },
        { month: 10, solarMonth: 10, solarDay: 22, solarYear: 2025 },
        { month: 11, solarMonth: 11, solarDay: 21, solarYear: 2025 },
        { month: 12, solarMonth: 12, solarDay: 20, solarYear: 2025 },
    ],
    2026: [
        { month: 1, solarMonth: 2, solarDay: 17, solarYear: 2026 },
        { month: 2, solarMonth: 3, solarDay: 19, solarYear: 2026 },
        { month: 3, solarMonth: 4, solarDay: 17, solarYear: 2026 },
        { month: 4, solarMonth: 5, solarDay: 17, solarYear: 2026 },
        { month: 5, solarMonth: 6, solarDay: 15, solarYear: 2026 },
        { month: 6, solarMonth: 7, solarDay: 15, solarYear: 2026 },
        { month: 7, solarMonth: 8, solarDay: 13, solarYear: 2026 },
        { month: 8, solarMonth: 9, solarDay: 12, solarYear: 2026 },
        { month: 9, solarMonth: 10, solarDay: 11, solarYear: 2026 },
        { month: 10, solarMonth: 11, solarDay: 10, solarYear: 2026 },
        { month: 11, solarMonth: 12, solarDay: 9, solarYear: 2026 },
        { month: 12, solarMonth: 1, solarDay: 8, solarYear: 2027 },
    ],
    2027: [
        { month: 1, solarMonth: 2, solarDay: 6, solarYear: 2027 },
        { month: 2, solarMonth: 3, solarDay: 8, solarYear: 2027 },
        { month: 3, solarMonth: 4, solarDay: 7, solarYear: 2027 },
        { month: 4, solarMonth: 5, solarDay: 6, solarYear: 2027 },
        { month: 5, solarMonth: 6, solarDay: 5, solarYear: 2027 },
        { month: 6, solarMonth: 7, solarDay: 4, solarYear: 2027 },
        { month: 7, solarMonth: 8, solarDay: 3, solarYear: 2027 },
        { month: 8, solarMonth: 9, solarDay: 1, solarYear: 2027 },
        { month: 9, solarMonth: 10, solarDay: 1, solarYear: 2027 },
        { month: 10, solarMonth: 10, solarDay: 30, solarYear: 2027 },
        { month: 11, solarMonth: 11, solarDay: 29, solarYear: 2027 },
        { month: 12, solarMonth: 12, solarDay: 29, solarYear: 2027 },
    ],
};

function lunarToSolar(lunarMonth: number, lunarDay: number, lunarYear: number) {
    const yearData = LUNAR_YEAR_DATA[lunarYear];
    if (!yearData) return { month: lunarMonth, day: lunarDay, year: lunarYear };
    const monthStart = yearData.find(m => m.month === lunarMonth);
    if (!monthStart) return { month: lunarMonth, day: lunarDay, year: lunarYear };
    const startDate = new Date(monthStart.solarYear, monthStart.solarMonth - 1, monthStart.solarDay);
    startDate.setDate(startDate.getDate() + (lunarDay - 1));
    return { month: startDate.getMonth() + 1, day: startDate.getDate(), year: startDate.getFullYear() };
}

/* ── Parse date string → {day, month, isLunar} ── */
function parseDateString(dateStr: string | null | undefined): { day: number; month: number; isLunar: boolean } | null {
    if (!dateStr) return null;
    const s = dateStr.trim();
    // "30/07 ÂL" or "30/7 ÂL"
    const lunarMatch = s.match(/^(\d{1,2})\s*[\/\-]\s*(\d{1,2})\s*(ÂL|AL|âl|al)/i);
    if (lunarMatch) return { day: parseInt(lunarMatch[1]), month: parseInt(lunarMatch[2]), isLunar: true };
    // "15/3/1995" or "15-3-1995" or "15/03/1995 (Giáp Tý)"
    const fullMatch = s.match(/^(\d{1,2})\s*[\/\-]\s*(\d{1,2})\s*[\/\-]\s*(\d{4})/);
    if (fullMatch) return { day: parseInt(fullMatch[1]), month: parseInt(fullMatch[2]), isLunar: false };
    // "15/03" (no year, assume solar)
    const shortMatch = s.match(/^(\d{1,2})\s*[\/\-]\s*(\d{1,2})$/);
    if (shortMatch) return { day: parseInt(shortMatch[1]), month: parseInt(shortMatch[2]), isLunar: false };
    return null;
}

/* ── Build events from people data + MOCK fallback ── */
function buildEventsFromPeople(
    people: Array<{
        handle: string; display_name: string; gender: number; generation: number;
        birth_date: string | null; death_date: string | null; birth_year: number | null;
        death_year: number | null; is_living: boolean; is_patrilineal: boolean;
    }>
): EventItem[] {
    const events: EventItem[] = [];
    const memorialHandles = new Set<string>();

    // 1. Extract memorial events from people's death_date
    for (const p of people) {
        if (p.death_date) {
            const parsed = parseDateString(p.death_date);
            if (parsed) {
                events.push({
                    personHandle: p.handle,
                    personName: p.display_name,
                    generation: p.generation,
                    gender: p.gender,
                    day: parsed.day,
                    month: parsed.month,
                    year: p.death_year ?? undefined,
                    isLunar: parsed.isLunar,
                    isPatrilineal: p.is_patrilineal,
                    type: 'memorial',
                });
                memorialHandles.add(p.handle);
            }
        }
    }

    // 2. Fallback: Add MOCK_MEMORIALS for people not already covered
    for (const m of MOCK_MEMORIALS) {
        if (!memorialHandles.has(m.personHandle)) {
            const person = people.find(p => p.handle === m.personHandle);
            events.push({
                personHandle: m.personHandle,
                personName: m.personName,
                generation: m.generation,
                gender: person?.gender ?? 1,
                day: m.day,
                month: m.month,
                year: m.deathYear,
                isLunar: m.isLunar,
                isPatrilineal: person?.is_patrilineal ?? !m.personHandle.startsWith('S_'),
                type: 'memorial',
            });
        }
    }

    // 3. Extract birthday events for living people with full birth_date
    for (const p of people) {
        if (p.is_living && p.birth_date) {
            const parsed = parseDateString(p.birth_date);
            if (parsed) {
                events.push({
                    personHandle: p.handle,
                    personName: p.display_name,
                    generation: p.generation,
                    gender: p.gender,
                    day: parsed.day,
                    month: parsed.month,
                    year: p.birth_year ?? undefined,
                    isLunar: parsed.isLunar,
                    isPatrilineal: p.is_patrilineal,
                    type: 'birthday',
                });
            }
        }
    }

    return events;
}

/* ── Convert events to solar calendar positions ── */
function buildCalendarEvents(items: EventItem[], year: number): CalendarEvent[] {
    return items.map(m => {
        if (m.isLunar) {
            const solar = lunarToSolar(m.month, m.day, year);
            return { ...m, solarMonth: solar.month, solarDay: solar.day, solarYear: solar.year, lunarLabel: `${m.day}/${m.month} ÂL` };
        }
        return { ...m, solarMonth: m.month, solarDay: m.day, solarYear: year, lunarLabel: `${m.day}/${m.month} DL` };
    });
}

function buildSolarEventMap(events: CalendarEvent[]) {
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
    year, month, eventMap, selectedDay, onSelectDay,
}: {
    year: number; month: number;
    eventMap: Map<string, CalendarEvent[]>;
    selectedDay: { year: number; month: number; day: number } | null;
    onSelectDay: (y: number, m: number, d: number) => void;
}) {
    const daysInMonth = getDaysInMonth(year, month);
    const firstDay = getFirstDayOfWeek(year, month);
    const cells: (number | null)[] = [];
    for (let i = 0; i < firstDay; i++) cells.push(null);
    for (let d = 1; d <= daysInMonth; d++) cells.push(d);
    while (cells.length % 7 !== 0) cells.push(null);

    const today = new Date();
    const isCurrentMonth = today.getFullYear() === year && today.getMonth() + 1 === month;

    return (
        <div className="border rounded-xl bg-card shadow-sm overflow-hidden">
            <div className="grid grid-cols-7 bg-gradient-to-r from-amber-50 to-orange-50 dark:from-amber-950/30 dark:to-orange-950/30 border-b">
                {WEEKDAY_HEADERS.map(d => (
                    <div key={d} className={`text-center text-xs sm:text-sm font-semibold py-1.5 sm:py-2.5
                        ${d === 'CN' ? 'text-red-500' : d === 'T7' ? 'text-blue-500' : 'text-muted-foreground'}`}>
                        {d}
                    </div>
                ))}
            </div>
            <div className="grid grid-cols-7">
                {cells.map((day, i) => {
                    if (day === null) return <div key={`empty-${i}`} className="border-b border-r border-border/40 min-h-[50px] sm:min-h-[70px] lg:min-h-[80px]" />;
                    const key = `${year}-${month}-${day}`;
                    const events = eventMap.get(key);
                    const hasEvents = events && events.length > 0;
                    const isSelected = selectedDay?.year === year && selectedDay?.month === month && selectedDay?.day === day;
                    const isToday = isCurrentMonth && today.getDate() === day;
                    const dayOfWeek = (firstDay + day - 1) % 7;
                    return (
                        <button key={day} onClick={() => hasEvents && onSelectDay(year, month, day)} className={`
                            relative border-b border-r border-border/40 min-h-[50px] sm:min-h-[70px] lg:min-h-[80px]
                            p-1 text-left transition-all duration-150 flex flex-col
                            ${hasEvents ? 'cursor-pointer hover:bg-accent/50' : 'cursor-default'}
                            ${isSelected ? 'bg-amber-100 dark:bg-amber-900/30 ring-2 ring-amber-400 ring-inset z-10' : ''}
                        `}>
                            <div className="flex items-center gap-1">
                                <span className={`text-sm font-medium leading-none
                                    ${isToday ? 'bg-amber-500 text-white w-6 h-6 rounded-full flex items-center justify-center' : ''}
                                    ${!isToday && dayOfWeek === 0 ? 'text-red-500' : ''}
                                    ${!isToday && dayOfWeek === 6 ? 'text-blue-500' : ''}
                                    ${!isToday && dayOfWeek !== 0 && dayOfWeek !== 6 ? 'text-foreground' : ''}
                                `}>{day}</span>
                            </div>
                            {hasEvents && (
                                <div className="mt-0.5 space-y-0.5 flex-1 overflow-hidden">
                                    {events.map((evt, idx) => (
                                        <div key={idx} className={`text-[10px] leading-tight px-1 py-0.5 rounded truncate font-medium
                                            ${evt.type === 'birthday'
                                                ? 'bg-emerald-100 text-emerald-800 border border-emerald-200/60 dark:bg-emerald-900/30 dark:text-emerald-300 dark:border-emerald-700/40'
                                                : evt.isLunar
                                                    ? 'bg-amber-100 text-amber-800 border border-amber-200/60 dark:bg-amber-900/30 dark:text-amber-300 dark:border-amber-700/40'
                                                    : 'bg-sky-100 text-sky-800 border border-sky-200/60 dark:bg-sky-900/30 dark:text-sky-300 dark:border-sky-700/40'
                                            }`}
                                            title={`${evt.personName} — ${evt.type === 'birthday' ? 'Sinh nhật' : 'Giỗ'} ${evt.day}/${evt.month} ${evt.isLunar ? 'ÂL' : 'DL'}`}
                                        >
                                            {evt.type === 'birthday' ? '🎂' : '🕯️'} {evt.personName.split(' ').slice(-2).join(' ')}
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

/* ── Event card ── */
function EventCard({ event }: { event: CalendarEvent }) {
    const isSpouse = !event.isPatrilineal;
    const isBirthday = event.type === 'birthday';
    return (
        <div className={`flex items-center gap-3 p-3 rounded-xl bg-card border shadow-sm
            hover:shadow-md transition-all duration-200 group
            ${isBirthday ? 'border-emerald-200/80 hover:border-emerald-300/60 dark:border-emerald-800/40' : 'border-border hover:border-amber-300/60'}`}>
            <div className={`flex-shrink-0 w-12 h-12 rounded-full flex flex-col items-center justify-center border-2 transition-colors
                ${isBirthday
                    ? 'bg-gradient-to-br from-emerald-50 to-green-50 border-emerald-200 dark:from-emerald-950/30 dark:to-green-950/30 dark:border-emerald-700'
                    : event.isLunar
                        ? 'bg-gradient-to-br from-amber-50 to-orange-50 border-amber-200 dark:from-amber-950/30 dark:to-orange-950/30 dark:border-amber-700'
                        : 'bg-gradient-to-br from-sky-50 to-blue-50 border-sky-200 dark:from-sky-950/30 dark:to-blue-950/30 dark:border-sky-700'
                }`}>
                <span className={`text-base font-bold leading-none
                    ${isBirthday ? 'text-emerald-700 dark:text-emerald-300' : event.isLunar ? 'text-amber-700 dark:text-amber-300' : 'text-sky-700 dark:text-sky-300'}`}>
                    {event.day}
                </span>
                <span className={`text-[9px] font-medium
                    ${isBirthday ? 'text-emerald-500 dark:text-emerald-400' : event.isLunar ? 'text-amber-500 dark:text-amber-400' : 'text-sky-500 dark:text-sky-400'}`}>
                    th.{event.month}
                </span>
            </div>
            <div className="flex-1 min-w-0">
                <div className="flex items-center gap-1.5 flex-wrap">
                    <h3 className="font-semibold text-sm">{event.personName}</h3>
                    <Badge variant="secondary" className="text-[10px] px-1.5 py-0">Đời {event.generation}</Badge>
                    {isSpouse && <Badge variant="outline" className="text-[9px] px-1 py-0 text-pink-600 border-pink-200 dark:text-pink-400 dark:border-pink-700">Thân quyến</Badge>}
                </div>
                <p className="text-xs text-muted-foreground mt-0.5">
                    {isBirthday ? 'Sinh nhật' : 'Giỗ'}: {event.day}/{event.month} {event.isLunar ? 'ÂL' : 'DL'}
                    {' \u2192 '}{event.solarDay}/{event.solarMonth} DL
                    {event.year && <span className="ml-1 text-muted-foreground/60">· {isBirthday ? 'Sinh' : 'Mất'} {event.year}</span>}
                </p>
            </div>
            <div className="flex-shrink-0 text-xl opacity-60 group-hover:opacity-100 transition-opacity">
                {isBirthday ? '🎂' : '🕯️'}
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
    const [calendarYear, setCalendarYear] = useState(new Date().getFullYear());
    const [calendarMonth, setCalendarMonth] = useState(new Date().getMonth() + 1);
    const [activeTab, setActiveTab] = useState<'all' | 'memorial' | 'birthday'>('all');
    const [allEvents, setAllEvents] = useState<EventItem[]>([]);
    const [loading, setLoading] = useState(true);

    // Fetch people from Supabase
    const fetchEvents = useCallback(async () => {
        setLoading(true);
        try {
            const { data } = await supabase
                .from('people')
                .select('handle, display_name, gender, generation, birth_date, death_date, birth_year, death_year, is_living, is_patrilineal')
                .order('generation', { ascending: true });
            if (data) {
                setAllEvents(buildEventsFromPeople(data));
            } else {
                // Fallback to mock data
                setAllEvents(MOCK_MEMORIALS.map(m => ({
                    personHandle: m.personHandle, personName: m.personName,
                    generation: m.generation, gender: 1, day: m.day, month: m.month,
                    year: m.deathYear, isLunar: m.isLunar,
                    isPatrilineal: !m.personHandle.startsWith('S_'), type: 'memorial' as const,
                })));
            }
        } catch {
            // Fallback
            setAllEvents(MOCK_MEMORIALS.map(m => ({
                personHandle: m.personHandle, personName: m.personName,
                generation: m.generation, gender: 1, day: m.day, month: m.month,
                year: m.deathYear, isLunar: m.isLunar,
                isPatrilineal: !m.personHandle.startsWith('S_'), type: 'memorial' as const,
            })));
        } finally { setLoading(false); }
    }, []);

    useEffect(() => { fetchEvents(); }, [fetchEvents]);

    // Filter by tab
    const tabFilteredEvents = useMemo(() => {
        if (activeTab === 'memorial') return allEvents.filter(e => e.type === 'memorial');
        if (activeTab === 'birthday') return allEvents.filter(e => e.type === 'birthday');
        return allEvents;
    }, [allEvents, activeTab]);

    const calendarEvents = useMemo(() => buildCalendarEvents(tabFilteredEvents, calendarYear), [tabFilteredEvents, calendarYear]);
    const eventMap = useMemo(() => buildSolarEventMap(calendarEvents), [calendarEvents]);

    const currentMonthEvents = useMemo(() =>
        calendarEvents.filter(e => e.solarMonth === calendarMonth && e.solarYear === calendarYear),
    [calendarEvents, calendarMonth, calendarYear]);

    const generations = useMemo(() =>
        [...new Set(allEvents.map(m => m.generation))].sort((a, b) => a - b),
    [allEvents]);

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
        if (filterGen !== null) result = result.filter(m => m.generation === filterGen);
        if (filterType === 'lunar') result = result.filter(m => m.isLunar);
        else if (filterType === 'solar') result = result.filter(m => !m.isLunar);
        return result;
    }, [calendarEvents, currentMonthEvents, search, filterGen, filterType, selectedDay]);

    const memorialCount = allEvents.filter(e => e.type === 'memorial').length;
    const birthdayCount = allEvents.filter(e => e.type === 'birthday').length;
    const lunarCount = calendarEvents.filter(m => m.isLunar).length;
    const solarCount = calendarEvents.filter(m => !m.isLunar).length;

    const handleSelectDay = (y: number, m: number, d: number) => {
        if (selectedDay?.year === y && selectedDay?.month === m && selectedDay?.day === d) setSelectedDay(null);
        else setSelectedDay({ year: y, month: m, day: d });
    };
    const clearSelection = () => setSelectedDay(null);
    const prevMonth = () => { setSelectedDay(null); if (calendarMonth === 1) { setCalendarMonth(12); setCalendarYear(y => y - 1); } else setCalendarMonth(m => m - 1); };
    const nextMonth = () => { setSelectedDay(null); if (calendarMonth === 12) { setCalendarMonth(1); setCalendarYear(y => y + 1); } else setCalendarMonth(m => m + 1); };
    const prevYear = () => { setSelectedDay(null); setCalendarYear(y => y - 1); };
    const nextYear = () => { setSelectedDay(null); setCalendarYear(y => y + 1); };
    const goToToday = () => { const now = new Date(); setCalendarYear(now.getFullYear()); setCalendarMonth(now.getMonth() + 1); setSelectedDay(null); };

    return (
        <RequireAuth>
        <div className="space-y-6">
            {/* Header */}
            <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
                <div>
                    <h1 className="text-xl sm:text-2xl font-bold tracking-tight flex items-center gap-2">
                        <CalendarDays className="h-5 w-5 sm:h-6 sm:w-6" />
                        Sự kiện Dòng họ
                    </h1>
                    <p className="text-sm text-muted-foreground">
                        {loading ? 'Đang tải...' : `${memorialCount} ngày giỗ · ${birthdayCount} sinh nhật`}
                    </p>
                </div>
                <Tabs value={activeTab} onValueChange={v => { setActiveTab(v as typeof activeTab); setSelectedDay(null); }}>
                    <TabsList>
                        <TabsTrigger value="all" className="text-xs gap-1"><CalendarDays className="h-3.5 w-3.5" /> Tất cả</TabsTrigger>
                        <TabsTrigger value="memorial" className="text-xs gap-1">🕯️ Ngày giỗ</TabsTrigger>
                        <TabsTrigger value="birthday" className="text-xs gap-1">🎂 Sinh nhật</TabsTrigger>
                    </TabsList>
                </Tabs>
            </div>

            {/* Two-column layout */}
            <div className="grid grid-cols-1 lg:grid-cols-[1fr_340px] gap-4 lg:gap-6">
                {/* LEFT: Calendar */}
                <div className="space-y-3">
                    <div className="flex items-center justify-between">
                        <div className="flex items-center gap-1">
                            <Button variant="ghost" size="icon" className="h-8 w-8" onClick={prevYear} title="Năm trước"><ChevronsLeft className="h-4 w-4" /></Button>
                            <Button variant="ghost" size="icon" className="h-8 w-8" onClick={prevMonth} title="Tháng trước"><ChevronLeft className="h-4 w-4" /></Button>
                        </div>
                        <div className="flex items-center gap-3">
                            <h2 className="text-lg font-bold">{SOLAR_MONTH_NAMES[calendarMonth]} — {calendarYear}</h2>
                            <Button variant="outline" size="sm" className="text-xs h-7" onClick={goToToday}>Hôm nay</Button>
                        </div>
                        <div className="flex items-center gap-1">
                            <Button variant="ghost" size="icon" className="h-8 w-8" onClick={nextMonth} title="Tháng sau"><ChevronRight className="h-4 w-4" /></Button>
                            <Button variant="ghost" size="icon" className="h-8 w-8" onClick={nextYear} title="Năm sau"><ChevronsRight className="h-4 w-4" /></Button>
                        </div>
                    </div>

                    {/* Legend */}
                    <div className="flex items-center gap-3 sm:gap-4 text-[11px] text-muted-foreground flex-wrap">
                        <span className="flex items-center gap-1"><span className="w-3 h-3 rounded bg-amber-100 border border-amber-200 dark:bg-amber-900/30 dark:border-amber-700" /> Giỗ Âm lịch</span>
                        <span className="flex items-center gap-1"><span className="w-3 h-3 rounded bg-sky-100 border border-sky-200 dark:bg-sky-900/30 dark:border-sky-700" /> Giỗ Dương lịch</span>
                        <span className="flex items-center gap-1"><span className="w-3 h-3 rounded bg-emerald-100 border border-emerald-200 dark:bg-emerald-900/30 dark:border-emerald-700" /> Sinh nhật</span>
                    </div>

                    {loading ? (
                        <div className="flex items-center justify-center h-48"><div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary" /></div>
                    ) : (
                        <BigCalendar year={calendarYear} month={calendarMonth} eventMap={eventMap} selectedDay={selectedDay} onSelectDay={handleSelectDay} />
                    )}

                    <div className="text-xs text-muted-foreground text-center">
                        {currentMonthEvents.length > 0
                            ? `${SOLAR_MONTH_NAMES[calendarMonth]} có ${currentMonthEvents.length} sự kiện`
                            : `${SOLAR_MONTH_NAMES[calendarMonth]} không có sự kiện`}
                        {' · '}Tổng năm {calendarYear}: {calendarEvents.length} sự kiện
                    </div>
                </div>

                {/* RIGHT: Event List */}
                <div className="space-y-4">
                    <div className="flex items-center justify-between flex-wrap gap-2">
                        <h2 className="text-base font-semibold flex items-center gap-2">
                            {activeTab === 'birthday' ? '🎂' : activeTab === 'memorial' ? '🕯️' : '📅'}
                            {selectedDay ? <span>Ngày {selectedDay.day}/{selectedDay.month}/{selectedDay.year}</span> : <span>{SOLAR_MONTH_NAMES[calendarMonth]}</span>}
                        </h2>
                        {selectedDay && (
                            <Button variant="ghost" size="sm" onClick={clearSelection} className="gap-1 text-xs h-7"><X className="h-3 w-3" /> Cả tháng</Button>
                        )}
                    </div>

                    <div className="space-y-2">
                        <div className="relative">
                            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                            <Input placeholder="Tìm theo tên..." className="pl-9 h-8 text-sm" value={search} onChange={e => setSearch(e.target.value)} />
                        </div>
                        <div className="flex items-center gap-2">
                            <Filter className="h-3.5 w-3.5 text-muted-foreground flex-shrink-0" />
                            <select className="rounded-md border px-2 py-1 text-xs bg-background flex-1" value={filterGen ?? ''} onChange={e => setFilterGen(e.target.value ? parseInt(e.target.value) : null)}>
                                <option value="">Tất cả đời</option>
                                {generations.map(g => <option key={g} value={g}>Đời {g}</option>)}
                            </select>
                            <select className="rounded-md border px-2 py-1 text-xs bg-background" value={filterType} onChange={e => setFilterType(e.target.value as typeof filterType)}>
                                <option value="all">Tất cả</option>
                                <option value="lunar">🌙 Âm ({lunarCount})</option>
                                <option value="solar">☀️ DL ({solarCount})</option>
                            </select>
                        </div>
                    </div>

                    <div className="space-y-2 max-h-[calc(100vh-380px)] overflow-y-auto pr-1">
                        {filtered.length === 0 ? (
                            <Card>
                                <CardContent className="flex flex-col items-center justify-center py-8">
                                    <CalendarDays className="h-10 w-10 text-muted-foreground mb-3" />
                                    <p className="text-sm text-muted-foreground text-center">
                                        {selectedDay ? `Không có sự kiện vào ${selectedDay.day}/${selectedDay.month}` : `Không có sự kiện trong ${SOLAR_MONTH_NAMES[calendarMonth]}`}
                                    </p>
                                    {selectedDay && <Button variant="link" size="sm" onClick={clearSelection} className="mt-1 text-xs">Xem cả tháng</Button>}
                                </CardContent>
                            </Card>
                        ) : (
                            filtered.sort((a, b) => a.solarDay - b.solarDay).map((m, i) => <EventCard key={`${m.personHandle}-${m.type}-${i}`} event={m} />)
                        )}
                    </div>

                    <Card className="bg-muted/50 border-border">
                        <CardContent className="py-2.5">
                            <div className="flex items-center justify-between text-xs flex-wrap gap-1">
                                <span className="text-muted-foreground"><strong>{filtered.length}</strong> sự kiện</span>
                                <div className="flex items-center gap-2 text-muted-foreground">
                                    <span className="flex items-center gap-1"><Users className="h-3 w-3" /> {filtered.filter(m => m.type === 'memorial').length} giỗ</span>
                                    <span className="flex items-center gap-1"><Cake className="h-3 w-3" /> {filtered.filter(m => m.type === 'birthday').length} sinh nhật</span>
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
