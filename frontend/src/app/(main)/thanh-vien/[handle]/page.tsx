'use client';

import { useEffect, useState, useCallback } from 'react';
import { useParams, useRouter } from 'next/navigation';
import Link from 'next/link';
import {
    ArrowLeft, User, Phone, MapPin, Briefcase,
    Pencil, Save, X, Copy, Check, Users, Calendar, Droplets,
    StickyNote, ChevronRight, ScrollText, Camera, Plus,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { zodiacYear } from '@/lib/genealogy-types';
import type { PersonDetail } from '@/lib/genealogy-types';
import { useAuth } from '@/components/auth-provider';
import {
    fetchPersonDetail,
    updatePerson as supaUpdatePerson,
    type PersonEditFields,
} from '@/lib/supabase-data';
import { lunarToSolar, solarToLunar, isValidDDMM } from '@/lib/lunar-utils';
import { fetchPhotosByPerson, getPhotoThumbUrl, type Photo } from '@/lib/media-data';
import { PhotoUploadDialog } from '@/components/media/photo-upload-dialog';
import { PhotoLightbox } from '@/components/media/photo-lightbox';

/* ─── Types for family relationship display ─── */
interface FamilyMember {
    id: string;
    displayName: string;
    gender: number;
    birthYear?: number;
    deathYear?: number;
    isLiving: boolean;
    generation: number;
}

interface FamilyUnit {
    spouse?: FamilyMember;
    children: FamilyMember[];
}

/* ─── Helper: format date display ─── */
function formatDateDisplay(dateStr?: string, year?: number): string {
    if (dateStr) {
        const parts = dateStr.split('/');
        if (parts.length === 3) return `${parts[0]}/${parts[1]}/${parts[2]}`;
        if (parts.length === 2) return `${parts[0]}/${parts[1]}${year ? `/${year}` : ''}`;
        return dateStr;
    }
    return year ? `${year}` : '—';
}

/* ─── Helper: format death date ─── */
// VD: "8/5/2022 (tức 8/4 năm Nhâm Dần)"
function formatDeathDateDisplay(
    deathDateSolar?: string,
    deathDate?: string,
    deathYear?: number,
): string {
    const zodiac = deathYear ? zodiacYear(deathYear) : undefined;
    let solarPart = '';
    if (deathDateSolar) {
        const parts = deathDateSolar.split('/');
        if (parts.length === 2 && deathYear) solarPart = `${parts[0]}/${parts[1]}/${deathYear}`;
        else solarPart = deathDateSolar;
    } else if (deathYear) {
        solarPart = `${deathYear}`;
    }
    const lunarParts: string[] = [];
    if (deathDate) lunarParts.push(deathDate);
    if (zodiac) lunarParts.push(`năm ${zodiac}`);
    const lunarSuffix = lunarParts.length > 0 ? ` (tức ${lunarParts.join(' ')})` : '';
    return solarPart ? `${solarPart}${lunarSuffix}` : (deathYear ? `${deathYear}` : '—');
}

function maritalStatusLabel(status?: string): string {
    if (!status) return '';
    const labels: Record<string, string> = {
        single: 'Độc thân', married: 'Đã kết hôn', divorced: 'Đã ly hôn', widowed: 'Góa',
    };
    return labels[status] || status;
}

export default function PersonProfilePage() {
    const params = useParams();
    const router = useRouter();
    const handle = params.handle as string;
    const [person, setPerson] = useState<PersonDetail | null>(null);
    const [loading, setLoading] = useState(true);
    const [editing, setEditing] = useState(false);
    const [saving, setSaving] = useState(false);
    const [saveMsg, setSaveMsg] = useState<{ type: 'ok' | 'err'; text: string } | null>(null);
    const [form, setForm] = useState<PersonEditFields>({});
    const [copied, setCopied] = useState(false);
    const { canEdit } = useAuth();

    // Family data
    const [parents, setParents] = useState<FamilyMember[]>([]);
    const [familyUnits, setFamilyUnits] = useState<FamilyUnit[]>([]);
    const [siblings, setSiblings] = useState<FamilyMember[]>([]);

    // Photo gallery
    const [personPhotos, setPersonPhotos] = useState<Photo[]>([]);
    const [lightboxIdx, setLightboxIdx] = useState<number | null>(null);

    const loadPhotos = useCallback(() => {
        fetchPhotosByPerson(handle).then(setPersonPhotos);
    }, [handle]);

    useEffect(() => {
        const fetchAll = async () => {
            setLoading(true);
            try {
                const detail = await fetchPersonDetail(handle);
                if (detail) {
                    setPerson(detail);
                    // Fetch family relationships
                    await fetchFamilyData(detail);
                }
            } catch { /* ignore */ }
            setLoading(false);
        };
        fetchAll();
        loadPhotos();
    }, [handle, loadPhotos]);

    const fetchFamilyData = async (detail: PersonDetail) => {
        try {
            const { supabase } = await import('@/lib/supabase');

            // Fetch families where this person is a child
            const parentFamIds = detail.parentFamilyIds || [];
            const ownFamIds = detail.familyIds || [];

            const allFamIds = [...new Set([...parentFamIds, ...ownFamIds])];
            if (allFamIds.length === 0) return;

            const { data: families } = await supabase
                .from('families')
                .select('*')
                .in('id', allFamIds);

            if (!families || families.length === 0) return;

            // Collect all person IDs we need
            const personIds = new Set<string>();
            for (const fam of families) {
                if (fam.father_id) personIds.add(fam.father_id);
                if (fam.mother_id) personIds.add(fam.mother_id);
                const childIds = (fam.child_ids || []) as string[];
                childIds.forEach((id: string) => personIds.add(id));
            }
            personIds.delete(detail.id);

            if (personIds.size === 0) return;

            const { data: relatedPeople } = await supabase
                .from('people_safe')
                .select('id, display_name, gender, birth_year, death_year, is_living, generation')
                .in('id', Array.from(personIds));

            if (!relatedPeople) return;

            const peopleMap = new Map<string, FamilyMember>();
            for (const p of relatedPeople) {
                peopleMap.set(p.id, {
                    id: p.id,
                    displayName: p.display_name,
                    gender: p.gender,
                    birthYear: p.birth_year,
                    deathYear: p.death_year,
                    isLiving: p.is_living,
                    generation: p.generation,
                });
            }

            // Parents
            const parentList: FamilyMember[] = [];
            const siblingList: FamilyMember[] = [];
            const siblingSeen = new Set<string>();

            for (const famId of parentFamIds) {
                const fam = families.find((f: Record<string, unknown>) => f.id === famId);
                if (!fam) continue;
                if (fam.father_id && peopleMap.has(fam.father_id)) {
                    const p = peopleMap.get(fam.father_id)!;
                    if (!parentList.some(x => x.id === p.id)) parentList.push(p);
                }
                if (fam.mother_id && peopleMap.has(fam.mother_id)) {
                    const p = peopleMap.get(fam.mother_id)!;
                    if (!parentList.some(x => x.id === p.id)) parentList.push(p);
                }
                // Siblings
                const childIds = (fam.child_ids || []) as string[];
                for (const chId of childIds) {
                    if (chId !== detail.id && !siblingSeen.has(chId) && peopleMap.has(chId)) {
                        siblingSeen.add(chId);
                        siblingList.push(peopleMap.get(chId)!);
                    }
                }
            }
            setParents(parentList);
            setSiblings(siblingList);

            // Spouse + children families
            const units: FamilyUnit[] = [];
            for (const famId of ownFamIds) {
                const fam = families.find((f: Record<string, unknown>) => f.id === famId);
                if (!fam) continue;
                const spouseId = fam.father_id === detail.id ? fam.mother_id : fam.father_id;
                const spouse = spouseId && peopleMap.has(spouseId) ? peopleMap.get(spouseId) : undefined;
                const childIds = (fam.child_ids || []) as string[];
                const children = childIds.map((id: string) => peopleMap.get(id)).filter(Boolean) as FamilyMember[];
                units.push({ spouse, children });
            }
            setFamilyUnits(units);
        } catch (err) {
            console.error('Error fetching family data:', err);
        }
    };

    const startEditing = useCallback(() => {
        if (!person) return;
        setForm({
            displayName: person.displayName || '',
            nickName: person.nickName || '',
            title: person.title || '',
            birthYear: person.birthYear ?? null,
            birthDate: person.birthDate || '',
            birthPlace: person.birthPlace || '',
            deathYear: person.deathYear ?? null,
            deathDate: person.deathDate || '',
            deathDateSolar: person.deathDateSolar || '',
            deathPlace: person.deathPlace || '',
            isLiving: person.isLiving,
            phone: person.phone || '',
            email: person.email || '',
            zalo: person.zalo || '',
            facebook: person.facebook || '',
            currentAddress: person.currentAddress || '',
            hometown: person.hometown || '',
            occupation: person.occupation || '',
            company: person.company || '',
            education: person.education || '',
            notes: person.notes || '',
            birthOrder: person.birthOrder ?? null,
            maritalStatus: person.maritalStatus || '',
            bloodType: person.bloodType || '',
        });
        setEditing(true);
        setSaveMsg(null);
    }, [person]);

    const handleSave = useCallback(async () => {
        if (!person) return;
        setSaving(true);
        setSaveMsg(null);
        const cleaned: PersonEditFields = {};
        for (const [k, v] of Object.entries(form)) {
            if (v === '' || v === undefined) (cleaned as Record<string, unknown>)[k] = null;
            else (cleaned as Record<string, unknown>)[k] = v;
        }
        const { error } = await supaUpdatePerson(person.id, cleaned);
        if (error) {
            setSaveMsg({ type: 'err', text: `Lỗi: ${error}` });
        } else {
            setSaveMsg({ type: 'ok', text: 'Đã lưu thành công!' });
            const update: Partial<PersonDetail> = {};
            for (const [k, v] of Object.entries(cleaned)) {
                (update as Record<string, unknown>)[k] = v === null ? undefined : v;
            }
            if (!update.displayName) update.displayName = person.displayName;
            setPerson(prev => prev ? { ...prev, ...update } as PersonDetail : prev);
            setTimeout(() => setEditing(false), 600);
        }
        setSaving(false);
    }, [person, form]);

    const setField = useCallback(<K extends keyof PersonEditFields>(key: K, value: PersonEditFields[K]) => {
        setForm(prev => ({ ...prev, [key]: value }));
    }, []);

    const handleCopyLink = useCallback(() => {
        navigator.clipboard.writeText(window.location.href);
        setCopied(true);
        setTimeout(() => setCopied(false), 2000);
    }, []);

    if (loading) {
        return (
            <div className="flex items-center justify-center h-96">
                <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary" />
            </div>
        );
    }

    if (!person) {
        return (
            <div className="text-center py-20">
                <p className="text-muted-foreground">Không tìm thấy người này</p>
                <Button variant="outline" className="mt-4" onClick={() => router.back()}>
                    <ArrowLeft className="mr-2 h-4 w-4" />
                    Quay lại
                </Button>
            </div>
        );
    }

    const genderLabel = person.gender === 1 ? 'Nam' : person.gender === 2 ? 'Nữ' : 'Không rõ';
    const isMale = person.gender === 1;
    const themeColor = isMale ? 'blue' : 'pink';

    return (
        <div className="max-w-5xl mx-auto pb-10">
            {/* Back button */}
            <Button variant="ghost" size="sm" onClick={() => router.back()} className="mb-3 gap-1.5 text-muted-foreground hover:text-foreground">
                <ArrowLeft className="h-4 w-4" /> Quay lại
            </Button>

            {/* ═══ Two-Column Layout ═══ */}
            <div className="flex flex-col lg:flex-row gap-6">

                {/* ── Left Column: Photo & Identity ── */}
                <div className="w-full lg:w-80 shrink-0 space-y-4">
                    {/* Profile Photo Card */}
                    <div className={`rounded-2xl overflow-hidden border ${isMale ? 'border-blue-200 dark:border-blue-800' : 'border-pink-200 dark:border-pink-800'} bg-white dark:bg-slate-900`}>
                        {/* Main avatar / photo */}
                        <div className={`relative aspect-[3/4] bg-gradient-to-b ${isMale ? 'from-blue-100 to-blue-50 dark:from-blue-950 dark:to-slate-900' : 'from-pink-100 to-pink-50 dark:from-pink-950 dark:to-slate-900'}`}>
                            {personPhotos.length > 0 ? (
                                <img
                                    src={getPhotoThumbUrl(personPhotos[0], 400)}
                                    alt={person.displayName}
                                    className="w-full h-full object-cover cursor-pointer hover:opacity-90 transition-opacity"
                                    onClick={() => setLightboxIdx(0)}
                                />
                            ) : (
                                <div className="w-full h-full flex flex-col items-center justify-center">
                                    <div className={`w-24 h-24 rounded-full flex items-center justify-center text-4xl font-bold shadow-lg
                                        ${isMale ? 'bg-blue-200 text-blue-700 dark:bg-blue-800 dark:text-blue-300' : 'bg-pink-200 text-pink-700 dark:bg-pink-800 dark:text-pink-300'}`}>
                                        {person.displayName.split(' ').pop()?.[0] || '?'}
                                    </div>
                                    <p className="text-xs text-muted-foreground mt-3">Chưa có ảnh đại diện</p>
                                </div>
                            )}
                            {/* Status badge overlay */}
                            <div className="absolute top-2 right-2">
                                {person.isLiving ? (
                                    <span className="text-[10px] font-semibold bg-emerald-500 text-white px-2 py-0.5 rounded-full shadow">Còn sống</span>
                                ) : (
                                    <span className="text-[10px] font-semibold bg-slate-500 text-white px-2 py-0.5 rounded-full shadow">Đã mất</span>
                                )}
                            </div>
                        </div>

                        {/* Name + badges below photo */}
                        <div className="px-4 py-3 text-center">
                            <h1 className="text-lg font-bold text-slate-800 dark:text-slate-100">
                                {person.displayName}
                            </h1>
                            {person.nickName && (
                                <p className="text-xs text-muted-foreground mt-0.5">({person.nickName})</p>
                            )}
                            <div className="flex items-center justify-center gap-1.5 mt-2 flex-wrap">
                                <Badge variant="outline" className={`text-[10px] font-semibold ${isMale ? 'border-blue-300 text-blue-700 bg-blue-50 dark:border-blue-700 dark:text-blue-300 dark:bg-blue-950' : 'border-pink-300 text-pink-700 bg-pink-50 dark:border-pink-700 dark:text-pink-300 dark:bg-pink-950'}`}>
                                    {genderLabel}
                                </Badge>
                                {person.generation && (
                                    <Badge variant="outline" className="text-[10px] font-semibold border-amber-300 text-amber-700 bg-amber-50 dark:border-amber-700 dark:text-amber-300 dark:bg-amber-950">
                                        Đời {person.generation}
                                    </Badge>
                                )}
                                {person.title && (
                                    <Badge variant="outline" className="text-[10px] font-semibold border-purple-300 text-purple-700 bg-purple-50 dark:border-purple-700 dark:text-purple-300 dark:bg-purple-950">
                                        {person.title}
                                    </Badge>
                                )}
                            </div>

                            {/* Actions */}
                            <div className="flex items-center justify-center gap-1.5 mt-3">
                                <Button variant="outline" size="sm" onClick={handleCopyLink} className="gap-1 h-7 text-[10px] px-2">
                                    {copied ? <Check className="h-3 w-3 text-green-500" /> : <Copy className="h-3 w-3" />}
                                    {copied ? 'Đã sao chép' : 'Copy link'}
                                </Button>
                                {canEdit && !editing && (
                                    <Button variant="outline" size="sm" onClick={startEditing} className="gap-1 h-7 text-[10px] px-2">
                                        <Pencil className="h-3 w-3" /> Sửa
                                    </Button>
                                )}
                            </div>
                        </div>
                    </div>

                    {/* Photo Gallery Card */}
                    <div className="rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 overflow-hidden">
                        <div className="px-4 py-2.5 border-b border-slate-100 dark:border-slate-800 bg-slate-50/50 dark:bg-slate-800/30 flex items-center justify-between">
                            <h3 className="text-sm font-semibold flex items-center gap-2 text-slate-700 dark:text-slate-200">
                                <Camera className="h-4 w-4 text-muted-foreground" />
                                Ảnh ({personPhotos.length})
                            </h3>
                            {canEdit && (
                                <PhotoUploadDialog
                                    albums={[]}
                                    personId={handle}
                                    onUploaded={loadPhotos}
                                    trigger={
                                        <button className="text-[10px] font-medium text-primary hover:underline flex items-center gap-0.5">
                                            <Plus className="h-3 w-3" /> Thêm
                                        </button>
                                    }
                                />
                            )}
                        </div>
                        <div className="p-3">
                            {personPhotos.length > 0 ? (
                                <div className="grid grid-cols-3 gap-1.5">
                                    {personPhotos.map((photo, idx) => (
                                        <button
                                            key={photo.id}
                                            className="aspect-square rounded-md overflow-hidden bg-muted hover:opacity-80 transition-opacity focus:outline-none focus:ring-2 focus:ring-primary"
                                            onClick={() => setLightboxIdx(idx)}
                                        >
                                            <img
                                                src={getPhotoThumbUrl(photo, 160)}
                                                alt={photo.title || photo.file_name}
                                                className="w-full h-full object-cover"
                                                loading="lazy"
                                            />
                                        </button>
                                    ))}
                                </div>
                            ) : (
                                <div className="text-center py-4">
                                    <Camera className="h-6 w-6 mx-auto text-muted-foreground/30 mb-1.5" />
                                    <p className="text-xs text-muted-foreground">Chưa có ảnh</p>
                                    {canEdit && (
                                        <PhotoUploadDialog
                                            albums={[]}
                                            personId={handle}
                                            onUploaded={loadPhotos}
                                            trigger={
                                                <Button variant="outline" size="sm" className="gap-1 mt-2 h-7 text-[10px]">
                                                    <Plus className="h-3 w-3" /> Tải ảnh lên
                                                </Button>
                                            }
                                        />
                                    )}
                                </div>
                            )}
                        </div>
                    </div>

                    {/* Gia đình sidebar — tạm ẩn vì trùng với "Quan hệ gia đình" ở cột phải */}
                </div>

                {/* ── Right Column: Info Sections ── */}
                <div className="flex-1 min-w-0">
                    {/* Save message */}
                    {saveMsg && (
                        <div className={`rounded-lg px-4 py-2.5 text-sm font-medium mb-4 ${saveMsg.type === 'ok' ? 'bg-green-50 text-green-700 dark:bg-green-900/30 dark:text-green-400' : 'bg-red-50 text-red-700 dark:bg-red-900/30 dark:text-red-400'}`}>
                            {saveMsg.text}
                        </div>
                    )}

                    {/* Edit mode save/cancel bar */}
                    {editing && (
                        <div className="flex gap-2 mb-4">
                            <Button size="sm" onClick={handleSave} disabled={saving} className="gap-1.5">
                                {saving ? <div className="w-3.5 h-3.5 border-2 border-white/30 border-t-white rounded-full animate-spin" /> : <Save className="h-3.5 w-3.5" />}
                                {saving ? 'Đang lưu...' : 'Lưu thay đổi'}
                            </Button>
                            <Button variant="outline" size="sm" onClick={() => { setEditing(false); setSaveMsg(null); }} className="gap-1.5">
                                <X className="h-3.5 w-3.5" /> Hủy
                            </Button>
                        </div>
                    )}

                    {/* ═══ Content ═══ */}
                    {editing ? (
                        /* ── Edit Mode ── */
                        <div className="space-y-4">
                            <SectionCard icon={<User className="h-4 w-4" />} title="Thông tin cơ bản">
                                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                                    <EditRow label="Họ tên" value={form.displayName || ''} onChange={v => setField('displayName', v)} />
                                    <EditRow label="Tên thường gọi" value={form.nickName || ''} onChange={v => setField('nickName', v)} placeholder="Biệt danh" />
                                    <EditRow label="Chức danh" value={form.title || ''} onChange={v => setField('title', v)} placeholder="Trưởng tộc..." />
                                    <EditRow label="Thứ tự (con thứ)" value={form.birthOrder?.toString() || ''} onChange={v => setField('birthOrder', v ? parseInt(v) || null : null)} type="number" />
                                </div>
                            </SectionCard>

                            <SectionCard icon={<Calendar className="h-4 w-4" />} title="Ngày tháng">
                                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                                    <EditRow label="Năm sinh" value={form.birthYear?.toString() || ''} onChange={v => setField('birthYear', v ? parseInt(v) || null : null)} type="number" />
                                    <EditRow label="Ngày sinh (DD/MM)" value={form.birthDate || ''} onChange={v => setField('birthDate', v)} placeholder="15/03" />
                                    <EditRow label="Nơi sinh" value={form.birthPlace || ''} onChange={v => setField('birthPlace', v)} />
                                    <div className="flex items-center gap-3">
                                        <p className="text-xs font-medium text-muted-foreground">Trạng thái</p>
                                        <Button
                                            type="button" variant="outline" size="sm"
                                            onClick={() => setField('isLiving', !form.isLiving)}
                                            className={form.isLiving ? 'border-emerald-300 text-emerald-700' : 'border-slate-300 text-slate-500'}
                                        >
                                            {form.isLiving ? '● Còn sống' : '✝ Đã mất'}
                                        </Button>
                                    </div>
                                </div>
                                {!form.isLiving && (
                                    <div className="space-y-3 mt-3">
                                        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                                            <EditRow label="Năm mất" value={form.deathYear?.toString() || ''} onChange={v => setField('deathYear', v ? parseInt(v) || null : null)} type="number" />
                                            <EditRow label="Ngày mất DL (DD/MM)" value={form.deathDateSolar || ''} onChange={v => {
                                                setField('deathDateSolar', v);
                                                if (isValidDDMM(v) && form.deathYear) {
                                                    const lunar = solarToLunar(v, form.deathYear as number);
                                                    if (lunar) setField('deathDate', lunar);
                                                }
                                            }} placeholder="VD: 8/5" />
                                            <EditRow label="Ngày giỗ ÂL (DD/MM)" value={form.deathDate || ''} onChange={v => {
                                                setField('deathDate', v);
                                                if (isValidDDMM(v) && form.deathYear) {
                                                    const solar = lunarToSolar(v, form.deathYear as number);
                                                    if (solar) setField('deathDateSolar', solar);
                                                }
                                            }} placeholder="VD: 8/4" />
                                        </div>
                                        <p className="text-[10px] text-muted-foreground">DL = Dương lịch · ÂL = Âm lịch (ngày giỗ) · Nhập 1 ngày, ngày còn lại tự tính</p>
                                        <EditRow label="Nơi mất" value={form.deathPlace || ''} onChange={v => setField('deathPlace', v)} />
                                    </div>
                                )}
                            </SectionCard>

                            <SectionCard icon={<Phone className="h-4 w-4" />} title="Liên hệ">
                                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                                    <EditRow label="Điện thoại" value={form.phone || ''} onChange={v => setField('phone', v)} placeholder="0912345678" />
                                    <EditRow label="Email" value={form.email || ''} onChange={v => setField('email', v)} placeholder="email@example.com" />
                                    <EditRow label="Zalo" value={form.zalo || ''} onChange={v => setField('zalo', v)} placeholder="Số Zalo" />
                                    <EditRow label="Facebook" value={form.facebook || ''} onChange={v => setField('facebook', v)} placeholder="Link Facebook" />
                                </div>
                            </SectionCard>

                            <SectionCard icon={<MapPin className="h-4 w-4" />} title="Địa chỉ">
                                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                                    <EditRow label="Quê quán" value={form.hometown || ''} onChange={v => setField('hometown', v)} />
                                    <EditRow label="Nơi ở hiện tại" value={form.currentAddress || ''} onChange={v => setField('currentAddress', v)} />
                                </div>
                            </SectionCard>

                            <SectionCard icon={<Briefcase className="h-4 w-4" />} title="Nghề nghiệp & Học vấn">
                                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                                    <EditRow label="Nghề nghiệp" value={form.occupation || ''} onChange={v => setField('occupation', v)} placeholder="Giáo viên, Kỹ sư..." />
                                    <EditRow label="Nơi công tác" value={form.company || ''} onChange={v => setField('company', v)} placeholder="Công ty ABC..." />
                                    <EditRow label="Học vấn" value={form.education || ''} onChange={v => setField('education', v)} placeholder="Đại học Bách khoa..." />
                                </div>
                            </SectionCard>

                            <SectionCard icon={<Droplets className="h-4 w-4" />} title="Thông tin khác">
                                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                                    <EditRow label="Nhóm máu" value={form.bloodType || ''} onChange={v => setField('bloodType', v)} placeholder="A, B, AB, O" />
                                    <EditRow label="Tình trạng hôn nhân" value={form.maritalStatus || ''} onChange={v => setField('maritalStatus', v)} placeholder="married / single / divorced" />
                                </div>
                            </SectionCard>

                            <SectionCard icon={<StickyNote className="h-4 w-4" />} title="Ghi chú">
                                <textarea
                                    className="w-full border border-input rounded-md px-3 py-2 text-sm bg-background resize-y min-h-[80px] focus:outline-none focus:ring-2 focus:ring-ring"
                                    rows={3}
                                    value={form.notes || ''}
                                    onChange={e => setField('notes', e.target.value)}
                                    placeholder="Ghi chú thêm về người này..."
                                />
                            </SectionCard>
                        </div>
                    ) : (
                        /* ── View Mode ── */
                        <div className="space-y-4">
                            {/* Thông tin cá nhân */}
                            <SectionCard icon={<User className="h-4 w-4" />} title="Thông tin cá nhân">
                                <div className="grid grid-cols-2 gap-x-6 gap-y-3">
                                    <InfoField label="Giới tính" value={genderLabel} />
                                    {person.generation && <InfoField label="Đời thứ" value={`${person.generation}`} />}
                                    {person.birthOrder && <InfoField label="Thứ tự con" value={`Con thứ ${person.birthOrder}`} />}
                                    <InfoField label="Ngày sinh" value={formatDateDisplay(person.birthDate, person.birthYear)} />
                                    {person.birthYear && <InfoField label="Năm âm lịch (sinh)" value={zodiacYear(person.birthYear) || '—'} />}
                                    {person.birthPlace && <InfoField label="Nơi sinh" value={person.birthPlace} />}
                                    {!person.isLiving && (
                                        <>
                                            <InfoField label="Ngày mất" value={formatDeathDateDisplay(person.deathDateSolar, person.deathDate, person.deathYear)} />
                                            {person.deathDate && <InfoField label="Ngày Giỗ (ÂL)" value={`${person.deathDate}${person.deathYear ? ` (${zodiacYear(person.deathYear)})` : ''}`} />}
                                            {person.deathPlace && <InfoField label="Nơi mất" value={person.deathPlace} />}
                                        </>
                                    )}
                                    {person.maritalStatus && <InfoField label="Hôn nhân" value={maritalStatusLabel(person.maritalStatus)} />}
                                    {person.bloodType && <InfoField label="Nhóm máu" value={person.bloodType} />}
                                </div>
                            </SectionCard>

                            {/* Thông tin gia phả */}
                            {(person.tenHuy || person.hieu || person.tu || person.chiName || person.phanChi || person.nganh || person.phanNganh || person.nhanh || person.phanNhanh || person.chucVu || person.noiAnTang || person.tho) && (
                                <SectionCard icon={<ScrollText className="h-4 w-4" />} title="Thông tin gia phả">
                                    <div className="grid grid-cols-2 gap-x-6 gap-y-3">
                                        {person.tenHuy && <InfoField label="Tên húy" value={person.tenHuy} />}
                                        {person.hieu && <InfoField label="Tên hiệu" value={person.hieu} />}
                                        {person.tu && <InfoField label="Tự" value={person.tu} />}
                                        {person.chiName && <InfoField label="Chi" value={person.chiName} />}
                                        {person.phanChi && <InfoField label="Phân chi" value={person.phanChi} />}
                                        {person.nganh && <InfoField label="Ngành" value={person.nganh} />}
                                        {person.phanNganh && <InfoField label="Phân ngành" value={person.phanNganh} />}
                                        {person.nhanh && <InfoField label="Nhánh" value={person.nhanh} />}
                                        {person.phanNhanh && <InfoField label="Phân nhánh" value={person.phanNhanh} />}
                                        {person.chucVu && <InfoField label="Chức vụ" value={person.chucVu} />}
                                        {person.noiAnTang && <InfoField label="Nơi an táng" value={person.noiAnTang} />}
                                        {person.tho && <InfoField label="Thọ" value={person.tho} />}
                                    </div>
                                </SectionCard>
                            )}

                            {/* Liên hệ */}
                            {(person.phone || person.email || person.zalo || person.facebook) && (
                                <SectionCard icon={<Phone className="h-4 w-4" />} title="Liên hệ">
                                    <div className="grid grid-cols-2 gap-x-6 gap-y-3">
                                        {person.phone && <InfoField label="Điện thoại" value={person.phone} />}
                                        {person.email && <InfoField label="Email" value={person.email} />}
                                        {person.zalo && <InfoField label="Zalo" value={person.zalo} />}
                                        {person.facebook && <InfoField label="Facebook" value={person.facebook} />}
                                    </div>
                                </SectionCard>
                            )}

                            {/* Địa chỉ */}
                            {(person.hometown || person.currentAddress) && (
                                <SectionCard icon={<MapPin className="h-4 w-4" />} title="Địa chỉ">
                                    <div className="grid grid-cols-2 gap-x-6 gap-y-3">
                                        {person.hometown && <InfoField label="Quê quán" value={person.hometown} />}
                                        {person.currentAddress && <InfoField label="Nơi ở hiện tại" value={person.currentAddress} />}
                                    </div>
                                </SectionCard>
                            )}

                            {/* Nghề nghiệp & Học vấn */}
                            {(person.occupation || person.company || person.education) && (
                                <SectionCard icon={<Briefcase className="h-4 w-4" />} title="Nghề nghiệp & Học vấn">
                                    <div className="grid grid-cols-2 gap-x-6 gap-y-3">
                                        {person.occupation && <InfoField label="Nghề nghiệp" value={person.occupation} />}
                                        {person.company && <InfoField label="Nơi công tác" value={person.company} />}
                                        {person.education && <InfoField label="Học vấn" value={person.education} />}
                                    </div>
                                </SectionCard>
                            )}

                            {/* Ghi chú */}
                            {(person.notes || person.biography) && (
                                <SectionCard icon={<StickyNote className="h-4 w-4" />} title="Ghi chú">
                                    {person.biography && (
                                        <div className="mb-2">
                                            <p className="text-xs font-medium text-muted-foreground mb-1">Tiểu sử</p>
                                            <p className="text-sm leading-relaxed whitespace-pre-wrap">{person.biography}</p>
                                        </div>
                                    )}
                                    {person.notes && (
                                        <div>
                                            <p className="text-xs font-medium text-muted-foreground mb-1">Ghi chú</p>
                                            <p className="text-sm leading-relaxed text-muted-foreground whitespace-pre-wrap">{person.notes}</p>
                                        </div>
                                    )}
                                </SectionCard>
                            )}

                            {/* ═══ Quan hệ gia đình (full detail — right column) ═══ */}
                            <SectionCard icon={<Users className="h-4 w-4" />} title="Quan hệ gia đình">
                                {parents.length > 0 && (
                                    <div className="mb-4">
                                        <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide mb-2">Cha mẹ</p>
                                        <div className="space-y-1.5">
                                            {parents.map(p => (
                                                <PersonChip key={p.id} person={p} label={p.gender === 1 ? 'Cha' : 'Mẹ'} />
                                            ))}
                                        </div>
                                    </div>
                                )}

                                {familyUnits.map((unit, idx) => (
                                    <div key={idx} className="mb-4">
                                        {unit.spouse && (
                                            <>
                                                <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide mb-2">
                                                    {unit.spouse.gender === 2 ? 'Vợ' : 'Chồng'}
                                                </p>
                                                <PersonChip person={unit.spouse} label={unit.spouse.gender === 2 ? 'Vợ' : 'Chồng'} />
                                            </>
                                        )}
                                        {unit.children.length > 0 && (
                                            <div className="mt-2">
                                                <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide mb-2">
                                                    Con ({unit.children.length})
                                                </p>
                                                <div className="space-y-1.5">
                                                    {unit.children.map(ch => (
                                                        <PersonChip key={ch.id} person={ch} label={ch.gender === 1 ? 'Con trai' : 'Con gái'} />
                                                    ))}
                                                </div>
                                            </div>
                                        )}
                                    </div>
                                ))}

                                {siblings.length > 0 && (
                                    <div className="mb-4">
                                        <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide mb-2">Anh chị em ({siblings.length})</p>
                                        <div className="space-y-1.5">
                                            {siblings.map(s => (
                                                <PersonChip key={s.id} person={s} label={s.gender === 1 ? 'Anh/Em trai' : 'Chị/Em gái'} />
                                            ))}
                                        </div>
                                    </div>
                                )}

                                {parents.length === 0 && familyUnits.length === 0 && siblings.length === 0 && (
                                    <p className="text-sm text-muted-foreground italic">Chưa có thông tin quan hệ</p>
                                )}
                            </SectionCard>
                        </div>
                    )}
                </div>
            </div>

            {/* Photo Lightbox */}
            {lightboxIdx !== null && personPhotos.length > 0 && (
                <PhotoLightbox
                    photos={personPhotos}
                    initialIndex={lightboxIdx}
                    onClose={() => setLightboxIdx(null)}
                    onPhotoDeleted={loadPhotos}
                />
            )}
        </div>
    );
}

/* ═══ Reusable Components ═══ */

function SectionCard({ icon, title, children }: { icon: React.ReactNode; title: string; children: React.ReactNode }) {
    return (
        <div className="rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 overflow-hidden">
            <div className="px-4 py-3 border-b border-slate-100 dark:border-slate-800 bg-slate-50/50 dark:bg-slate-800/30">
                <h3 className="text-sm font-semibold flex items-center gap-2 text-slate-700 dark:text-slate-200">
                    <span className="text-muted-foreground">{icon}</span>
                    {title}
                </h3>
            </div>
            <div className="px-4 py-3">{children}</div>
        </div>
    );
}

function InfoField({ label, value }: { label: string; value: string }) {
    return (
        <div className="min-w-0">
            <p className="text-[11px] font-medium text-muted-foreground uppercase tracking-wider">{label}</p>
            <p className="text-sm text-foreground mt-0.5 break-words">{value}</p>
        </div>
    );
}

function EditRow({ label, value, onChange, type, placeholder }: {
    label: string; value: string; onChange: (v: string) => void; type?: string; placeholder?: string;
}) {
    return (
        <div>
            <p className="text-xs font-medium text-muted-foreground mb-1">{label}</p>
            <Input
                type={type || 'text'}
                value={value}
                onChange={e => onChange(e.target.value)}
                placeholder={placeholder || label}
                className="h-8 text-sm"
            />
        </div>
    );
}

function PersonChipCompact({ person, label }: { person: FamilyMember; label: string }) {
    const isMale = person.gender === 1;
    return (
        <Link
            href={`/thanh-vien/${person.id}`}
            className={`flex items-center gap-2 rounded-md px-2 py-1.5 transition-all border text-xs
                ${isMale
                    ? 'bg-blue-50/50 hover:bg-blue-100 dark:bg-blue-950/20 dark:hover:bg-blue-900/30 border-blue-100 dark:border-blue-800/40'
                    : 'bg-pink-50/50 hover:bg-pink-100 dark:bg-pink-950/20 dark:hover:bg-pink-900/30 border-pink-100 dark:border-pink-800/40'
                }`}
        >
            <div className={`w-5 h-5 text-[9px] rounded-full flex items-center justify-center font-bold shrink-0
                ${isMale ? 'bg-blue-200 text-blue-700 dark:bg-blue-800 dark:text-blue-300' : 'bg-pink-200 text-pink-700 dark:bg-pink-800 dark:text-pink-300'}`}>
                {person.displayName.split(' ').pop()?.[0] || '?'}
            </div>
            <div className="min-w-0 flex-1">
                <p className="text-[11px] font-medium text-slate-800 dark:text-slate-200 truncate">
                    {person.displayName}
                </p>
            </div>
            <span className="text-[9px] text-muted-foreground shrink-0">{label}</span>
        </Link>
    );
}

function PersonChip({ person, label, large }: { person: FamilyMember; label: string; large?: boolean }) {
    const isMale = person.gender === 1;
    return (
        <Link
            href={`/thanh-vien/${person.id}`}
            className={`flex items-center gap-2.5 rounded-lg px-3 transition-all border
                ${large ? 'py-3' : 'py-2'}
                ${isMale
                    ? 'bg-blue-50/50 hover:bg-blue-100 dark:bg-blue-950/20 dark:hover:bg-blue-900/30 border-blue-100 dark:border-blue-800/40'
                    : 'bg-pink-50/50 hover:bg-pink-100 dark:bg-pink-950/20 dark:hover:bg-pink-900/30 border-pink-100 dark:border-pink-800/40'
                }`}
        >
            <div className={`${large ? 'w-9 h-9 text-sm' : 'w-7 h-7 text-xs'} rounded-full flex items-center justify-center font-bold shrink-0
                ${isMale ? 'bg-blue-200 text-blue-700 dark:bg-blue-800 dark:text-blue-300' : 'bg-pink-200 text-pink-700 dark:bg-pink-800 dark:text-pink-300'}`}>
                {person.displayName.split(' ').pop()?.[0] || '?'}
            </div>
            <div className="min-w-0 flex-1">
                <p className={`${large ? 'text-sm' : 'text-[13px]'} font-medium text-slate-800 dark:text-slate-200 truncate`}>
                    {person.displayName}
                </p>
                <div className="flex items-center gap-1.5 text-[10px] text-muted-foreground">
                    <span className="font-medium">{label}</span>
                    <span>·</span>
                    <span>Đời {person.generation}</span>
                    {person.birthYear && (
                        <>
                            <span>·</span>
                            <span>{person.birthYear}{person.deathYear ? `–${person.deathYear}` : ''}</span>
                        </>
                    )}
                    {!person.isLiving && <span className="text-slate-400">✝</span>}
                </div>
            </div>
            <ChevronRight className="w-4 h-4 text-slate-300 dark:text-slate-600 shrink-0" />
        </Link>
    );
}

