'use client';

import { Suspense, useEffect, useRef, useState, useCallback } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { toPng } from 'html-to-image';
import { fetchTreeData } from '@/lib/supabase-data';
import { computeLayout, type TreeNode, type TreeFamily, type LayoutResult } from '@/lib/tree-layout';
import { getMockTreeData } from '@/lib/mock-data';
import { ExportTreeContent, type ExportTreeSettings } from '@/components/export/export-tree-nodes';
import { ExportToolbar, getDefaultSettings, type ExportSettings } from '@/components/export/export-toolbar';
import { TraditionalTemplate } from '@/components/export/export-template-traditional';
import { ModernTemplate } from '@/components/export/export-template-modern';

export default function ExportPageWrapper() {
    return (
        <Suspense fallback={
            <div className="flex items-center justify-center h-screen">
                <div className="animate-spin rounded-full h-10 w-10 border-b-2 border-amber-500" />
            </div>
        }>
            <ExportPage />
        </Suspense>
    );
}

function ExportPage() {
    const router = useRouter();
    const searchParams = useSearchParams();
    const slug = searchParams.get('slug') || 'pha-do-chung';

    const [loading, setLoading] = useState(true);
    const [treeData, setTreeData] = useState<{ people: TreeNode[]; families: TreeFamily[] } | null>(null);
    const [layout, setLayout] = useState<LayoutResult | null>(null);
    const [settings, setSettings] = useState<ExportSettings>(getDefaultSettings);
    const [exporting, setExporting] = useState(false);

    const exportRef = useRef<HTMLDivElement>(null);

    // Fetch tree data
    useEffect(() => {
        const fetchTree = async () => {
            setLoading(true);
            try {
                // Try API first
                const apiUrl = process.env.NEXT_PUBLIC_API_URL;
                if (apiUrl) {
                    const token = typeof window !== 'undefined'
                        ? (await (await import('@/lib/supabase')).supabase.auth.getSession()).data.session?.access_token
                        : null;
                    const res = await fetch(`${apiUrl}/genealogy/tree`, {
                        headers: token ? { Authorization: `Bearer ${token}` } : {},
                    });
                    if (res.ok) {
                        const data = await res.json();
                        setTreeData(data);
                        setLoading(false);
                        return;
                    }
                }
                // Fallback: Supabase direct
                const data = await fetchTreeData();
                if (data.people.length > 0) {
                    setTreeData(data);
                    setLoading(false);
                    return;
                }
            } catch { /* fallback to mock */ }
            setTreeData(getMockTreeData());
            setLoading(false);
        };
        fetchTree();
    }, []);

    // Compute layout when data changes
    useEffect(() => {
        if (!treeData) return;
        const result = computeLayout(treeData.people, treeData.families);
        setLayout(result);
    }, [treeData]);

    // Export handler
    const handleExport = useCallback(async () => {
        if (!exportRef.current || !layout) return;
        setExporting(true);
        // Wait for re-render
        await new Promise(r => setTimeout(r, 600));
        try {
            const dataUrl = await toPng(exportRef.current, {
                backgroundColor: settings.template === 'traditional' ? '#f5edde' : '#fffbf0',
                style: { transform: 'none', transformOrigin: '0 0' },
                pixelRatio: 1,
            });
            const link = document.createElement('a');
            link.download = `pha-do-nguyen-duy-${new Date().toISOString().slice(0, 10)}.png`;
            link.href = dataUrl;
            link.click();
        } catch (err) {
            console.error('Export failed:', err);
            alert('Xuất ảnh thất bại. Vui lòng thử lại.');
        } finally {
            setExporting(false);
        }
    }, [layout, settings.template]);

    const handleBack = () => {
        router.push(`/pha-do/${slug}`);
    };

    const treeSettings: ExportTreeSettings = {
        showBirthDeath: settings.showBirthDeath,
        showSpouse: settings.showSpouse,
        showAvatar: settings.showAvatar,
    };

    return (
        <div className="min-h-screen bg-muted/30 flex flex-col">
            {/* Toolbar */}
            <ExportToolbar
                settings={settings}
                onSettingsChange={setSettings}
                onExport={handleExport}
                onBack={handleBack}
                exporting={exporting}
            />

            {/* Preview Area */}
            <div className="flex-1 overflow-auto p-4">
                {loading ? (
                    <div className="flex items-center justify-center h-96">
                        <div className="flex flex-col items-center gap-3">
                            <div className="animate-spin rounded-full h-10 w-10 border-b-2 border-amber-500" />
                            <span className="text-sm text-muted-foreground">Đang tải phả đồ...</span>
                        </div>
                    </div>
                ) : layout ? (
                    <div className="overflow-auto mx-auto">
                        {/* Export overlay */}
                        {exporting && (
                            <div className="fixed inset-0 z-50 flex items-center justify-center bg-background/80 backdrop-blur-sm">
                                <div className="flex flex-col items-center gap-3">
                                    <div className="animate-spin rounded-full h-10 w-10 border-b-2 border-amber-500" />
                                    <span className="text-sm font-medium text-amber-700">Đang xuất ảnh Phả đồ...</span>
                                </div>
                            </div>
                        )}

                        {/* Template wrapper — this is what gets exported */}
                        <div ref={exportRef} className="inline-block">
                            {settings.template === 'traditional' ? (
                                <TraditionalTemplate
                                    title={settings.title}
                                    subtitle={settings.subtitle}
                                    coupletLeft={settings.coupletLeft}
                                    coupletRight={settings.coupletRight}
                                    coupletFontSize={settings.coupletFontSize}
                                    headerScale={settings.headerScale}
                                    treeWidth={layout.width}
                                    treeHeight={layout.height}
                                >
                                    <ExportTreeContent layout={layout} settings={treeSettings} />
                                </TraditionalTemplate>
                            ) : (
                                <ModernTemplate
                                    title={settings.title}
                                    subtitle={settings.subtitle}
                                    treeWidth={layout.width}
                                    treeHeight={layout.height}
                                >
                                    <ExportTreeContent layout={layout} settings={treeSettings} />
                                </ModernTemplate>
                            )}
                        </div>
                    </div>
                ) : (
                    <div className="flex items-center justify-center h-96">
                        <p className="text-muted-foreground">Không có dữ liệu phả đồ</p>
                    </div>
                )}
            </div>
        </div>
    );
}
