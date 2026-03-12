'use client';

import { useEffect, useState, useCallback, useMemo } from 'react';
import { useAuth } from '@/components/auth-provider';
import {
    X, Pencil, Save, User, Phone, Mail, MapPin, Briefcase,
    GraduationCap, StickyNote, Users, ChevronRight,
} from 'lucide-react';
import {
    fetchPersonDetail,
    updatePerson as supaUpdatePersonFull,
    type PersonEditFields,
} from '@/lib/supabase-data';
import type { PersonDetail } from '@/lib/genealogy-types';
import { zodiacYear } from '@/lib/genealogy-types';

// ─── Shared sub-types (same as tree-layout but decoupled) ───
export interface SimpleTreeNode {
    handle: string;
    displayName: string;
    gender: number;
    generation: number;
    birthYear?: number;
    deathYear?: number;
    isLiving: boolean;
    isPrivacyFiltered: boolean;
    isPatrilineal: boolean;
    families: string[];
    parentFamilies: string[];
}

export interface SimpleTreeFamily {
    handle: string;
    fatherHandle?: string;
    motherHandle?: string;
    children: string[];
}

export interface PersonDetailPanelProps {
    handle: string;
    /** Tree data for relationship navigation – optional. If omitted, relationships section is hidden. */
    treeData?: { people: SimpleTreeNode[]; families: SimpleTreeFamily[] } | null;
    /** Open in edit mode immediately */
    initialEdit?: boolean;
    onClose: () => void;
    /** Navigate to another person (e.g. click on a relation chip) */
    onNavigate?: (handle: string) => void;
    /** Called after a successful save */
    onPersonUpdated?: (handle: string, fields: PersonEditFields) => void;
}

// ═══════════════════════════════════════════════
// PersonDetailPanel
// ═══════════════════════════════════════════════
export function PersonDetailPanel({ handle, treeData, initialEdit, onClose, onNavigate, onPersonUpdated }: PersonDetailPanelProps) {
    const [detail, setDetail] = useState<PersonDetail | null>(null);
    const [loading, setLoading] = useState(true);
    const [editing, setEditing] = useState(false);
    const [saving, setSaving] = useState(false);
    const [saveMsg, setSaveMsg] = useState<{ type: 'ok' | 'err'; text: string } | null>(null);
    const { canEdit } = useAuth();
    const person = treeData?.people.find(p => p.handle === handle);

    // Edit form state
    const [form, setForm] = useState<PersonEditFields>({});

    useEffect(() => {
        setLoading(true);
        setDetail(null);
        setEditing(false);
        setSaveMsg(null);
        fetchPersonDetail(handle).then(d => {
            if (d) {
                setDetail(d);
            } else if (person) {
                setDetail({
                    handle: person.handle,
                    displayName: person.displayName,
                    gender: person.gender,
                    generation: person.generation,
                    birthYear: person.birthYear,
                    deathYear: person.deathYear,
                    isLiving: person.isLiving,
                    isPrivacyFiltered: person.isPrivacyFiltered,
                    isPatrilineal: person.isPatrilineal,
                    families: person.families,
                    parentFamilies: person.parentFamilies,
                });
            }
            setLoading(false);
        });
    }, [handle, person]);

    // Initialize form when entering edit mode
    const startEditing = useCallback(() => {
        if (!detail) return;
        setForm({
            displayName: detail.displayName || '',
            nickName: detail.nickName || '',
            birthYear: detail.birthYear ?? null,
            birthDate: detail.birthDate || '',
            birthPlace: detail.birthPlace || '',
            deathYear: detail.deathYear ?? null,
            deathDate: detail.deathDate || '',
            deathPlace: detail.deathPlace || '',
            isLiving: detail.isLiving,
            phone: detail.phone || '',
            email: detail.email || '',
            zalo: detail.zalo || '',
            facebook: detail.facebook || '',
            currentAddress: detail.currentAddress || '',
            hometown: detail.hometown || '',
            occupation: detail.occupation || '',
            company: detail.company || '',
            education: detail.education || '',
            notes: detail.notes || '',
        });
        setEditing(true);
        setSaveMsg(null);
    }, [detail]);

    // Auto-enter edit mode when initialEdit is true and data is loaded
    useEffect(() => {
        if (initialEdit && canEdit && detail && !loading) {
            startEditing();
        }
    }, [initialEdit, canEdit, detail, loading, startEditing]);

    const handleSave = useCallback(async () => {
        if (!detail) return;
        setSaving(true);
        setSaveMsg(null);
        // Clean empty strings to null
        const cleaned: PersonEditFields = {};
        for (const [k, v] of Object.entries(form)) {
            if (v === '' || v === undefined) (cleaned as Record<string, unknown>)[k] = null;
            else (cleaned as Record<string, unknown>)[k] = v;
        }
        const { error } = await supaUpdatePersonFull(detail.handle, cleaned);
        if (error) {
            setSaveMsg({ type: 'err', text: `Lỗi: ${error}` });
        } else {
            setSaveMsg({ type: 'ok', text: 'Đã lưu thành công!' });
            // Update local detail — convert nulls to undefined for PersonDetail compatibility
            const detailUpdate: Partial<PersonDetail> = {};
            for (const [k, v] of Object.entries(cleaned)) {
                (detailUpdate as Record<string, unknown>)[k] = v === null ? undefined : v;
            }
            if (!detailUpdate.displayName) detailUpdate.displayName = detail.displayName;
            setDetail(prev => prev ? { ...prev, ...detailUpdate } as PersonDetail : prev);
            onPersonUpdated?.(detail.handle, cleaned);
            setTimeout(() => setEditing(false), 600);
        }
        setSaving(false);
    }, [detail, form, onPersonUpdated]);

    // Form field updater
    const setField = useCallback(<K extends keyof PersonEditFields>(key: K, value: PersonEditFields[K]) => {
        setForm(prev => ({ ...prev, [key]: value }));
    }, []);

    // Family relationships (only when treeData provided)
    const parents = useMemo(() => {
        if (!treeData || !person) return [];
        const result: { label: string; person: SimpleTreeNode }[] = [];
        for (const pfId of person.parentFamilies) {
            const fam = treeData.families.find(f => f.handle === pfId);
            if (!fam) continue;
            if (fam.fatherHandle) {
                const father = treeData.people.find(p => p.handle === fam.fatherHandle);
                if (father) result.push({ label: 'Cha', person: father });
            }
            if (fam.motherHandle) {
                const mother = treeData.people.find(p => p.handle === fam.motherHandle);
                if (mother) result.push({ label: 'Mẹ', person: mother });
            }
        }
        return result;
    }, [treeData, person]);

    const spousesAndChildren = useMemo(() => {
        if (!treeData || !person) return [];
        const result: { spouse?: SimpleTreeNode; children: SimpleTreeNode[]; familyHandle: string }[] = [];
        for (const fId of person.families) {
            const fam = treeData.families.find(f => f.handle === fId);
            if (!fam) continue;
            const spouseHandle = fam.fatherHandle === person.handle ? fam.motherHandle : fam.fatherHandle;
            const spouse = spouseHandle ? treeData.people.find(p => p.handle === spouseHandle) : undefined;
            const children = fam.children.map(ch => treeData.people.find(p => p.handle === ch)).filter(Boolean) as SimpleTreeNode[];
            result.push({ spouse, children, familyHandle: fam.handle });
        }
        return result;
    }, [treeData, person]);

    const siblings = useMemo(() => {
        if (!treeData || !person) return [];
        const result: SimpleTreeNode[] = [];
        for (const pfId of person.parentFamilies) {
            const fam = treeData.families.find(f => f.handle === pfId);
            if (!fam) continue;
            for (const ch of fam.children) {
                if (ch !== person.handle) {
                    const sib = treeData.people.find(p => p.handle === ch);
                    if (sib) result.push(sib);
                }
            }
        }
        return result;
    }, [treeData, person]);

    const hasRelations = parents.length > 0 || spousesAndChildren.length > 0 || siblings.length > 0;

    const genderLabel = detail?.gender === 1 ? 'Nam' : detail?.gender === 2 ? 'Nữ' : 'Không rõ';
    const genderColor = detail?.gender === 1 ? 'blue' : 'pink';

    return (
        <div className="fixed inset-0 z-[60] flex justify-end" onClick={onClose}>
            <div className="absolute inset-0 bg-black/30 backdrop-blur-[2px]" />
            <div
                className="relative w-full max-w-md bg-white dark:bg-slate-900 shadow-2xl overflow-y-auto
                    animate-in slide-in-from-right duration-300 border-l border-slate-200 dark:border-slate-700"
                onClick={e => e.stopPropagation()}
            >
                {/* Header */}
                <div className={`sticky top-0 z-10 bg-gradient-to-r ${genderColor === 'blue' ? 'from-blue-50 to-blue-100/50 dark:from-blue-950/40 dark:to-blue-900/20' : 'from-pink-50 to-pink-100/50 dark:from-pink-950/40 dark:to-pink-900/20'} border-b border-slate-200 dark:border-slate-700 px-5 py-4`}>
                    <div className="flex items-start justify-between">
                        <div className="flex items-center gap-3">
                            <div className={`w-12 h-12 rounded-full flex items-center justify-center text-lg font-bold
                                ${genderColor === 'blue' ? 'bg-blue-200 text-blue-800 dark:bg-blue-800 dark:text-blue-200' : 'bg-pink-200 text-pink-800 dark:bg-pink-800 dark:text-pink-200'}`}>
                                {detail?.displayName?.split(' ').pop()?.[0] || '?'}
                            </div>
                            <div>
                                <h2 className="text-lg font-bold text-slate-800 dark:text-slate-100">
                                    {loading ? '...' : detail?.displayName || 'Không rõ'}
                                </h2>
                                <div className="flex items-center gap-2 text-xs text-slate-500 dark:text-slate-400 mt-0.5">
                                    <span className={`px-1.5 py-0.5 rounded font-semibold ${genderColor === 'blue' ? 'bg-blue-100 text-blue-700 dark:bg-blue-900 dark:text-blue-300' : 'bg-pink-100 text-pink-700 dark:bg-pink-900 dark:text-pink-300'}`}>
                                        {genderLabel}
                                    </span>
                                    {detail?.generation && (
                                        <span className="px-1.5 py-0.5 rounded bg-amber-100 text-amber-700 dark:bg-amber-900 dark:text-amber-300 font-semibold">
                                            Đời {detail.generation}
                                        </span>
                                    )}
                                    {detail?.isLiving ? (
                                        <span className="text-emerald-600 dark:text-emerald-400 font-medium">● Còn sống</span>
                                    ) : (
                                        <span className="text-slate-400">✝ Đã mất</span>
                                    )}
                                </div>
                            </div>
                        </div>
                        <div className="flex items-center gap-1">
                            {canEdit && !editing && !loading && detail && (
                                <button onClick={startEditing}
                                    className="p-1.5 rounded-lg hover:bg-slate-200/60 dark:hover:bg-slate-700/60 text-blue-500 hover:text-blue-700 transition-colors"
                                    title="Chỉnh sửa">
                                    <Pencil className="w-4.5 h-4.5" />
                                </button>
                            )}
                            <button onClick={onClose} className="p-1.5 rounded-lg hover:bg-slate-200/60 dark:hover:bg-slate-700/60 text-slate-400 hover:text-slate-600 dark:hover:text-slate-300 transition-colors">
                                <X className="w-5 h-5" />
                            </button>
                        </div>
                    </div>
                </div>

                {loading ? (
                    <div className="flex items-center justify-center py-20">
                        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary" />
                    </div>
                ) : detail && editing ? (
                    /* ═══ EDIT MODE ═══ */
                    <div className="p-5 space-y-5">
                        {saveMsg && (
                            <div className={`rounded-lg px-3 py-2 text-sm font-medium ${saveMsg.type === 'ok' ? 'bg-green-50 text-green-700 dark:bg-green-900/30 dark:text-green-400' : 'bg-red-50 text-red-700 dark:bg-red-900/30 dark:text-red-400'}`}>
                                {saveMsg.text}
                            </div>
                        )}

                        {/* Thông tin cơ bản */}
                        <DetailSection icon={<User className="w-4 h-4" />} title="Thông tin cơ bản">
                            <div className="space-y-3">
                                <EditField label="Họ tên" value={form.displayName || ''} onChange={v => setField('displayName', v)} />
                                <EditField label="Tên thường gọi" value={form.nickName || ''} onChange={v => setField('nickName', v)} placeholder="Biệt danh, tên gọi" />
                                <div className="grid grid-cols-2 gap-3">
                                    <EditField label="Năm sinh" value={form.birthYear?.toString() || ''} onChange={v => setField('birthYear', v ? parseInt(v) || null : null)} type="number" />
                                    <EditField label="Ngày sinh" value={form.birthDate || ''} onChange={v => setField('birthDate', v)} placeholder="VD: 15/03/1945" />
                                </div>
                                <EditField label="Nơi sinh" value={form.birthPlace || ''} onChange={v => setField('birthPlace', v)} />
                                <div className="flex items-center gap-3 py-1">
                                    <label className="text-xs font-medium text-slate-500 dark:text-slate-400">Trạng thái</label>
                                    <button
                                        className={`px-3 py-1 rounded-full text-xs font-semibold border transition-colors ${form.isLiving ? 'bg-emerald-50 text-emerald-700 border-emerald-200 dark:bg-emerald-900/30 dark:text-emerald-400 dark:border-emerald-700' : 'bg-slate-100 text-slate-500 border-slate-200 dark:bg-slate-800 dark:text-slate-400 dark:border-slate-600'}`}
                                        onClick={() => setField('isLiving', !form.isLiving)}
                                    >
                                        {form.isLiving ? '● Còn sống' : '✝ Đã mất'}
                                    </button>
                                </div>
                                {!form.isLiving && (
                                    <div className="grid grid-cols-2 gap-3">
                                        <EditField label="Năm mất" value={form.deathYear?.toString() || ''} onChange={v => setField('deathYear', v ? parseInt(v) || null : null)} type="number" />
                                        <EditField label="Ngày mất" value={form.deathDate || ''} onChange={v => setField('deathDate', v)} placeholder="VD: 01/12/2020" />
                                    </div>
                                )}
                                {!form.isLiving && (
                                    <EditField label="Nơi mất" value={form.deathPlace || ''} onChange={v => setField('deathPlace', v)} />
                                )}
                            </div>
                        </DetailSection>

                        {/* Liên hệ */}
                        <DetailSection icon={<Phone className="w-4 h-4" />} title="Liên hệ">
                            <div className="space-y-3">
                                <EditField label="Điện thoại" value={form.phone || ''} onChange={v => setField('phone', v)} placeholder="0912345678" />
                                <EditField label="Email" value={form.email || ''} onChange={v => setField('email', v)} placeholder="email@example.com" />
                                <EditField label="Zalo" value={form.zalo || ''} onChange={v => setField('zalo', v)} placeholder="Số Zalo" />
                                <EditField label="Facebook" value={form.facebook || ''} onChange={v => setField('facebook', v)} placeholder="Link Facebook" />
                            </div>
                        </DetailSection>

                        {/* Địa chỉ */}
                        <DetailSection icon={<MapPin className="w-4 h-4" />} title="Địa chỉ">
                            <div className="space-y-3">
                                <EditField label="Quê quán" value={form.hometown || ''} onChange={v => setField('hometown', v)} />
                                <EditField label="Nơi ở hiện tại" value={form.currentAddress || ''} onChange={v => setField('currentAddress', v)} />
                            </div>
                        </DetailSection>

                        {/* Nghề nghiệp & Học vấn */}
                        <DetailSection icon={<Briefcase className="w-4 h-4" />} title="Nghề nghiệp & Học vấn">
                            <div className="space-y-3">
                                <EditField label="Nghề nghiệp" value={form.occupation || ''} onChange={v => setField('occupation', v)} placeholder="VD: Giáo viên, Kỹ sư..." />
                                <EditField label="Nơi công tác" value={form.company || ''} onChange={v => setField('company', v)} placeholder="VD: Công ty ABC, Trường XYZ..." />
                                <EditField label="Học vấn" value={form.education || ''} onChange={v => setField('education', v)} placeholder="VD: Đại học Bách khoa, Cử nhân..." />
                            </div>
                        </DetailSection>

                        {/* Ghi chú */}
                        <DetailSection icon={<StickyNote className="w-4 h-4" />} title="Ghi chú">
                            <textarea
                                className="w-full border border-slate-200 dark:border-slate-600 rounded-lg px-3 py-2 text-sm bg-white dark:bg-slate-800 text-slate-700 dark:text-slate-200 resize-y min-h-[80px] focus:outline-none focus:ring-2 focus:ring-blue-400"
                                rows={3}
                                value={form.notes || ''}
                                onChange={e => setField('notes', e.target.value)}
                                placeholder="Ghi chú thêm về người này..."
                            />
                        </DetailSection>

                        {/* Save/Cancel */}
                        <div className="flex gap-2 sticky bottom-0 bg-white dark:bg-slate-900 py-3 border-t border-slate-100 dark:border-slate-700 -mx-5 px-5">
                            <button
                                onClick={handleSave}
                                disabled={saving}
                                className="flex-1 px-4 py-2.5 rounded-lg bg-blue-600 hover:bg-blue-700 text-white text-sm font-semibold flex items-center justify-center gap-2 disabled:opacity-50 transition-colors"
                            >
                                {saving ? <><div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" /> Đang lưu...</> : <><Save className="w-4 h-4" /> Lưu thay đổi</>}
                            </button>
                            <button
                                onClick={() => { setEditing(false); setSaveMsg(null); }}
                                className="px-4 py-2.5 rounded-lg border border-slate-200 dark:border-slate-600 text-slate-600 dark:text-slate-300 text-sm font-medium hover:bg-slate-50 dark:hover:bg-slate-800 transition-colors"
                            >
                                Hủy
                            </button>
                        </div>
                    </div>
                ) : detail ? (
                    /* ═══ VIEW MODE ═══ */
                    <div className="p-5 space-y-5">
                        {saveMsg && (
                            <div className={`rounded-lg px-3 py-2 text-sm font-medium ${saveMsg.type === 'ok' ? 'bg-green-50 text-green-700 dark:bg-green-900/30 dark:text-green-400' : 'bg-red-50 text-red-700 dark:bg-red-900/30 dark:text-red-400'}`}>
                                {saveMsg.text}
                            </div>
                        )}

                        {/* Thông tin cá nhân */}
                        <DetailSection icon={<User className="w-4 h-4" />} title="Thông tin cá nhân">
                            <div className="grid grid-cols-2 gap-3">
                                {detail.birthYear && (
                                    <DetailInfo label="Năm sinh" value={`${detail.birthDate || detail.birthYear}`} />
                                )}
                                {detail.birthYear && (
                                    <DetailInfo label="Năm âm lịch" value={zodiacYear(detail.birthYear) || '—'} />
                                )}
                                {detail.birthPlace && (
                                    <DetailInfo label="Nơi sinh" value={detail.birthPlace} />
                                )}
                                {!detail.isLiving && detail.deathYear && (
                                    <DetailInfo label="Năm mất" value={`${detail.deathDate || detail.deathYear}`} />
                                )}
                                {!detail.isLiving && detail.deathPlace && (
                                    <DetailInfo label="Nơi mất" value={detail.deathPlace} />
                                )}
                                {detail.nickName && (
                                    <DetailInfo label="Tên thường gọi" value={detail.nickName} />
                                )}
                            </div>
                        </DetailSection>

                        {/* Liên hệ */}
                        {(detail.phone || detail.email || detail.zalo || detail.facebook) && (
                            <DetailSection icon={<Phone className="w-4 h-4" />} title="Liên hệ">
                                <div className="space-y-2">
                                    {detail.phone && <DetailInfo label="Điện thoại" value={detail.phone} icon={<Phone className="w-3.5 h-3.5" />} />}
                                    {detail.email && <DetailInfo label="Email" value={detail.email} icon={<Mail className="w-3.5 h-3.5" />} />}
                                    {detail.zalo && <DetailInfo label="Zalo" value={detail.zalo} />}
                                    {detail.facebook && <DetailInfo label="Facebook" value={detail.facebook} />}
                                </div>
                            </DetailSection>
                        )}

                        {/* Địa chỉ */}
                        {(detail.currentAddress || detail.hometown) && (
                            <DetailSection icon={<MapPin className="w-4 h-4" />} title="Địa chỉ">
                                <div className="space-y-2">
                                    {detail.hometown && <DetailInfo label="Quê quán" value={detail.hometown} />}
                                    {detail.currentAddress && <DetailInfo label="Nơi ở hiện tại" value={detail.currentAddress} />}
                                </div>
                            </DetailSection>
                        )}

                        {/* Nghề nghiệp & Học vấn */}
                        {(detail.occupation || detail.company || detail.education) && (
                            <DetailSection icon={<Briefcase className="w-4 h-4" />} title="Nghề nghiệp & Học vấn">
                                <div className="space-y-2">
                                    {detail.occupation && <DetailInfo label="Nghề nghiệp" value={detail.occupation} icon={<Briefcase className="w-3.5 h-3.5" />} />}
                                    {detail.company && <DetailInfo label="Nơi công tác" value={detail.company} />}
                                    {detail.education && <DetailInfo label="Học vấn" value={detail.education} icon={<GraduationCap className="w-3.5 h-3.5" />} />}
                                </div>
                            </DetailSection>
                        )}

                        {/* Ghi chú */}
                        {detail.notes && (
                            <DetailSection icon={<StickyNote className="w-4 h-4" />} title="Ghi chú">
                                <p className="text-sm text-slate-600 dark:text-slate-300 leading-relaxed whitespace-pre-wrap">{detail.notes}</p>
                            </DetailSection>
                        )}

                        {/* Quan hệ gia đình (only with treeData) */}
                        {treeData && (
                            <DetailSection icon={<Users className="w-4 h-4" />} title="Quan hệ gia đình">
                                {parents.length > 0 && (
                                    <div className="mb-3">
                                        <p className="text-xs font-semibold text-slate-400 dark:text-slate-500 uppercase tracking-wide mb-1.5">Cha mẹ</p>
                                        <div className="space-y-1">
                                            {parents.map(({ label, person: p }) => (
                                                <RelationChip key={p.handle} label={label} person={p} onClick={() => onNavigate?.(p.handle)} />
                                            ))}
                                        </div>
                                    </div>
                                )}
                                {spousesAndChildren.map(({ spouse, children }, idx) => (
                                    <div key={idx} className="mb-3">
                                        {spouse && (
                                            <>
                                                <p className="text-xs font-semibold text-slate-400 dark:text-slate-500 uppercase tracking-wide mb-1.5">
                                                    {spouse.gender === 2 ? 'Vợ' : 'Chồng'}
                                                </p>
                                                <RelationChip label={spouse.gender === 2 ? 'Vợ' : 'Chồng'} person={spouse} onClick={() => onNavigate?.(spouse.handle)} />
                                            </>
                                        )}
                                        {children.length > 0 && (
                                            <>
                                                <p className="text-xs font-semibold text-slate-400 dark:text-slate-500 uppercase tracking-wide mb-1.5 mt-2">
                                                    Con ({children.length})
                                                </p>
                                                <div className="space-y-1">
                                                    {children.map(ch => (
                                                        <RelationChip key={ch.handle} label={ch.gender === 1 ? 'Con trai' : 'Con gái'} person={ch} onClick={() => onNavigate?.(ch.handle)} />
                                                    ))}
                                                </div>
                                            </>
                                        )}
                                    </div>
                                ))}
                                {siblings.length > 0 && (
                                    <div className="mb-3">
                                        <p className="text-xs font-semibold text-slate-400 dark:text-slate-500 uppercase tracking-wide mb-1.5">Anh chị em ({siblings.length})</p>
                                        <div className="space-y-1">
                                            {siblings.map(sib => (
                                                <RelationChip key={sib.handle} label={sib.gender === 1 ? 'Anh/Em trai' : 'Chị/Em gái'} person={sib} onClick={() => onNavigate?.(sib.handle)} />
                                            ))}
                                        </div>
                                    </div>
                                )}
                                {!hasRelations && (
                                    <p className="text-sm text-slate-400 italic">Chưa có thông tin quan hệ</p>
                                )}
                            </DetailSection>
                        )}

                        {/* Edit button at bottom for admin/editor */}
                        {canEdit && (
                            <button onClick={startEditing}
                                className="w-full py-2.5 rounded-lg border-2 border-dashed border-blue-200 dark:border-blue-700 text-blue-600 dark:text-blue-400 text-sm font-medium hover:bg-blue-50 dark:hover:bg-blue-900/20 flex items-center justify-center gap-2 transition-colors">
                                <Pencil className="w-4 h-4" /> Chỉnh sửa thông tin
                            </button>
                        )}
                    </div>
                ) : (
                    <div className="flex flex-col items-center justify-center py-20 text-slate-400">
                        <User className="w-10 h-10 mb-2 opacity-40" />
                        <p className="text-sm">Không tìm thấy thông tin</p>
                    </div>
                )}
            </div>
        </div>
    );
}

// ═══ Helper components ═══

function EditField({ label, value, onChange, type, placeholder }: {
    label: string; value: string; onChange: (v: string) => void; type?: string; placeholder?: string;
}) {
    return (
        <div>
            <label className="text-[11px] font-medium text-slate-400 dark:text-slate-500 block mb-1">{label}</label>
            <input
                type={type || 'text'}
                value={value}
                onChange={e => onChange(e.target.value)}
                placeholder={placeholder || label}
                className="w-full border border-slate-200 dark:border-slate-600 rounded-lg px-3 py-1.5 text-sm bg-white dark:bg-slate-800 text-slate-700 dark:text-slate-200 focus:outline-none focus:ring-2 focus:ring-blue-400 placeholder:text-slate-300 dark:placeholder:text-slate-600"
            />
        </div>
    );
}

function DetailSection({ icon, title, children }: { icon: React.ReactNode; title: string; children: React.ReactNode }) {
    return (
        <div className="bg-slate-50 dark:bg-slate-800/50 rounded-xl p-4 border border-slate-100 dark:border-slate-700/50">
            <h3 className="text-sm font-semibold text-slate-700 dark:text-slate-200 flex items-center gap-2 mb-3">
                <span className="text-slate-400 dark:text-slate-500">{icon}</span>
                {title}
            </h3>
            {children}
        </div>
    );
}

function DetailInfo({ label, value, icon }: { label: string; value: string; icon?: React.ReactNode }) {
    return (
        <div className="flex items-start gap-2">
            {icon && <span className="text-slate-400 dark:text-slate-500 mt-0.5 shrink-0">{icon}</span>}
            <div className="min-w-0">
                <p className="text-[11px] font-medium text-slate-400 dark:text-slate-500">{label}</p>
                <p className="text-sm text-slate-700 dark:text-slate-200 break-words">{value}</p>
            </div>
        </div>
    );
}

function RelationChip({ label, person, onClick }: { label: string; person: SimpleTreeNode; onClick: () => void }) {
    const isM = person.gender === 1;
    return (
        <button
            className={`w-full text-left px-3 py-2 rounded-lg flex items-center gap-2.5 transition-all
                ${isM
                    ? 'bg-blue-50 hover:bg-blue-100 dark:bg-blue-950/30 dark:hover:bg-blue-900/40 border border-blue-100 dark:border-blue-800/40'
                    : 'bg-pink-50 hover:bg-pink-100 dark:bg-pink-950/30 dark:hover:bg-pink-900/40 border border-pink-100 dark:border-pink-800/40'
                }`}
            onClick={onClick}
        >
            <div className={`w-7 h-7 rounded-full flex items-center justify-center text-xs font-bold shrink-0
                ${isM ? 'bg-blue-200 text-blue-700 dark:bg-blue-800 dark:text-blue-300' : 'bg-pink-200 text-pink-700 dark:bg-pink-800 dark:text-pink-300'}`}>
                {person.displayName.split(' ').pop()?.[0] || '?'}
            </div>
            <div className="min-w-0 flex-1">
                <p className="text-sm font-medium text-slate-800 dark:text-slate-200 truncate">{person.displayName}</p>
                <div className="flex items-center gap-1.5 text-[10px] text-slate-500 dark:text-slate-400">
                    <span className="font-medium">{label}</span>
                    <span>·</span>
                    <span>Đời {person.generation}</span>
                    {person.birthYear && <><span>·</span><span>{person.birthYear}{person.deathYear ? `—${person.deathYear}` : ''}</span></>}
                </div>
            </div>
            <ChevronRight className="w-4 h-4 text-slate-300 dark:text-slate-600 shrink-0" />
        </button>
    );
}
