'use client';

import { useEffect, useState, useRef } from 'react';
import { motion, useInView, animate } from 'framer-motion';
import {
    TreePine, Users, BookOpen, ArrowRight, GitBranch,
    MapPin, ScrollText, Sparkles,
} from 'lucide-react';
import Link from 'next/link';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { supabase } from '@/lib/supabase';

// ─── Types ────────────────────────────────────────────────────────
interface Stats {
    people: number;
    families: number;
}

// ─── Animation Variants ──────────────────────────────────────────
const staggerContainer = {
    hidden: { opacity: 0 },
    visible: {
        opacity: 1,
        transition: { staggerChildren: 0.12, delayChildren: 0.15 },
    },
} as const;

const fadeUp = {
    hidden: { opacity: 0, y: 28 },
    visible: { opacity: 1, y: 0, transition: { duration: 0.7, ease: 'easeOut' as const } },
} as const;

// ─── AnimatedCounter ────────────────────────────────────────────
function AnimatedCounter({ target, duration = 2 }: { target: number; duration?: number }) {
    const [count, setCount] = useState(0);
    const ref = useRef<HTMLSpanElement>(null);
    const inView = useInView(ref, { once: true });

    useEffect(() => {
        if (!inView || target <= 0) return;
        const controls = animate(0, target, {
            duration,
            ease: 'easeOut',
            onUpdate: (v) => setCount(Math.round(v)),
        });
        return () => controls.stop();
    }, [inView, target, duration]);

    return <span ref={ref}>{count}</span>;
}

// ─── Decorative Lotus SVG (background) ──────────────────────────
function LotusDecoration() {
    return (
        <svg className="absolute -right-8 -bottom-6 w-48 h-48 sm:w-64 sm:h-64 lg:w-80 lg:h-80 opacity-[0.04] dark:opacity-[0.02] pointer-events-none" viewBox="0 0 200 200" aria-hidden="true">
            {/* Center petal */}
            <ellipse cx="100" cy="80" rx="18" ry="50" fill="currentColor" transform="rotate(0,100,100)" />
            {/* Side petals */}
            <ellipse cx="100" cy="80" rx="16" ry="48" fill="currentColor" transform="rotate(30,100,100)" />
            <ellipse cx="100" cy="80" rx="16" ry="48" fill="currentColor" transform="rotate(-30,100,100)" />
            <ellipse cx="100" cy="80" rx="14" ry="44" fill="currentColor" transform="rotate(55,100,100)" />
            <ellipse cx="100" cy="80" rx="14" ry="44" fill="currentColor" transform="rotate(-55,100,100)" />
            <ellipse cx="100" cy="80" rx="12" ry="38" fill="currentColor" transform="rotate(78,100,100)" />
            <ellipse cx="100" cy="80" rx="12" ry="38" fill="currentColor" transform="rotate(-78,100,100)" />
            {/* Center dot */}
            <circle cx="100" cy="100" r="10" fill="currentColor" opacity="0.5" />
        </svg>
    );
}

// ─── Traditional Vietnamese Cloud SVG ───────────────────────────
function CloudDecoration() {
    return (
        <svg className="absolute left-4 top-4 w-32 h-20 sm:w-48 sm:h-28 lg:w-56 lg:h-32 opacity-[0.04] dark:opacity-[0.02] pointer-events-none" viewBox="0 0 200 100" aria-hidden="true">
            <path d="M30,70 Q30,40 60,40 Q60,15 90,20 Q110,5 135,20 Q160,10 170,35 Q195,35 190,55 Q200,75 175,75 L30,75 Q10,75 30,70 Z" fill="currentColor" />
            <circle cx="65" cy="50" r="3" fill="currentColor" opacity="0.3" />
            <circle cx="90" cy="35" r="2.5" fill="currentColor" opacity="0.3" />
            <circle cx="140" cy="40" r="3" fill="currentColor" opacity="0.3" />
        </svg>
    );
}

// ─── Animated Family Tree SVG ───────────────────────────────────
function AnimatedFamilyTree() {
    const branches = [
        { x1: 200, y1: 380, x2: 200, y2: 140, w: 3 },
        { x1: 200, y1: 140, x2: 100, y2: 80, w: 2.5 },
        { x1: 200, y1: 140, x2: 300, y2: 80, w: 2.5 },
        { x1: 100, y1: 80, x2: 50, y2: 35, w: 2 },
        { x1: 100, y1: 80, x2: 140, y2: 40, w: 2 },
        { x1: 300, y1: 80, x2: 260, y2: 40, w: 2 },
        { x1: 300, y1: 80, x2: 350, y2: 35, w: 2 },
        { x1: 200, y1: 220, x2: 120, y2: 180, w: 2 },
        { x1: 200, y1: 220, x2: 280, y2: 180, w: 2 },
        { x1: 200, y1: 300, x2: 130, y2: 260, w: 1.5 },
        { x1: 200, y1: 300, x2: 270, y2: 260, w: 1.5 },
        { x1: 50, y1: 35, x2: 25, y2: 15, w: 1.5 },
        { x1: 50, y1: 35, x2: 75, y2: 15, w: 1.5 },
        { x1: 350, y1: 35, x2: 325, y2: 15, w: 1.5 },
        { x1: 350, y1: 35, x2: 375, y2: 15, w: 1.5 },
    ];

    const nodes = [
        { x: 200, y: 140, r: 6 },
        { x: 100, y: 80, r: 4.5 }, { x: 300, y: 80, r: 4.5 },
        { x: 50, y: 35, r: 3.5 }, { x: 140, y: 40, r: 3.5 }, { x: 260, y: 40, r: 3.5 }, { x: 350, y: 35, r: 3.5 },
        { x: 120, y: 180, r: 3.5 }, { x: 280, y: 180, r: 3.5 },
        { x: 130, y: 260, r: 3 }, { x: 270, y: 260, r: 3 },
        { x: 25, y: 15, r: 2.5 }, { x: 75, y: 15, r: 2.5 }, { x: 325, y: 15, r: 2.5 }, { x: 375, y: 15, r: 2.5 },
    ];

    return (
        <motion.svg
            viewBox="0 0 400 400"
            className="absolute right-4 sm:right-8 top-1/2 -translate-y-1/2 w-56 h-56 sm:w-72 sm:h-72 lg:w-[380px] lg:h-[380px] text-amber-900/[0.06] dark:text-amber-200/[0.03] hidden sm:block pointer-events-none"
            aria-hidden="true"
        >
            {branches.map((b, i) => (
                <motion.line
                    key={`b-${i}`}
                    x1={b.x1} y1={b.y1} x2={b.x2} y2={b.y2}
                    stroke="currentColor" strokeWidth={b.w} strokeLinecap="round"
                    initial={{ pathLength: 0 }}
                    animate={{ pathLength: 1 }}
                    transition={{ duration: i < 3 ? 1.2 : 0.7, delay: i < 1 ? 0.2 : 0.5 + i * 0.1, ease: 'easeOut' }}
                />
            ))}
            {nodes.map((n, i) => (
                <motion.circle
                    key={`n-${i}`}
                    cx={n.x} cy={n.y} r={n.r}
                    fill="currentColor"
                    initial={{ scale: 0, opacity: 0 }}
                    animate={{ scale: 1, opacity: 0.8 }}
                    transition={{ delay: 1.5 + i * 0.08, duration: 0.35 }}
                />
            ))}
            <motion.circle
                cx={200} cy={140} r={12}
                fill="none" stroke="currentColor" strokeWidth={1}
                initial={{ scale: 0, opacity: 0 }}
                animate={{ scale: [1, 1.5, 1], opacity: [0.3, 0, 0.3] }}
                transition={{ delay: 2, duration: 3, repeat: Infinity }}
            />
        </motion.svg>
    );
}

// ─── Ornate Border ──────────────────────────────────────────────
function OrnateBorder() {
    return (
        <div className="relative h-2">
            <svg className="w-full h-2 text-amber-600/40 dark:text-amber-400/20" viewBox="0 0 1200 8" preserveAspectRatio="none" aria-hidden="true">
                <defs>
                    <pattern id="ornate-border" x="0" y="0" width="60" height="8" patternUnits="userSpaceOnUse">
                        <path d="M0,4 C7.5,0 15,0 22.5,4 C30,8 37.5,8 45,4 C52.5,0 60,0 60,4" fill="none" stroke="currentColor" strokeWidth="1.5" />
                        <circle cx="22.5" cy="4" r="1.2" fill="currentColor" opacity="0.6" />
                        <circle cx="45" cy="4" r="1.2" fill="currentColor" opacity="0.6" />
                    </pattern>
                </defs>
                <rect width="1200" height="8" fill="url(#ornate-border)" />
            </svg>
        </div>
    );
}

// ─── Hero Section ───────────────────────────────────────────────
function HeroSection({ stats, loading }: { stats: Stats; loading: boolean }) {
    return (
        <div className="-mx-3 sm:-mx-4 lg:-mx-6 -mt-3 sm:-mt-4 lg:-mt-6 mb-6 sm:mb-8 overflow-hidden">
            <div className="relative overflow-hidden">
                {/* Multi-layer background */}
                <div className="absolute inset-0 bg-gradient-to-br from-amber-50 via-orange-50/80 to-yellow-100/60 dark:from-slate-950 dark:via-indigo-950/70 dark:to-slate-900" />
                <div className="absolute inset-0 bg-gradient-to-t from-amber-100/30 via-transparent to-transparent dark:from-amber-900/10" />

                {/* Subtle paper texture */}
                <div
                    className="absolute inset-0 opacity-[0.025] dark:opacity-[0.015]"
                    style={{
                        backgroundImage: `url("data:image/svg+xml,%3Csvg width='60' height='60' viewBox='0 0 60 60' xmlns='http://www.w3.org/2000/svg'%3E%3Cg fill='none' fill-rule='evenodd'%3E%3Cg fill='%23000000' fill-opacity='1'%3E%3Cpath d='M36 34v-4h-2v4h-4v2h4v4h2v-4h4v-2h-4zm0-30V0h-2v4h-4v2h4v4h2V6h4V4h-4zM6 34v-4H4v4H0v2h4v4h2v-4h4v-2H6zM6 4V0H4v4H0v2h4v4h2V6h4V4H6z'/%3E%3C/g%3E%3C/g%3E%3C/svg%3E")`,
                    }}
                />

                {/* Radial glow behind title area */}
                <div className="absolute top-1/2 left-1/4 -translate-y-1/2 w-[500px] h-[300px] bg-amber-200/20 dark:bg-amber-700/5 rounded-full blur-3xl pointer-events-none" />

                {/* Decorative elements */}
                <CloudDecoration />
                <LotusDecoration />
                <AnimatedFamilyTree />

                <motion.div
                    className="relative z-10 px-6 py-10 sm:px-10 sm:py-14 lg:px-16 lg:py-16 max-w-2xl"
                    variants={staggerContainer}
                    initial="hidden"
                    animate="visible"
                >
                    <motion.div variants={fadeUp}>
                        <Badge className="mb-5 bg-amber-100/90 text-amber-800 border-amber-300/60 dark:bg-amber-900/40 dark:text-amber-300 dark:border-amber-700/40 hover:bg-amber-100 text-xs sm:text-sm px-3.5 py-1.5 shadow-sm">
                            <Sparkles className="h-3 w-3 mr-1.5" />
                            Gia phả điện tử
                        </Badge>
                    </motion.div>

                    <motion.h1
                        variants={fadeUp}
                        className="text-3xl sm:text-4xl lg:text-[3.5rem] font-bold tracking-tight mb-3 lg:mb-4 leading-tight"
                    >
                        <span className="bg-gradient-to-r from-amber-950 via-amber-800 to-amber-700 dark:from-amber-100 dark:via-amber-200 dark:to-amber-300 bg-clip-text text-transparent drop-shadow-sm">
                            Dòng họ Nguyễn Duy
                        </span>
                    </motion.h1>

                    <motion.div variants={fadeUp} className="flex items-center gap-2 text-muted-foreground mb-5 lg:mb-6">
                        <MapPin className="h-4 w-4 shrink-0 text-amber-600 dark:text-amber-400" />
                        <p className="text-sm sm:text-base lg:text-lg">
                            Nhánh cụ Khoan Giản — Làng Nghìn, An Bài, Quỳnh Phụ, Thái Bình
                        </p>
                    </motion.div>

                    <motion.div
                        variants={fadeUp}
                        className="flex items-center gap-4 sm:gap-6 mb-8 lg:mb-10"
                    >
                        <div className="flex items-center gap-2.5">
                            <div className="h-9 w-9 rounded-full bg-amber-200/60 dark:bg-amber-800/30 flex items-center justify-center ring-1 ring-amber-300/40 dark:ring-amber-700/30">
                                <Users className="h-4 w-4 text-amber-700 dark:text-amber-400" />
                            </div>
                            <div>
                                <span className="text-lg sm:text-xl font-bold text-foreground">
                                    {loading ? <span className="inline-block h-5 w-8 bg-muted animate-pulse rounded" /> : <AnimatedCounter target={stats.people} />}
                                </span>
                                <span className="text-xs sm:text-sm text-muted-foreground ml-1">thành viên</span>
                            </div>
                        </div>
                        <div className="w-px h-7 bg-amber-300/50 dark:bg-amber-700/30" />
                        <div className="flex items-center gap-2.5">
                            <div className="h-9 w-9 rounded-full bg-amber-200/60 dark:bg-amber-800/30 flex items-center justify-center ring-1 ring-amber-300/40 dark:ring-amber-700/30">
                                <GitBranch className="h-4 w-4 text-amber-700 dark:text-amber-400" />
                            </div>
                            <div>
                                <span className="text-lg sm:text-xl font-bold text-foreground">16</span>
                                <span className="text-xs sm:text-sm text-muted-foreground ml-1">thế hệ</span>
                            </div>
                        </div>
                    </motion.div>

                    <motion.div variants={fadeUp} className="flex flex-wrap gap-3">
                        <Link href="/pha-do">
                            <Button size="lg" className="gap-2 bg-gradient-to-r from-amber-700 to-amber-800 hover:from-amber-800 hover:to-amber-900 dark:from-amber-600 dark:to-amber-700 dark:hover:from-amber-500 dark:hover:to-amber-600 text-white shadow-lg shadow-amber-800/25 dark:shadow-amber-600/20 transition-all duration-300">
                                <TreePine className="h-4 w-4 sm:h-5 sm:w-5" />
                                Xem Phả đồ
                                <ArrowRight className="h-4 w-4" />
                            </Button>
                        </Link>
                        <Link href="/gia-pha">
                            <Button size="lg" variant="outline" className="gap-2 border-amber-300/80 text-amber-800 hover:bg-amber-100/50 dark:border-amber-600/40 dark:text-amber-300 dark:hover:bg-amber-900/20 backdrop-blur-sm transition-all duration-300">
                                <BookOpen className="h-4 w-4 sm:h-5 sm:w-5" />
                                Sách gia phả
                            </Button>
                        </Link>
                    </motion.div>
                </motion.div>

                <OrnateBorder />
            </div>
        </div>
    );
}

// ─── About / Lời giới thiệu ────────────────────────────────────
function AboutSection() {
    const ref = useRef<HTMLDivElement>(null);
    const inView = useInView(ref, { once: true, margin: '-40px' });

    return (
        <motion.div
            ref={ref}
            initial="hidden"
            animate={inView ? 'visible' : 'hidden'}
            variants={staggerContainer}
        >
            <motion.div variants={fadeUp} className="flex items-center gap-3 mb-4">
                <div className="h-9 w-9 rounded-lg bg-amber-100 dark:bg-amber-900/30 flex items-center justify-center">
                    <ScrollText className="h-5 w-5 text-amber-700 dark:text-amber-400" />
                </div>
                <h2 className="text-lg sm:text-xl font-bold">Lời giới thiệu</h2>
            </motion.div>

            <motion.div variants={fadeUp}>
                <Card className="border-amber-200/50 dark:border-amber-800/20 bg-gradient-to-br from-amber-50/50 via-transparent to-transparent dark:from-amber-950/10">
                    <CardContent className="p-5 sm:p-6 lg:p-8">
                        <div className="space-y-3 text-sm sm:text-base text-muted-foreground leading-relaxed">
                            <p>
                                <span className="text-foreground font-medium">Dòng họ Nguyễn Duy</span> —
                                nhánh cụ Khoan Giản, có gốc gác tại làng Nghìn, xã An Bài,
                                huyện Quỳnh Phụ, tỉnh Thái Bình (nay là xã Phụ Dực, tỉnh Hưng Yên).
                                Trải qua <span className="text-foreground font-medium">16 thế hệ</span> với
                                hơn 100 thành viên, dòng họ đã lưu giữ và phát triển những giá trị
                                truyền thống quý báu.
                            </p>
                            <p>
                                Gia phả điện tử này được xây dựng nhằm <span className="text-foreground font-medium">số hóa
                                và bảo tồn</span> thông tin phả hệ, giúp các thế hệ con cháu
                                dễ dàng tìm hiểu nguồn gốc, kết nối thân tộc và gìn giữ nét đẹp
                                văn hóa của gia đình.
                            </p>
                        </div>
                    </CardContent>
                </Card>
            </motion.div>
        </motion.div>
    );
}

// ─── Copyright Footer ───────────────────────────────────────────
function CopyrightFooter() {
    return (
        <footer className="-mx-3 sm:-mx-4 lg:-mx-6 -mb-3 sm:-mb-4 lg:-mb-6 mt-8 sm:mt-12">
            <div className="border-t border-amber-200/40 dark:border-amber-800/20 bg-gradient-to-b from-amber-50/30 to-amber-50/60 dark:from-transparent dark:to-amber-950/10 px-6 py-5 sm:px-10 sm:py-6">
                <p className="text-xs sm:text-[13px] text-muted-foreground leading-relaxed text-center">
                    Gia phả dòng họ{' '}
                    <span className="font-semibold text-foreground">Nguyễn Duy</span>
                    {' '}— Làng Nghìn, An Bài, Quỳnh Phụ, Thái Bình nay là xã Phụ Dực, tỉnh Hưng Yên.
                </p>
                <p className="text-[11px] sm:text-xs text-muted-foreground/60 text-center mt-1.5">
                    Copyright by Nguyen Duy Hai &copy; 2026
                </p>
            </div>
        </footer>
    );
}

// ─── Main Page ──────────────────────────────────────────────────
export default function HomePage() {
    const [stats, setStats] = useState<Stats>({ people: 0, families: 0 });
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        async function fetchStats() {
            try {
                const [{ count: people }, { count: families }] = await Promise.all([
                    supabase.from('people').select('*', { count: 'exact', head: true }).gte('generation', 10),
                    supabase.from('families').select('*', { count: 'exact', head: true }),
                ]);
                setStats({ people: people || 0, families: families || 0 });
            } catch { /* ignore */ }
            finally { setLoading(false); }
        }
        fetchStats();
    }, []);

    return (
        <div className="h-full overflow-y-auto -m-3 sm:-m-4 lg:-m-6">
            <div className="min-h-full flex flex-col p-3 sm:p-4 lg:p-6">
                <div className="flex-1 space-y-8 sm:space-y-10">
                    <HeroSection stats={stats} loading={loading} />
                    <AboutSection />
                </div>
                <CopyrightFooter />
            </div>
        </div>
    );
}
