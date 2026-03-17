'use client';

import { type ReactNode } from 'react';

export interface TraditionalTemplateProps {
    title: string;
    subtitle: string;
    coupletLeft: string;
    coupletRight: string;
    coupletFontSize: number; // rem
    headerScale: number; // 50-150 %
    treeWidth: number;
    treeHeight: number;
    children: ReactNode; // tree content
}

/** Hồi văn / Meander / Greek-key border — 3 layers: gold line + pattern + gold line */
function MeanderBorder() {
    // SVG encodes a single meander tile (48×24) with classic right-angle spiral
    const tile = encodeURIComponent(
        `<svg width='48' height='24' viewBox='0 0 48 24' xmlns='http://www.w3.org/2000/svg'>` +
        `<path d='M0,0 h12 v24 h12 v-12 h-12 v-12 h24 v24 h12 v-24' fill='none' stroke='%23b8860b' stroke-width='2.5'/>` +
        `</svg>`
    );
    return (
        <div className="w-full flex flex-col items-stretch">
            {/* Outer gold line */}
            <div className="h-[2px] w-full bg-gradient-to-r from-transparent via-amber-600 to-transparent" />
            {/* Meander pattern row */}
            <div className="w-full" style={{
                height: 28,
                backgroundImage: `url("data:image/svg+xml,${tile}")`,
                backgroundRepeat: 'repeat-x',
                backgroundSize: '48px 24px',
                backgroundPosition: 'center',
            }} />
            {/* Inner gold line */}
            <div className="h-[2px] w-full bg-gradient-to-r from-transparent via-amber-600 to-transparent" />
        </div>
    );
}

/** Cuốn thư header SVG — red-gold scroll with family name */
function ScrollHeader({ title, subtitle, scale }: { title: string; subtitle: string; scale: number }) {
    const s = scale / 100;
    return (
        <div className="flex flex-col items-center" style={{ transform: `scale(${s})`, transformOrigin: 'top center' }}>
            {/* Dragon + Scroll container */}
            <div className="relative flex items-center justify-center" style={{ minWidth: 700 }}>
                {/* Left dragon (stylized) */}
                <DragonSVG flip={false} />

                {/* Center scroll */}
                <div className="relative mx-[-20px] z-10">
                    {/* Scroll body */}
                    <div className="relative">
                        {/* Top ornamental bar */}
                        <div className="h-3 bg-gradient-to-r from-amber-700 via-yellow-500 to-amber-700 rounded-t-lg mx-4" />

                        {/* Scroll background */}
                        <div className="bg-gradient-to-b from-red-700 via-red-600 to-red-800 px-12 py-6 relative overflow-hidden"
                            style={{ minWidth: 350 }}>
                            {/* Decorative pattern overlay */}
                            <div className="absolute inset-0 opacity-10"
                                style={{
                                    backgroundImage: `repeating-linear-gradient(45deg, transparent, transparent 10px, rgba(255,215,0,0.3) 10px, rgba(255,215,0,0.3) 12px)`,
                                }} />

                            {/* Gold inner border */}
                            <div className="border-2 border-yellow-400/60 rounded-sm px-8 py-4 relative">
                                {/* Corner ornaments */}
                                <div className="absolute top-0 left-0 w-4 h-4 border-t-2 border-l-2 border-yellow-400 rounded-tl" />
                                <div className="absolute top-0 right-0 w-4 h-4 border-t-2 border-r-2 border-yellow-400 rounded-tr" />
                                <div className="absolute bottom-0 left-0 w-4 h-4 border-b-2 border-l-2 border-yellow-400 rounded-bl" />
                                <div className="absolute bottom-0 right-0 w-4 h-4 border-b-2 border-r-2 border-yellow-400 rounded-br" />

                                <h1 className="text-center font-bold text-yellow-300 drop-shadow-lg"
                                    style={{ fontSize: '2rem', fontFamily: '"Noto Serif", "Times New Roman", serif', textShadow: '2px 2px 4px rgba(0,0,0,0.5)' }}>
                                    {title}
                                </h1>
                                {subtitle && (
                                    <p className="text-center text-yellow-200/90 mt-1"
                                        style={{ fontSize: '0.85rem', fontFamily: '"Noto Serif", serif' }}>
                                        {subtitle}
                                    </p>
                                )}
                            </div>
                        </div>

                        {/* Bottom ornamental bar */}
                        <div className="h-3 bg-gradient-to-r from-amber-700 via-yellow-500 to-amber-700 rounded-b-lg mx-4" />

                        {/* Scroll side rolls */}
                        <div className="absolute -left-3 top-1/2 -translate-y-1/2 w-6 h-20 bg-gradient-to-r from-amber-600 to-amber-500 rounded-l-full shadow-md" />
                        <div className="absolute -right-3 top-1/2 -translate-y-1/2 w-6 h-20 bg-gradient-to-l from-amber-600 to-amber-500 rounded-r-full shadow-md" />
                    </div>
                </div>

                {/* Right dragon (stylized) */}
                <DragonSVG flip={true} />
            </div>

            {/* Hanging tassels */}
            <div className="flex justify-center gap-40 -mt-1">
                <Tassel />
                <Tassel />
            </div>
        </div>
    );
}

/** Stylized dragon SVG — traditional Vietnamese style */
function DragonSVG({ flip }: { flip: boolean }) {
    return (
        <div style={{ transform: flip ? 'scaleX(-1)' : undefined, width: 160, height: 140 }}>
            <svg viewBox="0 0 200 180" width="160" height="140" xmlns="http://www.w3.org/2000/svg">
                {/* Dragon body — golden serpentine shape */}
                <defs>
                    <linearGradient id={flip ? "dragonGradR" : "dragonGradL"} x1="0%" y1="0%" x2="100%" y2="100%">
                        <stop offset="0%" stopColor="#d4a017" />
                        <stop offset="50%" stopColor="#ffd700" />
                        <stop offset="100%" stopColor="#b8860b" />
                    </linearGradient>
                </defs>
                {/* Simplified dragon silhouette */}
                <path d="M30,90 C40,60 60,40 90,35 C110,32 120,40 130,55 C140,70 155,75 170,70 C180,67 185,60 180,50 C175,40 160,35 150,40"
                    fill="none" stroke={`url(#${flip ? "dragonGradR" : "dragonGradL"})`} strokeWidth="8" strokeLinecap="round" />
                {/* Dragon head */}
                <circle cx="150" cy="40" r="12" fill="#d4a017" />
                <circle cx="155" cy="37" r="3" fill="#8b0000" />
                {/* Horn */}
                <path d="M148,30 L142,15 L153,25" fill="#b8860b" />
                {/* Whiskers */}
                <path d="M162,40 C170,35 178,38 185,33" fill="none" stroke="#d4a017" strokeWidth="2" />
                <path d="M162,43 C170,45 178,42 185,47" fill="none" stroke="#d4a017" strokeWidth="2" />
                {/* Body curves */}
                <path d="M30,90 C20,100 15,115 25,130 C35,145 55,140 65,125 C75,110 85,105 95,110"
                    fill="none" stroke={`url(#${flip ? "dragonGradR" : "dragonGradL"})`} strokeWidth="6" strokeLinecap="round" />
                {/* Tail flame */}
                <path d="M25,130 C15,140 10,155 20,160 C30,155 25,145 30,135"
                    fill="#ff6347" opacity="0.7" />
                {/* Scales pattern */}
                {[50, 70, 90, 110, 130].map(x => (
                    <circle key={x} cx={x} cy={55 + Math.sin(x / 15) * 15} r="4" fill="#ffd700" opacity="0.4" />
                ))}
                {/* Cloud wisps */}
                <path d="M60,80 C65,75 75,75 80,80 C85,75 95,75 100,80"
                    fill="none" stroke="#ffd700" strokeWidth="1.5" opacity="0.3" />
            </svg>
        </div>
    );
}

/** Decorative tassel */
function Tassel() {
    return (
        <div className="flex flex-col items-center">
            <div className="w-1 h-6 bg-gradient-to-b from-amber-600 to-red-700" />
            <div className="w-4 h-4 rounded-full bg-gradient-to-b from-red-600 to-red-800 shadow-sm" />
            <div className="flex gap-0.5 mt-0.5">
                {[0, 1, 2].map(i => (
                    <div key={i} className="w-0.5 h-8 bg-gradient-to-b from-red-700 to-red-500 rounded-b" />
                ))}
            </div>
        </div>
    );
}

/** Vertical couplet text — Vietnamese calligraphy style */
function VerticalCouplet({ text, fontSize, side }: { text: string; fontSize: number; side: 'left' | 'right' }) {
    return (
        <div
            className={`absolute top-1/4 ${side === 'left' ? 'left-0' : 'right-0'} flex flex-col items-center`}
            style={{ width: `${Math.max(fontSize * 1.5, 3)}rem` }}
        >
            <div
                className="text-red-800 font-bold leading-relaxed text-center select-none"
                style={{
                    writingMode: 'vertical-rl',
                    textOrientation: 'mixed',
                    fontSize: `${fontSize}px`,
                    fontFamily: '"Ma Shan Zheng", "Noto Serif", "Times New Roman", cursive, serif',
                    letterSpacing: '0.15em',
                    textShadow: '1px 1px 2px rgba(139,0,0,0.2)',
                }}
            >
                {text}
            </div>
        </div>
    );
}

/** Traditional template wrapper — cuốn thư + câu đối + nền giấy cổ */
export function TraditionalTemplate({
    title, subtitle, coupletLeft, coupletRight, coupletFontSize, headerScale,
    treeWidth, treeHeight, children,
}: TraditionalTemplateProps) {
    // Calculate side margins for couplets
    const sideMargin = Math.max(coupletFontSize * 2, 60);

    return (
        <div
            className="relative"
            style={{
                // Vintage paper background
                background: 'linear-gradient(135deg, #f5edde 0%, #f0e4ce 30%, #e8d9b8 70%, #f0e4ce 100%)',
                minWidth: treeWidth + sideMargin * 2 + 80,
                minHeight: treeHeight + 400,
            }}
        >
            {/* Paper texture overlay */}
            <div className="absolute inset-0 pointer-events-none" style={{
                backgroundImage: `url("data:image/svg+xml,%3Csvg viewBox='0 0 256 256' xmlns='http://www.w3.org/2000/svg'%3E%3Cfilter id='noise'%3E%3CfeTurbulence type='fractalNoise' baseFrequency='0.9' numOctaves='4' stitchTiles='stitch'/%3E%3C/filter%3E%3Crect width='100%25' height='100%25' filter='url(%23noise)' opacity='0.03'/%3E%3C/svg%3E")`,
                opacity: 0.5,
            }} />

            {/* Top meander border (hồi văn) */}
            <MeanderBorder />

            {/* Header — cuốn thư with dragons */}
            <div className="pt-6 pb-4">
                <ScrollHeader title={title} subtitle={subtitle} scale={headerScale} />
            </div>

            {/* Main content area with couplets */}
            <div className="relative" style={{ paddingLeft: sideMargin, paddingRight: sideMargin, paddingBottom: 40 }}>
                {/* Left couplet */}
                {coupletLeft && (
                    <VerticalCouplet text={coupletLeft} fontSize={coupletFontSize} side="left" />
                )}

                {/* Tree content */}
                <div className="mx-auto" style={{ width: treeWidth }}>
                    {children}
                </div>

                {/* Right couplet */}
                {coupletRight && (
                    <VerticalCouplet text={coupletRight} fontSize={coupletFontSize} side="right" />
                )}
            </div>

            {/* Bottom meander border (hồi văn) */}
            <MeanderBorder />
        </div>
    );
}
