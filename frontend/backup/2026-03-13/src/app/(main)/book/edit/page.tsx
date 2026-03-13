'use client';

import { useEffect, useState, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import { useAuth } from '@/components/auth-provider';
import { RequireAuth } from '@/components/require-auth';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import {
    BookOpen, Save, Trash2, Plus, ArrowLeft, Eye, EyeOff,
    GripVertical, ChevronRight, FileText, Pencil, MonitorPlay,
    CheckCircle2, AlertCircle,
} from 'lucide-react';
import { Tabs, TabsList, TabsTrigger, TabsContent } from '@/components/ui/tabs';
import dynamic from 'next/dynamic';

const RichTextEditor = dynamic(() => import('@/components/rich-text-editor').then(m => ({ default: m.RichTextEditor })), {
    ssr: false,
    loading: () => <div className="flex items-center justify-center h-64 text-muted-foreground">Đang tải trình soạn thảo...</div>,
});
import {
    fetchBookSections,
    upsertBookSection,
    updateBookSection,
    deleteBookSection,
} from '@/lib/supabase-data';
import type { BookSection } from '@/lib/genealogy-types';
import Link from 'next/link';

// Default section templates
const DEFAULT_SECTIONS = [
    { key: 'preface', title: 'Lời nói đầu', hint: 'Viết lời giới thiệu về gia phả, mục đích lập gia phả...' },
    { key: 'family_origin', title: 'Nguồn gốc dòng họ', hint: 'Ghi lại lịch sử, nguồn gốc của dòng họ...' },
    { key: 'traditions', title: 'Truyền thống gia đình', hint: 'Gia phong, gia huấn, lễ nghi, phong tục...' },
    { key: 'closing', title: 'Lời kết', hint: 'Lời kết, lời nhắn nhủ cho con cháu đời sau...' },
];

export default function BookEditPage() {
    const { isLoggedIn, isAdmin, loading: authLoading } = useAuth();
    const router = useRouter();
    const [sections, setSections] = useState<BookSection[]>([]);
    const [loading, setLoading] = useState(true);
    const [selectedKey, setSelectedKey] = useState<string | null>(null);
    const [editTitle, setEditTitle] = useState('');
    const [editContent, setEditContent] = useState('');
    const [saving, setSaving] = useState(false);
    const [dirty, setDirty] = useState(false);
    const [showNewForm, setShowNewForm] = useState(false);
    const [newKey, setNewKey] = useState('');
    const [newTitle, setNewTitle] = useState('');
    const [saveStatus, setSaveStatus] = useState<'idle' | 'success' | 'error'>('idle');

    // Fetch sections
    const loadSections = useCallback(async () => {
        const data = await fetchBookSections();
        setSections(data);
        setLoading(false);
    }, []);

    useEffect(() => {
        loadSections();
    }, [loadSections]);

    // Auth guard
    if (!authLoading && (!isLoggedIn || !isAdmin)) {
        return <RequireAuth>{null}</RequireAuth>;
    }

    if (loading || authLoading) {
        return (
            <div className="flex items-center justify-center min-h-screen">
                <div className="animate-pulse text-muted-foreground flex items-center gap-2">
                    <BookOpen className="w-5 h-5" />
                    <span>Đang tải...</span>
                </div>
            </div>
        );
    }

    const selectedSection = sections.find(s => s.sectionKey === selectedKey);

    const handleSelectSection = (key: string) => {
        const section = sections.find(s => s.sectionKey === key);
        setSelectedKey(key);
        setEditTitle(section?.title || '');
        setEditContent(section?.content || '');
        setDirty(false);
        setShowNewForm(false);
        setSaveStatus('idle');
    };

    const handleSave = async () => {
        if (!selectedKey) return;
        setSaving(true);
        setSaveStatus('idle');
        const result = await upsertBookSection(selectedKey, editTitle, editContent, selectedSection?.sortOrder ?? sections.length);
        await loadSections();
        setDirty(false);
        setSaving(false);
        if (result.error) {
            setSaveStatus('error');
        } else {
            setSaveStatus('success');
        }
        // Auto-dismiss after 3 seconds
        setTimeout(() => setSaveStatus('idle'), 3000);
    };

    const handleDelete = async () => {
        if (!selectedKey) return;
        if (!confirm(`Bạn có chắc muốn xóa mục "${editTitle}"?`)) return;
        setSaving(true);
        await deleteBookSection(selectedKey);
        setSelectedKey(null);
        setEditTitle('');
        setEditContent('');
        await loadSections();
        setSaving(false);
        setDirty(false);
    };

    const handleToggleVisibility = async () => {
        if (!selectedKey || !selectedSection) return;
        await updateBookSection(selectedKey, { isVisible: !selectedSection.isVisible });
        await loadSections();
    };

    const handleAddDefaultSection = async (key: string, title: string) => {
        setSaving(true);
        await upsertBookSection(key, title, '', sections.length);
        await loadSections();
        setSaving(false);
        handleSelectSection(key);
    };

    const handleAddCustomSection = async () => {
        if (!newKey.trim() || !newTitle.trim()) return;
        const safeKey = newKey.trim().toLowerCase().replace(/[^a-z0-9_]/g, '_');
        setSaving(true);
        await upsertBookSection(safeKey, newTitle.trim(), '', sections.length);
        await loadSections();
        setSaving(false);
        setShowNewForm(false);
        setNewKey('');
        setNewTitle('');
        handleSelectSection(safeKey);
    };

    // Find which default sections are not yet created
    const existingKeys = new Set(sections.map(s => s.sectionKey));
    const availableDefaults = DEFAULT_SECTIONS.filter(d => !existingKeys.has(d.key));

    return (
        <div className="min-h-screen bg-slate-50">
            {/* Header */}
            <div className="bg-white border-b border-slate-200 px-3 sm:px-6 py-2.5 sm:py-3 flex items-center justify-between sticky top-0 z-20">
                <div className="flex items-center gap-2 sm:gap-3 min-w-0">
                    <Link href="/book">
                        <Button variant="ghost" size="sm" className="gap-1 sm:gap-1.5 shrink-0">
                            <ArrowLeft className="w-4 h-4" />
                            <span className="hidden sm:inline">Sách gia phả</span>
                        </Button>
                    </Link>
                    <div className="h-5 w-px bg-slate-200 hidden sm:block" />
                    <div className="flex items-center gap-2 min-w-0">
                        <BookOpen className="w-4 h-4 text-amber-600 shrink-0" />
                        <span className="font-semibold text-slate-800 text-sm sm:text-base truncate">Chỉnh sửa nội dung sách</span>
                    </div>
                </div>
                {selectedKey && (
                    <div className="flex items-center gap-1 sm:gap-2 shrink-0">
                        <Button
                            variant="ghost"
                            size="sm"
                            onClick={handleToggleVisibility}
                            className="gap-1 sm:gap-1.5 text-slate-600 h-8 px-2 sm:px-3"
                        >
                            {selectedSection?.isVisible ? <Eye className="w-4 h-4" /> : <EyeOff className="w-4 h-4" />}
                            <span className="hidden sm:inline">{selectedSection?.isVisible ? 'Hiện' : 'Ẩn'}</span>
                        </Button>
                        <Button
                            variant="ghost"
                            size="sm"
                            onClick={handleDelete}
                            className="gap-1 sm:gap-1.5 text-red-600 hover:text-red-700 hover:bg-red-50 h-8 px-2 sm:px-3"
                        >
                            <Trash2 className="w-4 h-4" />
                            <span className="hidden sm:inline">Xóa</span>
                        </Button>
                        <Button
                            size="sm"
                            onClick={handleSave}
                            disabled={!dirty || saving}
                            className="gap-1 sm:gap-1.5 bg-amber-600 hover:bg-amber-700 h-8 px-2 sm:px-3"
                        >
                            <Save className="w-4 h-4" />
                            <span className="hidden sm:inline">{saving ? 'Đang lưu...' : 'Lưu'}</span>
                        </Button>
                        {saveStatus === 'success' && (
                            <span className="flex items-center gap-1 text-xs text-emerald-600 animate-in fade-in">
                                <CheckCircle2 className="w-3.5 h-3.5" /> Đã lưu
                            </span>
                        )}
                        {saveStatus === 'error' && (
                            <span className="flex items-center gap-1 text-xs text-red-600 animate-in fade-in">
                                <AlertCircle className="w-3.5 h-3.5" /> Lỗi!
                            </span>
                        )}
                    </div>
                )}
            </div>

            <div className="flex flex-col md:flex-row h-[calc(100vh-57px)]">
                {/* Sidebar: Section List */}
                <div className="w-full md:w-72 bg-white border-r border-slate-200 flex flex-col max-h-[40vh] md:max-h-none overflow-y-auto md:overflow-y-visible">
                    <div className="p-4 border-b border-slate-100">
                        <h3 className="text-sm font-semibold text-slate-700 mb-1">Mục lục sách</h3>
                        <p className="text-[11px] text-slate-400">Chọn mục để chỉnh sửa nội dung</p>
                    </div>

                    {/* Existing sections */}
                    <div className="flex-1 overflow-y-auto p-2 space-y-0.5">
                        {sections.length === 0 && (
                            <div className="text-center py-8 text-slate-400 text-xs">
                                Chưa có mục nào. Thêm mục bên dưới.
                            </div>
                        )}
                        {sections.map((section) => (
                            <button
                                key={section.sectionKey}
                                onClick={() => handleSelectSection(section.sectionKey)}
                                className={`w-full text-left px-3 py-2.5 rounded-lg transition-colors flex items-center gap-2 group ${
                                    selectedKey === section.sectionKey
                                        ? 'bg-amber-50 border border-amber-200 text-amber-800'
                                        : 'hover:bg-slate-50 text-slate-700'
                                }`}
                            >
                                <GripVertical className="w-3 h-3 text-slate-300 opacity-0 group-hover:opacity-100 cursor-grab" />
                                <FileText className={`w-3.5 h-3.5 ${selectedKey === section.sectionKey ? 'text-amber-600' : 'text-slate-400'}`} />
                                <div className="flex-1 min-w-0">
                                    <div className="text-xs font-medium truncate">{section.title}</div>
                                    <div className="text-[10px] text-slate-400 flex items-center gap-1">
                                        {section.sectionKey}
                                        {!section.isVisible && <EyeOff className="w-2.5 h-2.5 text-slate-300" />}
                                    </div>
                                </div>
                                <ChevronRight className={`w-3 h-3 ${selectedKey === section.sectionKey ? 'text-amber-500' : 'text-slate-300'}`} />
                            </button>
                        ))}
                    </div>

                    {/* Add section buttons */}
                    <div className="p-3 border-t border-slate-100 space-y-2">
                        {/* Default section templates */}
                        {availableDefaults.length > 0 && (
                            <div className="space-y-1">
                                <p className="text-[10px] font-medium text-slate-400 uppercase tracking-wider px-1">Thêm mục sẵn có</p>
                                {availableDefaults.map(d => (
                                    <button
                                        key={d.key}
                                        onClick={() => handleAddDefaultSection(d.key, d.title)}
                                        className="w-full text-left px-2.5 py-1.5 text-[11px] text-slate-600 hover:bg-slate-50 rounded-md flex items-center gap-2 transition-colors"
                                    >
                                        <Plus className="w-3 h-3 text-slate-400" />
                                        {d.title}
                                    </button>
                                ))}
                            </div>
                        )}

                        {/* Custom section */}
                        {showNewForm ? (
                            <div className="space-y-2 p-2 bg-slate-50 rounded-lg">
                                <Input
                                    value={newTitle}
                                    onChange={(e) => { setNewTitle(e.target.value); setNewKey(e.target.value.toLowerCase().replace(/[^a-z0-9]/g, '_')); }}
                                    placeholder="Tiêu đề mục..."
                                    className="text-xs h-8"
                                />
                                <div className="flex gap-1.5">
                                    <Button size="sm" variant="ghost" onClick={() => setShowNewForm(false)} className="flex-1 h-7 text-[11px]">
                                        Hủy
                                    </Button>
                                    <Button size="sm" onClick={handleAddCustomSection} disabled={!newTitle.trim()} className="flex-1 h-7 text-[11px] bg-amber-600 hover:bg-amber-700">
                                        Thêm
                                    </Button>
                                </div>
                            </div>
                        ) : (
                            <button
                                onClick={() => setShowNewForm(true)}
                                className="w-full text-center px-3 py-2 text-[11px] font-medium text-amber-700 border border-dashed border-amber-300 rounded-lg hover:bg-amber-50 transition-colors flex items-center justify-center gap-1.5"
                            >
                                <Plus className="w-3 h-3" />
                                Thêm mục tùy chỉnh
                            </button>
                        )}
                    </div>
                </div>

                {/* Main: Editor */}
                <div className="flex-1 flex flex-col">
                    {selectedKey ? (
                        <>
                            {/* Section title */}
                            <div className="p-6 pb-4 border-b border-slate-100 bg-white">
                                <label className="text-xs font-medium text-slate-500 block mb-1.5">Tiêu đề mục</label>
                                <Input
                                    value={editTitle}
                                    onChange={(e) => { setEditTitle(e.target.value); setDirty(true); }}
                                    placeholder="Nhập tiêu đề..."
                                    className="text-lg font-semibold border-slate-200 h-12"
                                />
                            </div>

                            {/* Content editor with Preview */}
                            <div className="flex-1 p-4 sm:p-6 overflow-y-auto">
                                <Tabs defaultValue="edit" className="h-full flex flex-col">
                                    <div className="flex items-center justify-between mb-3">
                                        <label className="text-xs font-medium text-slate-500">Nội dung</label>
                                        <TabsList className="h-8">
                                            <TabsTrigger value="edit" className="text-xs gap-1 h-7 px-3">
                                                <Pencil className="h-3 w-3" /> Soạn thảo
                                            </TabsTrigger>
                                            <TabsTrigger value="preview" className="text-xs gap-1 h-7 px-3">
                                                <MonitorPlay className="h-3 w-3" /> Xem trước
                                            </TabsTrigger>
                                        </TabsList>
                                    </div>
                                    <TabsContent value="edit" className="flex-1 mt-0">
                                        <RichTextEditor
                                            content={editContent}
                                            onChange={(html) => { setEditContent(html); setDirty(true); }}
                                            placeholder={DEFAULT_SECTIONS.find(d => d.key === selectedKey)?.hint || 'Viết nội dung cho mục này...'}
                                        />
                                    </TabsContent>
                                    <TabsContent value="preview" className="flex-1 mt-0">
                                        <div className="border rounded-lg bg-white dark:bg-card p-6 min-h-[300px]">
                                            <h2 className="text-2xl font-bold mb-4 text-amber-900 dark:text-amber-200">{editTitle}</h2>
                                            {editContent ? (
                                                <div
                                                    className="prose prose-sm sm:prose-base dark:prose-invert max-w-none prose-headings:text-amber-900 dark:prose-headings:text-amber-200"
                                                    dangerouslySetInnerHTML={{ __html: editContent }}
                                                />
                                            ) : (
                                                <p className="text-muted-foreground italic">Chưa có nội dung. Chuyển sang tab Soạn thảo để viết.</p>
                                            )}
                                        </div>
                                    </TabsContent>
                                </Tabs>
                            </div>
                        </>
                    ) : (
                        <div className="flex-1 flex items-center justify-center text-slate-400">
                            <div className="text-center">
                                <BookOpen className="w-12 h-12 mx-auto mb-3 text-slate-300" />
                                <p className="text-sm font-medium">Chọn một mục từ danh sách bên trái</p>
                                <p className="text-xs mt-1">hoặc thêm mục mới để bắt đầu viết</p>
                            </div>
                        </div>
                    )}
                </div>
            </div>
        </div>
    );
}
