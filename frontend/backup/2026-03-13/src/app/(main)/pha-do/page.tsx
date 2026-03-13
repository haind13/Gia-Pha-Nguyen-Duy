'use client';

import { useEffect, useState, useCallback } from 'react';
import Link from 'next/link';
import { motion } from 'framer-motion';
import {
    TreePine, Plus, Users, GitBranch, ArrowRight,
    Loader2, Crown, Pencil, Trash2, MoreVertical,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import {
    Dialog,
    DialogContent,
    DialogHeader,
    DialogTitle,
    DialogDescription,
    DialogFooter,
} from '@/components/ui/dialog';
import {
    DropdownMenu,
    DropdownMenuContent,
    DropdownMenuItem,
    DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { supabase } from '@/lib/supabase';
import { useAuth } from '@/components/auth-provider';

// ─── Types ────────────────────────────────────────────────────────
interface TreeRecord {
    id: string;
    name: string;
    description: string | null;
    slug: string;
    is_default: boolean;
    root_person_handle: string | null;
    cover_color: string;
    member_count: number;
    generation_count: number;
    created_by: string | null;
    created_at: string;
}

// ─── Color Palette for Tree Cards ───────────────────────────────
const colorMap: Record<string, { bg: string; text: string; border: string; icon: string }> = {
    amber: {
        bg: 'bg-amber-50 dark:bg-amber-950/20',
        text: 'text-amber-700 dark:text-amber-400',
        border: 'border-amber-200/60 dark:border-amber-800/30',
        icon: 'bg-amber-100 dark:bg-amber-900/40',
    },
    blue: {
        bg: 'bg-blue-50 dark:bg-blue-950/20',
        text: 'text-blue-700 dark:text-blue-400',
        border: 'border-blue-200/60 dark:border-blue-800/30',
        icon: 'bg-blue-100 dark:bg-blue-900/40',
    },
    green: {
        bg: 'bg-green-50 dark:bg-green-950/20',
        text: 'text-green-700 dark:text-green-400',
        border: 'border-green-200/60 dark:border-green-800/30',
        icon: 'bg-green-100 dark:bg-green-900/40',
    },
    purple: {
        bg: 'bg-purple-50 dark:bg-purple-950/20',
        text: 'text-purple-700 dark:text-purple-400',
        border: 'border-purple-200/60 dark:border-purple-800/30',
        icon: 'bg-purple-100 dark:bg-purple-900/40',
    },
    rose: {
        bg: 'bg-rose-50 dark:bg-rose-950/20',
        text: 'text-rose-700 dark:text-rose-400',
        border: 'border-rose-200/60 dark:border-rose-800/30',
        icon: 'bg-rose-100 dark:bg-rose-900/40',
    },
    teal: {
        bg: 'bg-teal-50 dark:bg-teal-950/20',
        text: 'text-teal-700 dark:text-teal-400',
        border: 'border-teal-200/60 dark:border-teal-800/30',
        icon: 'bg-teal-100 dark:bg-teal-900/40',
    },
};

const colorOptions = Object.keys(colorMap);

function getColor(key: string) {
    return colorMap[key] || colorMap.amber;
}

// ─── Animation ──────────────────────────────────────────────────
const stagger = {
    hidden: { opacity: 0 },
    visible: { opacity: 1, transition: { staggerChildren: 0.08, delayChildren: 0.1 } },
} as const;

const cardAnim = {
    hidden: { opacity: 0, y: 20 },
    visible: { opacity: 1, y: 0, transition: { duration: 0.5, ease: 'easeOut' as const } },
} as const;

// ─── Default Fallback Tree ──────────────────────────────────────
const FALLBACK_TREE: TreeRecord = {
    id: 'default',
    name: 'Phả đồ chung',
    description: 'Phả đồ tổng hợp toàn bộ dòng họ Nguyễn Duy — nhánh cụ Khoan Giản',
    slug: 'main',
    is_default: true,
    root_person_handle: null,
    cover_color: 'amber',
    member_count: 0,
    generation_count: 16,
    created_by: null,
    created_at: new Date().toISOString(),
};

// ─── Tree Card Component ────────────────────────────────────────
function TreeCard({ tree, canManage, onEdit, onDelete }: {
    tree: TreeRecord;
    canManage: boolean;
    onEdit: (tree: TreeRecord) => void;
    onDelete: (tree: TreeRecord) => void;
}) {
    const c = getColor(tree.cover_color);

    return (
        <motion.div variants={cardAnim}>
            <Link href={`/pha-do/${tree.slug}`}>
                <Card className={`group relative overflow-hidden border ${c.border} hover:shadow-lg transition-all duration-300 cursor-pointer`}>
                    {/* Top color band */}
                    <div className={`h-1.5 ${c.bg}`} />

                    <CardContent className="p-5 sm:p-6">
                        <div className="flex items-start justify-between gap-3">
                            <div className="flex items-start gap-3 flex-1 min-w-0">
                                <div className={`h-11 w-11 rounded-xl ${c.icon} flex items-center justify-center shrink-0`}>
                                    <TreePine className={`h-5 w-5 ${c.text}`} />
                                </div>
                                <div className="min-w-0 flex-1">
                                    <div className="flex items-center gap-2 mb-1">
                                        <h3 className="font-semibold text-base truncate">{tree.name}</h3>
                                        {tree.is_default && (
                                            <Badge variant="secondary" className="text-[10px] px-1.5 py-0 shrink-0">
                                                <Crown className="h-2.5 w-2.5 mr-0.5" />
                                                Chung
                                            </Badge>
                                        )}
                                    </div>
                                    {tree.description && (
                                        <p className="text-sm text-muted-foreground line-clamp-2 mb-3">
                                            {tree.description}
                                        </p>
                                    )}
                                    <div className="flex items-center gap-4 text-xs text-muted-foreground">
                                        {tree.member_count > 0 && (
                                            <span className="flex items-center gap-1">
                                                <Users className="h-3.5 w-3.5" />
                                                {tree.member_count} thành viên
                                            </span>
                                        )}
                                        {tree.generation_count > 0 && (
                                            <span className="flex items-center gap-1">
                                                <GitBranch className="h-3.5 w-3.5" />
                                                {tree.generation_count} đời
                                            </span>
                                        )}
                                    </div>
                                </div>
                            </div>

                            {/* Actions menu for admin/editor */}
                            {canManage && !tree.is_default && (
                                <DropdownMenu>
                                    <DropdownMenuTrigger asChild onClick={(e) => e.preventDefault()}>
                                        <Button variant="ghost" size="icon" className="h-8 w-8 shrink-0 opacity-0 group-hover:opacity-100 transition-opacity">
                                            <MoreVertical className="h-4 w-4" />
                                        </Button>
                                    </DropdownMenuTrigger>
                                    <DropdownMenuContent align="end">
                                        <DropdownMenuItem onClick={(e) => { e.preventDefault(); onEdit(tree); }}>
                                            <Pencil className="h-4 w-4 mr-2" /> Chỉnh sửa
                                        </DropdownMenuItem>
                                        <DropdownMenuItem className="text-destructive" onClick={(e) => { e.preventDefault(); onDelete(tree); }}>
                                            <Trash2 className="h-4 w-4 mr-2" /> Xóa
                                        </DropdownMenuItem>
                                    </DropdownMenuContent>
                                </DropdownMenu>
                            )}

                            {/* Arrow on hover */}
                            <ArrowRight className={`h-5 w-5 ${c.text} opacity-0 group-hover:opacity-100 group-hover:translate-x-1 transition-all duration-300 shrink-0 mt-1`} />
                        </div>
                    </CardContent>
                </Card>
            </Link>
        </motion.div>
    );
}

// ─── Create/Edit Tree Dialog ────────────────────────────────────
function TreeFormDialog({
    open,
    onOpenChange,
    editingTree,
    onSave,
    saving,
}: {
    open: boolean;
    onOpenChange: (open: boolean) => void;
    editingTree: TreeRecord | null;
    onSave: (data: { name: string; description: string; slug: string; cover_color: string }) => Promise<void>;
    saving: boolean;
}) {
    const [name, setName] = useState('');
    const [description, setDescription] = useState('');
    const [slug, setSlug] = useState('');
    const [color, setColor] = useState('blue');

    useEffect(() => {
        if (editingTree) {
            setName(editingTree.name);
            setDescription(editingTree.description || '');
            setSlug(editingTree.slug);
            setColor(editingTree.cover_color);
        } else {
            setName('');
            setDescription('');
            setSlug('');
            setColor('blue');
        }
    }, [editingTree, open]);

    const handleNameChange = (val: string) => {
        setName(val);
        if (!editingTree) {
            const s = val
                .toLowerCase()
                .normalize('NFD').replace(/[\u0300-\u036f]/g, '')
                .replace(/đ/g, 'd').replace(/Đ/g, 'D')
                .replace(/[^a-z0-9]+/g, '-')
                .replace(/^-|-$/g, '');
            setSlug(s);
        }
    };

    return (
        <Dialog open={open} onOpenChange={onOpenChange}>
            <DialogContent className="sm:max-w-md">
                <DialogHeader>
                    <DialogTitle>{editingTree ? 'Chỉnh sửa phả đồ' : 'Tạo phả đồ mới'}</DialogTitle>
                    <DialogDescription>
                        {editingTree
                            ? 'Cập nhật thông tin phả đồ'
                            : 'Tạo phả đồ mới cho một nhánh/chi/ngành của dòng họ'}
                    </DialogDescription>
                </DialogHeader>

                <div className="space-y-4 py-2">
                    <div>
                        <label className="text-sm font-medium mb-1.5 block">Tên phả đồ *</label>
                        <Input
                            placeholder="VD: Nhánh cụ Khoan Giản chi 2"
                            value={name}
                            onChange={(e) => handleNameChange(e.target.value)}
                        />
                    </div>
                    <div>
                        <label className="text-sm font-medium mb-1.5 block">Mô tả</label>
                        <Textarea
                            placeholder="Mô tả ngắn về phả đồ này..."
                            value={description}
                            onChange={(e) => setDescription(e.target.value)}
                            rows={2}
                        />
                    </div>
                    <div>
                        <label className="text-sm font-medium mb-1.5 block">Đường dẫn (slug)</label>
                        <Input
                            placeholder="vd: nhanh-chi-2"
                            value={slug}
                            onChange={(e) => setSlug(e.target.value)}
                            disabled={!!editingTree}
                        />
                        <p className="text-xs text-muted-foreground mt-1">URL: /pha-do/{slug || '...'}</p>
                    </div>
                    <div>
                        <label className="text-sm font-medium mb-1.5 block">Màu sắc</label>
                        <div className="flex gap-2">
                            {colorOptions.map((c) => {
                                const col = getColor(c);
                                return (
                                    <button
                                        key={c}
                                        type="button"
                                        className={`h-8 w-8 rounded-full ${col.icon} border-2 transition-all ${
                                            color === c ? 'border-foreground scale-110' : 'border-transparent hover:scale-105'
                                        }`}
                                        onClick={() => setColor(c)}
                                        title={c}
                                    />
                                );
                            })}
                        </div>
                    </div>
                </div>

                <DialogFooter>
                    <Button variant="outline" onClick={() => onOpenChange(false)} disabled={saving}>
                        Hủy
                    </Button>
                    <Button
                        onClick={() => onSave({ name, description, slug, cover_color: color })}
                        disabled={!name.trim() || !slug.trim() || saving}
                    >
                        {saving && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
                        {editingTree ? 'Lưu' : 'Tạo phả đồ'}
                    </Button>
                </DialogFooter>
            </DialogContent>
        </Dialog>
    );
}

// ─── Main Page ──────────────────────────────────────────────────
export default function PhaDoListPage() {
    const { canEdit, isAdmin, loading: authLoading } = useAuth();
    const [trees, setTrees] = useState<TreeRecord[]>([]);
    const [loading, setLoading] = useState(true);
    const [dialogOpen, setDialogOpen] = useState(false);
    const [editingTree, setEditingTree] = useState<TreeRecord | null>(null);
    const [saving, setSaving] = useState(false);
    const [error, setError] = useState<string | null>(null);

    const fetchTrees = useCallback(async () => {
        try {
            const { data, error: fetchErr } = await supabase
                .from('trees')
                .select('*')
                .order('is_default', { ascending: false })
                .order('created_at', { ascending: true });

            if (fetchErr) {
                console.warn('trees table not found, using fallback:', fetchErr.message);
                setTrees([FALLBACK_TREE]);
            } else if (!data || data.length === 0) {
                setTrees([FALLBACK_TREE]);
            } else {
                setTrees(data as TreeRecord[]);
            }
        } catch {
            setTrees([FALLBACK_TREE]);
        } finally {
            setLoading(false);
        }
    }, []);

    useEffect(() => {
        fetchTrees();
    }, [fetchTrees]);

    // Update member count for default tree
    useEffect(() => {
        async function updateDefaultCount() {
            const { count } = await supabase
                .from('people')
                .select('*', { count: 'exact', head: true });
            if (count && count > 0) {
                setTrees((prev) =>
                    prev.map((t) =>
                        t.is_default ? { ...t, member_count: count } : t
                    )
                );
            }
        }
        if (!loading) updateDefaultCount();
    }, [loading]);

    const handleSave = async (data: { name: string; description: string; slug: string; cover_color: string }) => {
        setSaving(true);
        setError(null);
        try {
            if (editingTree) {
                const { error: err } = await supabase
                    .from('trees')
                    .update({
                        name: data.name,
                        description: data.description || null,
                        cover_color: data.cover_color,
                        updated_at: new Date().toISOString(),
                    })
                    .eq('id', editingTree.id);
                if (err) throw err;
            } else {
                const { error: err } = await supabase
                    .from('trees')
                    .insert({
                        name: data.name,
                        description: data.description || null,
                        slug: data.slug,
                        cover_color: data.cover_color,
                    });
                if (err) {
                    if (err.message.includes('duplicate') || err.message.includes('unique')) {
                        setError('Đường dẫn (slug) đã tồn tại. Hãy chọn tên khác.');
                        return;
                    }
                    throw err;
                }
            }
            setDialogOpen(false);
            setEditingTree(null);
            await fetchTrees();
        } catch (e: unknown) {
            setError(e instanceof Error ? e.message : 'Có lỗi xảy ra');
        } finally {
            setSaving(false);
        }
    };

    const handleDelete = async (tree: TreeRecord) => {
        if (!confirm(`Bạn chắc chắn muốn xóa phả đồ "${tree.name}"?`)) return;
        await supabase.from('trees').delete().eq('id', tree.id);
        await fetchTrees();
    };

    const handleEdit = (tree: TreeRecord) => {
        setEditingTree(tree);
        setDialogOpen(true);
    };

    const canManage = canEdit || isAdmin;

    if (loading || authLoading) {
        return (
            <div className="flex items-center justify-center h-[50vh]">
                <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
            </div>
        );
    }

    return (
        <div className="max-w-4xl mx-auto">
            {/* Header */}
            <div className="flex items-center justify-between mb-6 sm:mb-8">
                <div>
                    <h1 className="text-xl sm:text-2xl font-bold flex items-center gap-2">
                        <TreePine className="h-6 w-6 text-amber-600 dark:text-amber-400" />
                        Chọn phả đồ
                    </h1>
                    <p className="text-sm text-muted-foreground mt-1">
                        Chọn phả đồ để xem hoặc chỉnh sửa
                    </p>
                </div>

                {canManage && (
                    <Button
                        onClick={() => { setEditingTree(null); setDialogOpen(true); }}
                        className="gap-2 bg-amber-700 hover:bg-amber-800 dark:bg-amber-600 dark:hover:bg-amber-500 text-white"
                    >
                        <Plus className="h-4 w-4" />
                        <span className="hidden sm:inline">Tạo phả đồ</span>
                    </Button>
                )}
            </div>

            {/* Error */}
            {error && (
                <div className="mb-4 p-3 rounded-lg bg-destructive/10 text-destructive text-sm">
                    {error}
                </div>
            )}

            {/* Tree Cards Grid */}
            <motion.div
                className="grid gap-4 sm:grid-cols-2"
                variants={stagger}
                initial="hidden"
                animate="visible"
            >
                {trees.map((tree) => (
                    <TreeCard
                        key={tree.id}
                        tree={tree}
                        canManage={canManage}
                        onEdit={handleEdit}
                        onDelete={handleDelete}
                    />
                ))}

                {/* Empty create card for admin/editor */}
                {canManage && (
                    <motion.div variants={cardAnim}>
                        <Card
                            className="group border-dashed border-2 hover:border-amber-300 dark:hover:border-amber-700 hover:bg-amber-50/50 dark:hover:bg-amber-950/10 transition-all duration-300 cursor-pointer"
                            onClick={() => { setEditingTree(null); setDialogOpen(true); }}
                        >
                            <CardContent className="p-5 sm:p-6 flex items-center justify-center min-h-[120px]">
                                <div className="text-center text-muted-foreground group-hover:text-amber-700 dark:group-hover:text-amber-400 transition-colors">
                                    <Plus className="h-8 w-8 mx-auto mb-2 opacity-50 group-hover:opacity-100 transition-opacity" />
                                    <p className="text-sm font-medium">Thêm phả đồ mới</p>
                                    <p className="text-xs mt-0.5 opacity-70">Cho nhánh/chi/ngành khác</p>
                                </div>
                            </CardContent>
                        </Card>
                    </motion.div>
                )}
            </motion.div>

            {/* Info note */}
            <p className="text-xs text-muted-foreground text-center mt-8">
                Mỗi phả đồ đại diện cho một nhánh hoặc chi trong dòng họ.
                {!canManage && ' Đăng nhập với quyền Editor để tạo phả đồ mới.'}
            </p>

            {/* Create/Edit Dialog */}
            <TreeFormDialog
                open={dialogOpen}
                onOpenChange={(open) => {
                    setDialogOpen(open);
                    if (!open) setEditingTree(null);
                }}
                editingTree={editingTree}
                onSave={handleSave}
                saving={saving}
            />
        </div>
    );
}
