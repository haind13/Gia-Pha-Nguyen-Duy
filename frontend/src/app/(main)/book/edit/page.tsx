'use client';

import { useEffect, useState, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import { useAuth } from '@/components/auth-provider';
import { RequireAuth } from '@/components/require-auth';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import {
    BookOpen, Save, Trash2, Plus, ArrowLeft, Eye, EyeOff,
    GripVertical, ChevronRight, FileText,
} from 'lucide-react';
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
    };

    const handleSave = async () => {
        if (!selectedKey) return;
        setSaving(true);
        await upsertBookSection(selectedKey, editTitle, editContent, selectedSection?.sortOrder ?? sections.length);
        await loadSections();
        setDirty(false);
        setSaving(false);
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
            <div className="bg-white border-b border-slate-200 px-6 py-3 flex items-center justify-between sticky top-0 z-20">
                <div className="flex items-center gap-3">
                    <Link href="/book">
                        <Button variant="ghost" size="sm" className="gap-1.5">
                            <ArrowLeft className="w-4 h-4" />
                            Sách gia phả
                        </Button>
                    </Link>
                    <div className="h-5 w-px bg-slate-200" />
                    <div className="flex items-center gap-2">
                        <BookOpen className="w-4 h-4 text-amber-600" />
                        <span className="font-semibold text-slate-800">Chỉnh sửa nội dung sách</span>
                    </div>
                </div>
                {selectedKey && (
                    <div className="flex items-center gap-2">
                        <Button
                            variant="ghost"
                            size="sm"
                            onClick={handleToggleVisibility}
                            className="gap-1.5 text-slate-600"
                        >
                            {selectedSection?.isVisible ? <Eye className="w-4 h-4" /> : <EyeOff className="w-4 h-4" />}
                            {selectedSection?.isVisible ? 'Hiện' : 'Ẩn'}
                        </Button>
                        <Button
                            variant="ghost"
                            size="sm"
                            onClick={handleDelete}
                            className="gap-1.5 text-red-600 hover:text-red-700 hover:bg-red-50"
                        >
                            <Trash2 className="w-4 h-4" />
                            Xóa
                        </Button>
                        <Button
                            size="sm"
                            onClick={handleSave}
                            disabled={!dirty || saving}
                            className="gap-1.5 bg-amber-600 hover:bg-amber-700"
                        >
                            <Save className="w-4 h-4" />
                            {saving ? 'Đang lưu...' : 'Lưu'}
                        </Button>
                    </div>
                )}
            </div>

            <div className="flex h-[calc(100vh-57px)]">
                {/* Sidebar: Section List */}
                <div className="w-72 bg-white border-r border-slate-200 flex flex-col">
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

                            {/* Content editor */}
                            <div className="flex-1 p-6 overflow-y-auto">
                                <label className="text-xs font-medium text-slate-500 block mb-1.5">Nội dung</label>
                                <Textarea
                                    value={editContent}
                                    onChange={(e) => { setEditContent(e.target.value); setDirty(true); }}
                                    placeholder={
                                        DEFAULT_SECTIONS.find(d => d.key === selectedKey)?.hint
                                        || 'Viết nội dung cho mục này...'
                                    }
                                    className="min-h-[500px] text-sm leading-relaxed resize-none border-slate-200 focus:ring-amber-400"
                                />
                                <p className="text-[10px] text-slate-400 mt-2">
                                    Hỗ trợ định dạng văn bản thuần. Nội dung sẽ hiển thị trong sách gia phả.
                                </p>
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
