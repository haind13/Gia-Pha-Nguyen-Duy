'use client';

import { type ReactNode } from 'react';
import { TreePine } from 'lucide-react';

export interface ModernTemplateProps {
    title: string;
    subtitle: string;
    treeWidth: number;
    treeHeight: number;
    children: ReactNode;
}

/** Modern clean template — gradient header, minimal decoration */
export function ModernTemplate({ title, subtitle, treeWidth, treeHeight, children }: ModernTemplateProps) {
    return (
        <div
            className="relative"
            style={{
                background: 'linear-gradient(180deg, #fffbf0 0%, #ffffff 20%, #ffffff 80%, #fffbf0 100%)',
                minWidth: treeWidth + 80,
                minHeight: treeHeight + 250,
            }}
        >
            {/* Header */}
            <div className="pt-10 pb-8 px-8 text-center">
                {/* Tree icon */}
                <div className="inline-flex items-center justify-center w-14 h-14 rounded-2xl bg-gradient-to-br from-amber-100 to-amber-200 shadow-sm mb-4">
                    <TreePine className="w-7 h-7 text-amber-700" />
                </div>

                {/* Title */}
                <h1
                    className="font-bold bg-gradient-to-r from-amber-900 via-amber-700 to-amber-800 bg-clip-text text-transparent"
                    style={{ fontSize: '2.2rem', fontFamily: '"Noto Serif", "Times New Roman", serif' }}
                >
                    {title}
                </h1>
                {subtitle && (
                    <p className="text-amber-700/70 mt-2" style={{ fontSize: '0.95rem' }}>
                        {subtitle}
                    </p>
                )}

                {/* Decorative line */}
                <div className="flex items-center justify-center gap-3 mt-4">
                    <div className="h-px w-20 bg-gradient-to-r from-transparent to-amber-300" />
                    <div className="w-2 h-2 rounded-full bg-amber-400" />
                    <div className="h-px w-20 bg-gradient-to-l from-transparent to-amber-300" />
                </div>
            </div>

            {/* Tree content */}
            <div className="px-10 pb-10 mx-auto" style={{ width: treeWidth }}>
                {children}
            </div>

            {/* Footer */}
            <div className="text-center pb-6 text-amber-600/50 text-xs">
                Gia phả điện tử — {new Date().getFullYear()}
            </div>
        </div>
    );
}
