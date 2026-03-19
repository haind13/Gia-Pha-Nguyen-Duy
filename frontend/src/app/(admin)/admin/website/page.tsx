'use client';

import { useState } from 'react';
import {
    Globe, Image, Type, MapPin, Share2, Save, ExternalLink, Loader2,
} from 'lucide-react';
import { Button } from '@/components/ui/button';

const SITE_DOMAIN = 'donghonguyenduy-langnghin.asia';

interface SiteConfig {
    siteName: string;
    description: string;
    introduction: string;
    googleMapUrl: string;
    facebookUrl: string;
    youtubeUrl: string;
    zaloUrl: string;
}

const DEFAULT_CONFIG: SiteConfig = {
    siteName: 'Gia phả họ Nguyễn Duy (nhánh cụ Khoan Giàn)',
    description: 'Họ Nguyễn Duy - Làng Nghìn, An Bài, Quỳnh Phụ, Thái Bình',
    introduction: '',
    googleMapUrl: '',
    facebookUrl: '',
    youtubeUrl: '',
    zaloUrl: '',
};

export default function AdminWebsitePage() {
    const [config, setConfig] = useState<SiteConfig>(DEFAULT_CONFIG);
    const [saving, setSaving] = useState(false);
    const [saved, setSaved] = useState(false);

    const handleChange = (key: keyof SiteConfig, value: string) => {
        setConfig(prev => ({ ...prev, [key]: value }));
        setSaved(false);
    };

    const handleSave = async () => {
        setSaving(true);
        // TODO: Save to Supabase site_config table
        await new Promise(r => setTimeout(r, 500));
        setSaving(false);
        setSaved(true);
        setTimeout(() => setSaved(false), 2000);
    };

    return (
        <div className="max-w-4xl mx-auto space-y-6">
            {/* Header */}
            <div className="flex items-center justify-between">
                <div>
                    <h1 className="text-2xl font-bold text-slate-800">Cấu hình Website</h1>
                    <p className="text-sm text-slate-500 mt-1">Tùy chỉnh thông tin hiển thị trên website gia phả</p>
                </div>
                <a href={`https://${SITE_DOMAIN}`} target="_blank" rel="noopener noreferrer"
                    className="flex items-center gap-1.5 text-xs text-blue-600 hover:text-blue-800 bg-blue-50 px-3 py-1.5 rounded-full">
                    <Globe className="h-3.5 w-3.5" />
                    Xem website
                    <ExternalLink className="h-3 w-3" />
                </a>
            </div>

            {/* Thông tin cơ bản */}
            <Section title="Thông tin cơ bản" icon={<Type className="h-4 w-4" />}>
                <FieldGroup label="Tên gia phả *" description="Hiển thị ở header website">
                    <input type="text" value={config.siteName}
                        onChange={e => handleChange('siteName', e.target.value)}
                        className="w-full px-3 py-2 border rounded-lg text-sm focus:ring-2 focus:ring-amber-500 focus:border-amber-500 outline-none" />
                </FieldGroup>
                <FieldGroup label="Mô tả ngắn" description="Hiển thị dưới tên gia phả">
                    <input type="text" value={config.description}
                        onChange={e => handleChange('description', e.target.value)}
                        className="w-full px-3 py-2 border rounded-lg text-sm focus:ring-2 focus:ring-amber-500 focus:border-amber-500 outline-none" />
                </FieldGroup>
                <FieldGroup label="Lời nói đầu" description="Nội dung giới thiệu dòng họ">
                    <textarea rows={4} value={config.introduction}
                        onChange={e => handleChange('introduction', e.target.value)}
                        placeholder="Viết lời giới thiệu về dòng họ..."
                        className="w-full px-3 py-2 border rounded-lg text-sm focus:ring-2 focus:ring-amber-500 focus:border-amber-500 outline-none resize-none" />
                </FieldGroup>
            </Section>

            {/* Hình ảnh */}
            <Section title="Hình ảnh" icon={<Image className="h-4 w-4" />}>
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                    <ImageUpload label="Logo" description="Kích thước đề xuất: 200x200px" />
                    <ImageUpload label="Favicon" description="Kích thước: 32x32px" />
                    <ImageUpload label="Ảnh bìa" description="Hiển thị ở trang chủ" />
                </div>
            </Section>

            {/* Bản đồ */}
            <Section title="Vị trí trên bản đồ" icon={<MapPin className="h-4 w-4" />}>
                <FieldGroup label="Google Map Embed URL" description="Dán đường dẫn iframe Google Map tại đây">
                    <input type="text" value={config.googleMapUrl}
                        onChange={e => handleChange('googleMapUrl', e.target.value)}
                        placeholder="https://www.google.com/maps/embed?pb=..."
                        className="w-full px-3 py-2 border rounded-lg text-sm focus:ring-2 focus:ring-amber-500 focus:border-amber-500 outline-none" />
                </FieldGroup>
                {config.googleMapUrl && (
                    <div className="border rounded-lg overflow-hidden h-48 bg-slate-100">
                        <iframe src={config.googleMapUrl} className="w-full h-full" allowFullScreen loading="lazy" />
                    </div>
                )}
            </Section>

            {/* Mạng xã hội */}
            <Section title="Mạng xã hội" icon={<Share2 className="h-4 w-4" />}>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                    <FieldGroup label="Facebook">
                        <input type="text" value={config.facebookUrl}
                            onChange={e => handleChange('facebookUrl', e.target.value)}
                            placeholder="https://facebook.com/..."
                            className="w-full px-3 py-2 border rounded-lg text-sm focus:ring-2 focus:ring-amber-500 focus:border-amber-500 outline-none" />
                    </FieldGroup>
                    <FieldGroup label="YouTube">
                        <input type="text" value={config.youtubeUrl}
                            onChange={e => handleChange('youtubeUrl', e.target.value)}
                            placeholder="https://youtube.com/..."
                            className="w-full px-3 py-2 border rounded-lg text-sm focus:ring-2 focus:ring-amber-500 focus:border-amber-500 outline-none" />
                    </FieldGroup>
                    <FieldGroup label="Zalo">
                        <input type="text" value={config.zaloUrl}
                            onChange={e => handleChange('zaloUrl', e.target.value)}
                            placeholder="https://zalo.me/..."
                            className="w-full px-3 py-2 border rounded-lg text-sm focus:ring-2 focus:ring-amber-500 focus:border-amber-500 outline-none" />
                    </FieldGroup>
                </div>
            </Section>

            {/* Save */}
            <div className="flex items-center justify-end gap-3 pt-2 pb-8">
                {saved && <span className="text-xs text-emerald-600 font-medium">Đã lưu thành công!</span>}
                <Button onClick={handleSave} disabled={saving}
                    className="bg-amber-600 hover:bg-amber-700 text-white gap-2">
                    {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />}
                    Lưu thay đổi
                </Button>
            </div>
        </div>
    );
}

function Section({ title, icon, children }: { title: string; icon: React.ReactNode; children: React.ReactNode }) {
    return (
        <div className="bg-white border rounded-xl p-5 shadow-sm">
            <h2 className="text-sm font-semibold text-slate-700 mb-4 flex items-center gap-2">
                <span className="text-slate-400">{icon}</span>
                {title}
            </h2>
            <div className="space-y-4">{children}</div>
        </div>
    );
}

function FieldGroup({ label, description, children }: { label: string; description?: string; children: React.ReactNode }) {
    return (
        <div>
            <label className="block text-xs font-medium text-slate-600 mb-1">{label}</label>
            {description && <p className="text-[10px] text-slate-400 mb-1.5">{description}</p>}
            {children}
        </div>
    );
}

function ImageUpload({ label, description }: { label: string; description: string }) {
    return (
        <div className="border-2 border-dashed rounded-lg p-4 text-center hover:border-amber-400 transition-colors cursor-pointer">
            <div className="w-12 h-12 mx-auto rounded-lg bg-slate-100 flex items-center justify-center mb-2">
                <Image className="h-5 w-5 text-slate-400" />
            </div>
            <p className="text-xs font-medium text-slate-700">{label}</p>
            <p className="text-[10px] text-slate-400 mt-0.5">{description}</p>
            <p className="text-[10px] text-amber-600 mt-1.5">Nhấn để tải lên</p>
        </div>
    );
}
