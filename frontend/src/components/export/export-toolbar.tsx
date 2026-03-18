'use client';

import { useState } from 'react';
import { ArrowLeft, Download, Palette, Type, ScrollText, Eye, EyeOff, UserMinus, UserPlus, ImageOff, Image, RotateCcw, Loader2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';

export type TemplateType = 'traditional' | 'modern';
export type CoupletFontType = 'thuphap' | 'serif';

export const COUPLET_FONTS: Record<CoupletFontType, { label: string; family: string }> = {
    thuphap: { label: 'Thư pháp', family: '"UTM ThuPhap ThienAn", cursive' },
    serif: { label: 'Unicode (Noto Serif)', family: '"Noto Serif", "Times New Roman", serif' },
};

export interface ExportSettings {
    template: TemplateType;
    title: string;
    subtitle: string;
    coupletLeft: string;
    coupletRight: string;
    coupletFontSize: number;
    coupletFont: CoupletFontType;
    headerScale: number;
    showBirthDeath: boolean;
    showSpouse: boolean;
    showAvatar: boolean;
}

const DEFAULT_SETTINGS: ExportSettings = {
    template: 'traditional',
    title: 'Gia phả họ Nguyễn Duy',
    subtitle: 'Nhánh cụ Khoan Giản — Làng Nghìn, An Bài, Quỳnh Phụ, Thái Bình',
    coupletLeft: 'Tổ Tiên Công Đức Thiên Niên Thịnh',
    coupletRight: 'Tử Hiếu Tôn Hiền Vạn Đại Vinh',
    coupletFontSize: 24,
    coupletFont: 'thuphap',
    headerScale: 100,
    showBirthDeath: true,
    showSpouse: true,
    showAvatar: true,
};

export function getDefaultSettings(): ExportSettings {
    return { ...DEFAULT_SETTINGS };
}

interface ExportToolbarProps {
    settings: ExportSettings;
    onSettingsChange: (s: ExportSettings) => void;
    onExport: () => void;
    onBack: () => void;
    exporting: boolean;
}

export function ExportToolbar({ settings, onSettingsChange, onExport, onBack, exporting }: ExportToolbarProps) {
    const [showTemplates, setShowTemplates] = useState(false);
    const [showTitle, setShowTitle] = useState(false);
    const [showCouplet, setShowCouplet] = useState(false);

    const update = (partial: Partial<ExportSettings>) => {
        onSettingsChange({ ...settings, ...partial });
    };

    return (
        <>
            <div className="sticky top-0 z-50 bg-white/95 backdrop-blur-sm border-b shadow-sm">
                <div className="flex items-center gap-1.5 px-3 py-2 overflow-x-auto">
                    {/* Back */}
                    <Button variant="outline" size="sm" onClick={onBack} className="gap-1.5 flex-shrink-0">
                        <ArrowLeft className="h-4 w-4" />
                        <span className="hidden sm:inline">Quay lại</span>
                    </Button>

                    {/* Download */}
                    <Button size="sm" onClick={onExport} disabled={exporting}
                        className="gap-1.5 bg-emerald-600 hover:bg-emerald-700 text-white flex-shrink-0">
                        {exporting ? <Loader2 className="h-4 w-4 animate-spin" /> : <Download className="h-4 w-4" />}
                        Tải ảnh xuống
                    </Button>

                    <div className="w-px h-6 bg-border mx-1 flex-shrink-0" />

                    {/* Template picker */}
                    <Button variant="outline" size="sm" onClick={() => setShowTemplates(true)} className="gap-1.5 flex-shrink-0">
                        <Palette className="h-4 w-4" />
                        <span className="hidden sm:inline">Chọn mẫu</span>
                    </Button>

                    {/* Title editor */}
                    <Button variant="outline" size="sm" onClick={() => setShowTitle(true)} className="gap-1.5 flex-shrink-0">
                        <Type className="h-4 w-4" />
                        <span className="hidden sm:inline">Tiêu đề</span>
                    </Button>

                    {/* Couplet editor (only for traditional) */}
                    {settings.template === 'traditional' && (
                        <Button variant="outline" size="sm" onClick={() => setShowCouplet(true)} className="gap-1.5 flex-shrink-0">
                            <ScrollText className="h-4 w-4" />
                            <span className="hidden sm:inline">Câu đối</span>
                        </Button>
                    )}

                    <div className="w-px h-6 bg-border mx-1 flex-shrink-0" />

                    {/* Toggle: Birth/Death */}
                    <Button
                        variant={settings.showBirthDeath ? 'outline' : 'secondary'}
                        size="sm"
                        onClick={() => update({ showBirthDeath: !settings.showBirthDeath })}
                        className="gap-1.5 flex-shrink-0"
                        title={settings.showBirthDeath ? 'Ẩn ngày sinh/mất' : 'Hiện ngày sinh/mất'}
                    >
                        {settings.showBirthDeath ? <Eye className="h-4 w-4" /> : <EyeOff className="h-4 w-4" />}
                        <span className="hidden md:inline">Sinh/mất</span>
                    </Button>

                    {/* Toggle: Spouse */}
                    <Button
                        variant={settings.showSpouse ? 'outline' : 'secondary'}
                        size="sm"
                        onClick={() => update({ showSpouse: !settings.showSpouse })}
                        className="gap-1.5 flex-shrink-0"
                        title={settings.showSpouse ? 'Ẩn phụ thê' : 'Hiện phụ thê'}
                    >
                        {settings.showSpouse ? <UserMinus className="h-4 w-4" /> : <UserPlus className="h-4 w-4" />}
                        <span className="hidden md:inline">Phụ thê</span>
                    </Button>

                    {/* Toggle: Avatar */}
                    <Button
                        variant={settings.showAvatar ? 'outline' : 'secondary'}
                        size="sm"
                        onClick={() => update({ showAvatar: !settings.showAvatar })}
                        className="gap-1.5 flex-shrink-0"
                        title={settings.showAvatar ? 'Ẩn ảnh đại diện' : 'Hiện ảnh đại diện'}
                    >
                        {settings.showAvatar ? <ImageOff className="h-4 w-4" /> : <Image className="h-4 w-4" />}
                        <span className="hidden md:inline">Ảnh</span>
                    </Button>

                    <div className="w-px h-6 bg-border mx-1 flex-shrink-0" />

                    {/* Reset */}
                    <Button variant="ghost" size="sm" onClick={() => onSettingsChange(getDefaultSettings())}
                        className="gap-1.5 flex-shrink-0" title="Reset về mặc định">
                        <RotateCcw className="h-4 w-4" />
                        <span className="hidden lg:inline">Reset</span>
                    </Button>
                </div>
            </div>

            {/* Template Picker Dialog */}
            <Dialog open={showTemplates} onOpenChange={setShowTemplates}>
                <DialogContent className="sm:max-w-lg">
                    <DialogHeader>
                        <DialogTitle>Chọn mẫu phả đồ</DialogTitle>
                    </DialogHeader>
                    <div className="grid grid-cols-2 gap-4 pt-2">
                        <TemplateCard
                            name="Truyền thống"
                            description="Cuốn thư, rồng vàng, câu đối, nền giấy cổ"
                            selected={settings.template === 'traditional'}
                            onClick={() => { update({ template: 'traditional' }); setShowTemplates(false); }}
                            preview={
                                <div className="h-24 bg-gradient-to-b from-amber-100 to-amber-50 rounded flex flex-col items-center justify-center">
                                    <div className="w-16 h-6 bg-red-700 rounded-sm mb-1 flex items-center justify-center">
                                        <span className="text-yellow-300 text-[6px] font-bold">GIA PHẢ</span>
                                    </div>
                                    <div className="flex gap-1">
                                        <div className="w-3 h-3 rounded-sm bg-amber-200 border border-amber-300" />
                                        <div className="w-3 h-3 rounded-sm bg-amber-200 border border-amber-300" />
                                    </div>
                                    <div className="w-0.5 h-2 bg-slate-300 mt-0.5" />
                                    <div className="w-3 h-3 rounded-sm bg-amber-200 border border-amber-300" />
                                </div>
                            }
                        />
                        <TemplateCard
                            name="Hiện đại"
                            description="Tối giản, thanh lịch, nền trắng"
                            selected={settings.template === 'modern'}
                            onClick={() => { update({ template: 'modern' }); setShowTemplates(false); }}
                            preview={
                                <div className="h-24 bg-white rounded flex flex-col items-center justify-center">
                                    <div className="w-4 h-4 rounded-lg bg-amber-100 mb-1 flex items-center justify-center">
                                        <span className="text-amber-700 text-[6px]">🌳</span>
                                    </div>
                                    <div className="w-12 h-1 bg-amber-200 rounded mb-2" />
                                    <div className="flex gap-1">
                                        <div className="w-3 h-3 rounded-md bg-indigo-100 border border-indigo-200" />
                                        <div className="w-3 h-3 rounded-md bg-rose-100 border border-rose-200" />
                                    </div>
                                    <div className="w-0.5 h-2 bg-slate-200 mt-0.5" />
                                    <div className="w-3 h-3 rounded-md bg-indigo-100 border border-indigo-200" />
                                </div>
                            }
                        />
                    </div>
                </DialogContent>
            </Dialog>

            {/* Title Editor Dialog */}
            <Dialog open={showTitle} onOpenChange={setShowTitle}>
                <DialogContent className="sm:max-w-md">
                    <DialogHeader>
                        <DialogTitle>Tùy chỉnh tiêu đề</DialogTitle>
                    </DialogHeader>
                    <div className="space-y-4 pt-2">
                        <div>
                            <label className="text-sm font-medium mb-1 block">Tiêu đề chính</label>
                            <Input value={settings.title} onChange={e => update({ title: e.target.value })} />
                        </div>
                        <div>
                            <label className="text-sm font-medium mb-1 block">Phụ đề</label>
                            <Input value={settings.subtitle} onChange={e => update({ subtitle: e.target.value })} />
                        </div>
                        {settings.template === 'traditional' && (
                            <div>
                                <label className="text-sm font-medium mb-1 block">Kích thước cuốn thư: {settings.headerScale}%</label>
                                <input type="range" min={50} max={150} step={5} value={settings.headerScale}
                                    onChange={e => update({ headerScale: Number(e.target.value) })}
                                    className="w-full accent-amber-600" />
                            </div>
                        )}
                        <Button className="w-full" onClick={() => setShowTitle(false)}>Lưu thay đổi</Button>
                    </div>
                </DialogContent>
            </Dialog>

            {/* Couplet Editor Dialog */}
            <Dialog open={showCouplet} onOpenChange={setShowCouplet}>
                <DialogContent className="sm:max-w-md">
                    <DialogHeader>
                        <DialogTitle>Đổi câu đối</DialogTitle>
                    </DialogHeader>
                    <div className="space-y-4 pt-2">
                        <div>
                            <label className="text-sm font-medium mb-1 block">Câu đối trái</label>
                            <Input value={settings.coupletLeft} onChange={e => update({ coupletLeft: e.target.value })} />
                        </div>
                        <div>
                            <label className="text-sm font-medium mb-1 block">Câu đối phải</label>
                            <Input value={settings.coupletRight} onChange={e => update({ coupletRight: e.target.value })} />
                        </div>

                        {/* Font picker */}
                        <div>
                            <label className="text-sm font-medium mb-2 block">Kiểu chữ</label>
                            <div className="grid grid-cols-2 gap-2">
                                {(Object.entries(COUPLET_FONTS) as [CoupletFontType, { label: string; family: string }][]).map(([key, font]) => (
                                    <button
                                        key={key}
                                        onClick={() => update({ coupletFont: key })}
                                        className={`text-left rounded-lg border-2 p-3 transition-all ${
                                            settings.coupletFont === key
                                                ? 'border-red-500 bg-red-50/50'
                                                : 'border-border hover:border-red-300'
                                        }`}
                                    >
                                        <span className="text-xs font-medium block mb-1">{font.label}</span>
                                        <span
                                            className="text-red-800 block leading-tight"
                                            style={{ fontFamily: font.family, fontSize: '16px' }}
                                        >
                                            Tổ Tiên Công Đức
                                        </span>
                                        {settings.coupletFont === key && (
                                            <span className="text-xs text-red-600 font-medium mt-1 block">✓ Đang dùng</span>
                                        )}
                                    </button>
                                ))}
                            </div>
                        </div>

                        <div>
                            <label className="text-sm font-medium mb-1 block">Kích thước chữ: {settings.coupletFontSize}px</label>
                            <input type="range" min={14} max={48} step={2} value={settings.coupletFontSize}
                                onChange={e => update({ coupletFontSize: Number(e.target.value) })}
                                className="w-full accent-red-600" />
                        </div>

                        {/* Preview */}
                        <div className="border rounded-lg p-3 bg-amber-50/50">
                            <span className="text-[10px] text-muted-foreground block mb-1">Xem trước</span>
                            <p
                                className="text-red-800 text-center"
                                style={{
                                    fontFamily: COUPLET_FONTS[settings.coupletFont].family,
                                    fontSize: `${settings.coupletFontSize}px`,
                                }}
                            >
                                {settings.coupletLeft}
                            </p>
                        </div>

                        <Button className="w-full" onClick={() => setShowCouplet(false)}>Lưu thay đổi</Button>
                    </div>
                </DialogContent>
            </Dialog>
        </>
    );
}

function TemplateCard({ name, description, selected, onClick, preview }: {
    name: string; description: string; selected: boolean; onClick: () => void; preview: React.ReactNode;
}) {
    return (
        <button
            onClick={onClick}
            className={`text-left rounded-xl border-2 p-3 transition-all hover:shadow-md ${selected
                ? 'border-amber-500 bg-amber-50/50 shadow-md'
                : 'border-border hover:border-amber-300'
                }`}
        >
            <div className="rounded-lg overflow-hidden border mb-2">{preview}</div>
            <p className="font-semibold text-sm">{name}</p>
            <p className="text-xs text-muted-foreground">{description}</p>
            {selected && <span className="text-xs text-amber-600 font-medium mt-1 block">✓ Đang sử dụng</span>}
        </button>
    );
}
