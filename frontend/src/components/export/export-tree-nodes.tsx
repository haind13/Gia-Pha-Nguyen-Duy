'use client';

import { useMemo } from 'react';
import {
    CARD_W, CARD_H,
    type LayoutResult, type PositionedNode, type PositionedCouple,
    type CardOrientation,
} from '@/lib/tree-layout';

export interface ExportTreeSettings {
    showBirthDeath: boolean;
    showSpouse: boolean;
    showAvatar: boolean;
    cardOrientation?: CardOrientation;
}

/** Static person card for export — no interactivity */
function ExportPersonCard({ item, settings, cardW, cardH }: { item: PositionedNode; settings: ExportTreeSettings; cardW: number; cardH: number }) {
    const { node, x, y } = item;
    const isMale = node.gender === 1;
    const isFemale = node.gender === 2;
    const isDead = !node.isLiving;
    const isPatri = node.isPatrilineal;
    const isVertical = settings.cardOrientation === 'vertical';

    // Skip non-patrilineal spouses if showSpouse is off
    if (!settings.showSpouse && !isPatri) return null;

    const nameParts = node.displayName.split(' ');
    const initials = nameParts.length >= 2
        ? (nameParts[0][0] + nameParts[nameParts.length - 1][0]).toUpperCase()
        : node.displayName.slice(0, 2).toUpperCase();

    const avatarBg = !isPatri
        ? 'bg-stone-300 text-stone-600'
        : isMale
            ? (isDead ? 'bg-indigo-300 text-indigo-800' : 'bg-indigo-400 text-white')
            : isFemale
                ? (isDead ? 'bg-rose-300 text-rose-800' : 'bg-rose-400 text-white')
                : 'bg-slate-300 text-slate-600';

    const bgClass = !isPatri
        ? 'from-stone-50 to-stone-100 border-stone-300/80 border-dashed'
        : isDead
            ? (isMale
                ? 'from-indigo-50/60 to-slate-50 border-indigo-300/60'
                : 'from-rose-50/60 to-slate-50 border-rose-300/60')
            : isMale
                ? 'from-indigo-50 to-violet-50 border-indigo-300'
                : isFemale
                    ? 'from-rose-50 to-pink-50 border-rose-300'
                    : 'from-slate-50 to-slate-100 border-slate-300';

    // Vertical card layout (no avatar)
    if (isVertical) {
        return (
            <div
                className={`absolute rounded-xl border-[1.5px] bg-gradient-to-br shadow-sm ${bgClass}
                    ${isDead ? 'opacity-70' : ''} ${!isPatri ? 'opacity-80' : ''}`}
                style={{ left: x, top: y, width: cardW, height: cardH }}
            >
                <div className="px-1 py-1.5 h-full flex flex-col items-center justify-center text-center gap-0.5">
                    <p className="font-semibold text-[10px] leading-tight text-slate-800 line-clamp-3 w-full">
                        {node.displayName}
                    </p>
                    {settings.showBirthDeath && node.birthYear && (
                        <p className="text-[8px] text-slate-500 leading-none">
                            {node.birthYear}{node.deathYear ? `–${node.deathYear}` : node.isLiving ? '–nay' : ''}
                        </p>
                    )}
                    <span className="text-[7px] font-semibold px-1 py-px rounded bg-amber-100 text-amber-700 leading-none">Đời {node.generation}</span>
                    {isDead && <span className="text-[7px] text-slate-400 leading-none">✝ Đã mất</span>}
                </div>
            </div>
        );
    }

    // Horizontal card layout
    return (
        <div
            className={`absolute rounded-xl border-[1.5px] bg-gradient-to-br shadow-sm ${bgClass}
                ${isDead ? 'opacity-70' : ''} ${!isPatri ? 'opacity-80' : ''}`}
            style={{ left: x, top: y, width: cardW, height: cardH }}
        >
            <div className="px-2.5 py-2 h-full flex items-center gap-2.5">
                {/* Avatar */}
                {settings.showAvatar && (
                    <div className="relative flex-shrink-0">
                        <div className={`w-11 h-11 rounded-full flex items-center justify-center
                            font-bold text-sm shadow-sm ring-1 ring-black/5 ${avatarBg} ${isDead ? 'opacity-60' : ''}`}>
                            {initials}
                        </div>
                    </div>
                )}

                {/* Info */}
                <div className="flex-1 min-w-0">
                    <p className="font-semibold text-[11px] leading-tight text-slate-800 line-clamp-2">
                        {node.displayName}
                    </p>
                    {settings.showBirthDeath && (
                        <p className="text-[10px] text-slate-500 mt-0.5">
                            {node.birthYear
                                ? `${node.birthYear}${node.deathYear ? ` — ${node.deathYear}` : node.isLiving ? ' — nay' : ''}`
                                : '—'}
                        </p>
                    )}
                    <div className="mt-0.5 flex items-center gap-1">
                        <span className="text-[9px] font-semibold px-1 py-0.5 rounded bg-amber-100 text-amber-700 border border-amber-200/60">Đời {node.generation}</span>
                        {isDead && <span className="text-[9px] text-slate-400">✝ Đã mất</span>}
                    </div>
                </div>
            </div>
        </div>
    );
}

/** Render the complete tree (nodes + SVG connections) for export — no viewport culling */
export function ExportTreeContent({ layout, settings }: { layout: LayoutResult; settings: ExportTreeSettings }) {
    const cardW = layout.cardW;
    const cardH = layout.cardH;

    // Build SVG paths
    const { parentPaths, couplePaths, visibleCouples } = useMemo(() => {
        let pp = '';
        let cp = '';
        const vc: PositionedCouple[] = [];

        for (const c of layout.connections) {
            if (c.type === 'couple') {
                if (settings.showSpouse) cp += `M${c.fromX},${c.fromY}L${c.toX},${c.toY}`;
            } else {
                pp += `M${c.fromX},${c.fromY}L${c.toX},${c.toY}`;
            }
        }
        if (settings.showSpouse) {
            for (const c of layout.couples) vc.push(c);
        }
        return { parentPaths: pp, couplePaths: cp, visibleCouples: vc };
    }, [layout, settings.showSpouse]);

    return (
        <div style={{ position: 'relative', width: layout.width, height: layout.height }}>
            {/* SVG connections */}
            <svg className="absolute inset-0 pointer-events-none" width={layout.width} height={layout.height}
                style={{ overflow: 'visible' }}>
                {parentPaths && <path d={parentPaths} stroke="#94a3b8" strokeWidth={1.5} fill="none" />}
                {couplePaths && <path d={couplePaths} stroke="#cbd5e1" strokeWidth={1.5} fill="none" strokeDasharray="4,3" />}
                {/* Couple hearts */}
                {visibleCouples.map(c => (
                    <text key={c.familyId} x={c.midX} y={c.y + cardH / 2} textAnchor="middle" dominantBaseline="central"
                        fill="#f472b6" fontSize={10} opacity={0.6}>♥</text>
                ))}
            </svg>

            {/* Person cards */}
            {layout.nodes.map(item => (
                <ExportPersonCard key={item.node.id} item={item} settings={settings} cardW={cardW} cardH={cardH} />
            ))}
        </div>
    );
}
