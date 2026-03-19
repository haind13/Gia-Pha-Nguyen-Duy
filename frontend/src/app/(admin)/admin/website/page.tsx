'use client';

import { useState, useEffect } from 'react';
import {
    Globe, Image, Type, MapPin, Share2, Save, ExternalLink, Loader2,
    CheckCircle2,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { supabase } from '@/lib/supabase';
import { useTenant } from '@/components/tenant-provider';
import type { SiteConfig } from '@/lib/tenant';

export default function AdminWebsitePage() {
    const { tenant, siteConfig, refetchConfig } = useTenant();
    const [config, setConfig] = useState<Partial<SiteConfig>>({});
    const [saving, setSaving] = useState(false);
    const [saved, setSaved] = useState(false);
    const [loading, setLoading] = useState(true);

    // Initialize form from siteConfig
    useEffect(() => {
        if (siteConfig) {
            setConfig(siteConfig);
            setLoading(false);
        } else if (tenant) {
            // Default from tenant
            setConfig({
                site_name: tenant.name,
                description: tenant.description || '',
                introduction: '',
                google_map_url: '',
                facebook_url: '',
                youtube_url: '',
                zalo_url: '',
                theme_color: '#d97706',
            });
            setLoading(false);
        }
    }, [siteConfig, tenant]);

    const handleChange = (key: keyof SiteConfig, value: string) => {
        setConfig(prev => ({ ...prev, [key]: value }));
        setSaved(false);
    };

    const handleSave = async () => {
        if (!tenant) return;
        setSaving(true);
        try {
            if (siteConfig?.id) {
                // Update existing
                const { error } = await supabase
                    .from('site_config')
                    .update({
                        site_name: config.site_name || null,
                        description: config.description || null,
                        introduction: config.introduction || null,
                        google_map_url: config.google_map_url || null,
                        facebook_url: config.facebook_url || null,
                        youtube_url: config.youtube_url || null,
                        zalo_url: config.zalo_url || null,
                        theme_color: config.theme_color || '#d97706',
                        logo_url: config.logo_url || null,
                        favicon_url: config.favicon_url || null,
                        banner_url: config.banner_url || null,
                    })
                    .eq('id', siteConfig.id);
                if (error) throw error;
            } else {
                // Insert new
                const { error } = await supabase
                    .from('site_config')
                    .insert({
                        tenant_id: tenant.id,
                        site_name: config.site_name || null,
                        description: config.description || null,
                        introduction: config.introduction || null,
                        google_map_url: config.google_map_url || null,
                        facebook_url: config.facebook_url || null,
                        youtube_url: config.youtube_url || null,
                        zalo_url: config.zalo_url || null,
                        theme_color: config.theme_color || '#d97706',
                    });
                if (error) throw error;
            }
            await refetchConfig();
            setSaved(true);
            setTimeout(() => setSaved(false), 3000);
        } catch (err) {
            console.error('Save error:', err);
            alert('Lỗi khi lưu cấu hình. Vui lòng thử lại.');
        }
        setSaving(false);
    };

    // Build website URL
    const websiteUrl = tenant?.custom_domain
        ? `https://${tenant.custom_domain}`
        : tenant?.slug
            ? `https://${tenant.slug}.giaphadaiviet.vn`
            : '#';

    if (loading) {
        return (
            <div className="flex items-center justify-center py-16">
                <Loader2 className="h-7 w-7 animate-spin text-amber-500" />
            </div>
        );
    }

    return (
        <div className="max-w-4xl mx-auto space-y-6">
            {/* Header */}
            <div className="flex items-center justify-between">
                <div>
                    <h1 className="text-2xl font-bold text-slate-800">Cấu hình Website</h1>
                    <p className="text-sm text-slate-500 mt-1">Tùy chỉnh thông tin hiển thị trên website gia phả</p>
                </div>
                <a href={websiteUrl} target="_blank" rel="noopener noreferrer"
                    className="flex items-center gap-1.5 text-xs text-blue-600 hover:text-blue-800 bg-blue-50 px-3 py-1.5 rounded-full">
                    <Globe className="h-3.5 w-3.5" />
                    Xem website
                    <ExternalLink className="h-3 w-3" />
                </a>
            </div>

            {/* Thông tin cơ bản */}
            <Section title="Thông tin cơ bản" icon={<Type className="h-4 w-4" />}>
                <FieldGroup label="Tên gia phả *" description="Hiển thị ở header website">
                    <input type="text" value={config.site_name || ''}
                        onChange={e => handleChange('site_name', e.target.value)}
                        className="w-full px-3 py-2 border rounded-lg text-sm focus:ring-2 focus:ring-amber-500 focus:border-amber-500 outline-none" />
                </FieldGroup>
                <FieldGroup label="Mô tả ngắn" description="Hiển thị dưới tên gia phả">
                    <input type="text" value={config.description || ''}
                        onChange={e => handleChange('description', e.target.value)}
                        className="w-full px-3 py-2 border rounded-lg text-sm focus:ring-2 focus:ring-amber-500 focus:border-amber-500 outline-none" />
                </FieldGroup>
                <FieldGroup label="Lời nói đầu" description="Nội dung giới thiệu dòng họ">
                    <textarea rows={4} value={config.introduction || ''}
                        onChange={e => handleChange('introduction', e.target.value)}
                        placeholder="Viết lời giới thiệu về dòng họ..."
                        className="w-full px-3 py-2 border rounded-lg text-sm focus:ring-2 focus:ring-amber-500 focus:border-amber-500 outline-none resize-none" />
                </FieldGroup>
            </Section>

            {/* Hình ảnh */}
            <Section title="Hình ảnh" icon={<Image className="h-4 w-4" />}>
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                    <ImageUpload label="Logo" description="Kích thước đề xuất: 200x200px" currentUrl={config.logo_url} />
                    <ImageUpload label="Favicon" description="Kích thước: 32x32px" currentUrl={config.favicon_url} />
                    <ImageUpload label="Ảnh bìa" description="Hiển thị ở trang chủ" currentUrl={config.banner_url} />
                </div>
            </Section>

            {/* Bản đồ */}
            <Section title="Vị trí trên bản đồ" icon={<MapPin className="h-4 w-4" />}>
                <FieldGroup label="Google Map Embed URL" description="Dán đường dẫn iframe Google Map tại đây">
                    <input type="text" value={config.google_map_url || ''}
                        onChange={e => handleChange('google_map_url', e.target.value)}
                        placeholder="https://www.google.com/maps/embed?pb=..."
                        className="w-full px-3 py-2 border rounded-lg text-sm focus:ring-2 focus:ring-amber-500 focus:border-amber-500 outline-none" />
                </FieldGroup>
                {config.google_map_url && (
                    <div className="border rounded-lg overflow-hidden h-48 bg-slate-100">
                        <iframe src={config.google_map_url} className="w-full h-full" allowFullScreen loading="lazy" />
                    </div>
                )}
            </Section>

            {/* Mạng xã hội */}
            <Section title="Mạng xã hội" icon={<Share2 className="h-4 w-4" />}>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                    <FieldGroup label="Facebook">
                        <input type="text" value={config.facebook_url || ''}
                            onChange={e => handleChange('facebook_url', e.target.value)}
                            placeholder="https://facebook.com/..."
                            className="w-full px-3 py-2 border rounded-lg text-sm focus:ring-2 focus:ring-amber-500 focus:border-amber-500 outline-none" />
                    </FieldGroup>
                    <FieldGroup label="YouTube">
                        <input type="text" value={config.youtube_url || ''}
                            onChange={e => handleChange('youtube_url', e.target.value)}
                            placeholder="https://youtube.com/..."
                            className="w-full px-3 py-2 border rounded-lg text-sm focus:ring-2 focus:ring-amber-500 focus:border-amber-500 outline-none" />
                    </FieldGroup>
                    <FieldGroup label="Zalo">
                        <input type="text" value={config.zalo_url || ''}
                            onChange={e => handleChange('zalo_url', e.target.value)}
                            placeholder="https://zalo.me/..."
                            className="w-full px-3 py-2 border rounded-lg text-sm focus:ring-2 focus:ring-amber-500 focus:border-amber-500 outline-none" />
                    </FieldGroup>
                </div>
            </Section>

            {/* Save */}
            <div className="flex items-center justify-end gap-3 pt-2 pb-8">
                {saved && (
                    <span className="flex items-center gap-1.5 text-xs text-emerald-600 font-medium">
                        <CheckCircle2 className="h-3.5 w-3.5" />
                        Đã lưu thành công!
                    </span>
                )}
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

function ImageUpload({ label, description, currentUrl }: { label: string; description: string; currentUrl?: string | null }) {
    return (
        <div className="border-2 border-dashed rounded-lg p-4 text-center hover:border-amber-400 transition-colors cursor-pointer">
            {currentUrl ? (
                <div className="w-12 h-12 mx-auto rounded-lg overflow-hidden mb-2">
                    <img src={currentUrl} alt={label} className="w-full h-full object-cover" />
                </div>
            ) : (
                <div className="w-12 h-12 mx-auto rounded-lg bg-slate-100 flex items-center justify-center mb-2">
                    <Image className="h-5 w-5 text-slate-400" />
                </div>
            )}
            <p className="text-xs font-medium text-slate-700">{label}</p>
            <p className="text-[10px] text-slate-400 mt-0.5">{description}</p>
            <p className="text-[10px] text-amber-600 mt-1.5">Nhấn để tải lên</p>
        </div>
    );
}
