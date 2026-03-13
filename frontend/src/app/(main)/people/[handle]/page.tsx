'use client';

import { useEffect, useState, useCallback } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { ArrowLeft, User, Heart, Image, FileText, History, Lock, Phone, MapPin, Briefcase, GraduationCap, Tag, MessageCircle, Pencil, Save, X } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Separator } from '@/components/ui/separator';
import { Input } from '@/components/ui/input';
import { zodiacYear } from '@/lib/genealogy-types';
import type { PersonDetail } from '@/lib/genealogy-types';
import { CommentSection } from '@/components/comment-section';
import { useAuth } from '@/components/auth-provider';
import { updatePerson as supaUpdatePerson, type PersonEditFields } from '@/lib/supabase-data';


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
    const { canEdit } = useAuth();

    useEffect(() => {
        const fetchPerson = async () => {
            try {
                const { supabase } = await import('@/lib/supabase');
                const { data, error } = await supabase
                    .from('people')
                    .select('*')
                    .eq('id', handle)
                    .single();
                if (!error && data) {
                    const row = data as Record<string, unknown>;
                    setPerson({
                        id: row.id as string,
                        displayName: row.display_name as string,
                        gender: row.gender as number,
                        birthYear: row.birth_year as number | undefined,
                        birthDate: row.birth_date as string | undefined,
                        birthPlace: row.birth_place as string | undefined,
                        deathYear: row.death_year as number | undefined,
                        deathDate: row.death_date as string | undefined,
                        deathPlace: row.death_place as string | undefined,
                        generation: row.generation as number,
                        isLiving: row.is_living as boolean,
                        isPrivacyFiltered: row.is_privacy_filtered as boolean,
                        isPatrilineal: row.is_patrilineal as boolean,
                        familyIds: (row.family_ids as string[]) || [],
                        parentFamilyIds: (row.parent_family_ids as string[]) || [],
                        phone: row.phone as string | undefined,
                        email: row.email as string | undefined,
                        zalo: row.zalo as string | undefined,
                        facebook: row.facebook as string | undefined,
                        currentAddress: row.current_address as string | undefined,
                        hometown: row.hometown as string | undefined,
                        occupation: row.occupation as string | undefined,
                        company: row.company as string | undefined,
                        education: row.education as string | undefined,
                        nickName: row.nick_name as string | undefined,
                        notes: row.notes as string | undefined,
                    } as PersonDetail);
                }
            } catch { /* ignore */ }
            setLoading(false);
        };
        fetchPerson();
    }, [handle]);

    const startEditing = useCallback(() => {
        if (!person) return;
        setForm({
            displayName: person.displayName || '',
            nickName: person.nickName || '',
            birthYear: person.birthYear ?? null,
            birthDate: person.birthDate || '',
            birthPlace: person.birthPlace || '',
            deathYear: person.deathYear ?? null,
            deathDate: person.deathDate || '',
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
            // Update local state
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

    return (
        <div className="space-y-6">
            {/* Header */}
            <div className="flex items-start justify-between">
                <div className="flex items-center gap-4">
                    <Button variant="ghost" size="icon" onClick={() => router.back()}>
                        <ArrowLeft className="h-4 w-4" />
                    </Button>
                    <div>
                        <h1 className="text-2xl font-bold tracking-tight flex items-center gap-2">
                            {person.displayName}
                            {person.isPrivacyFiltered && (
                                <Badge variant="outline" className="text-amber-500 border-amber-500">
                                    <Lock className="h-3 w-3 mr-1" />
                                    Thông tin bị giới hạn
                                </Badge>
                            )}
                        </h1>
                        <p className="text-muted-foreground">
                            {genderLabel}
                            {person.generation ? ` • Đời thứ ${person.generation}` : ''}
                            {person.chi ? ` • Chi ${person.chi}` : ''}
                            {person.isLiving && ' • Còn sống'}
                        </p>
                    </div>
                </div>
                {canEdit && !editing && (
                    <Button variant="outline" size="sm" onClick={startEditing} className="gap-1.5">
                        <Pencil className="h-3.5 w-3.5" /> Chỉnh sửa
                    </Button>
                )}
                {editing && (
                    <div className="flex gap-2">
                        <Button size="sm" onClick={handleSave} disabled={saving} className="gap-1.5">
                            {saving ? <div className="w-3.5 h-3.5 border-2 border-white/30 border-t-white rounded-full animate-spin" /> : <Save className="h-3.5 w-3.5" />}
                            {saving ? 'Đang lưu...' : 'Lưu'}
                        </Button>
                        <Button variant="outline" size="sm" onClick={() => { setEditing(false); setSaveMsg(null); }} className="gap-1.5">
                            <X className="h-3.5 w-3.5" /> Hủy
                        </Button>
                    </div>
                )}
            </div>

            {/* Save message */}
            {saveMsg && (
                <div className={`rounded-lg px-4 py-2.5 text-sm font-medium ${saveMsg.type === 'ok' ? 'bg-green-50 text-green-700 dark:bg-green-900/30 dark:text-green-400' : 'bg-red-50 text-red-700 dark:bg-red-900/30 dark:text-red-400'}`}>
                    {saveMsg.text}
                </div>
            )}

            {/* Privacy notice */}
            {person.isPrivacyFiltered && person._privacyNote && (
                <div className="rounded-md bg-amber-500/10 border border-amber-500/20 p-3 text-sm text-amber-600 dark:text-amber-400">
                    {person._privacyNote}
                </div>
            )}

            {/* Tabs */}
            <Tabs defaultValue="overview">
                <TabsList>
                    <TabsTrigger value="overview" className="gap-1">
                        <User className="h-3.5 w-3.5" /> Tổng quan
                    </TabsTrigger>
                    <TabsTrigger value="relationships" className="gap-1">
                        <Heart className="h-3.5 w-3.5" /> Quan hệ
                    </TabsTrigger>
                    <TabsTrigger value="media" className="gap-1">
                        <Image className="h-3.5 w-3.5" /> Tư liệu
                    </TabsTrigger>
                    <TabsTrigger value="history" className="gap-1">
                        <History className="h-3.5 w-3.5" /> Lịch sử
                    </TabsTrigger>
                    <TabsTrigger value="comments" className="gap-1">
                        <MessageCircle className="h-3.5 w-3.5" /> Bình luận
                    </TabsTrigger>
                </TabsList>

                {/* Overview */}
                <TabsContent value="overview" className="space-y-4">
                    {/* Thông tin cá nhân */}
                    <Card>
                        <CardHeader>
                            <CardTitle className="text-base flex items-center gap-2">
                                <User className="h-4 w-4" /> Thông tin cá nhân
                            </CardTitle>
                        </CardHeader>
                        <CardContent className="grid gap-4 md:grid-cols-2">
                            {editing ? (
                                <>
                                    <EditRow label="Họ tên" value={form.displayName || ''} onChange={v => setField('displayName', v)} />
                                    <EditRow label="Tên thường gọi" value={form.nickName || ''} onChange={v => setField('nickName', v)} placeholder="Biệt danh" />
                                    <EditRow label="Năm sinh" value={form.birthYear?.toString() || ''} onChange={v => setField('birthYear', v ? parseInt(v) || null : null)} type="number" />
                                    <EditRow label="Ngày sinh" value={form.birthDate || ''} onChange={v => setField('birthDate', v)} placeholder="VD: 15/03/1945" />
                                    {person.birthYear && <InfoRow label="Năm âm lịch" value={zodiacYear(person.birthYear) || '—'} />}
                                    <EditRow label="Nơi sinh" value={form.birthPlace || ''} onChange={v => setField('birthPlace', v)} />
                                    <div className="flex items-center gap-3 col-span-full">
                                        <p className="text-xs font-medium text-muted-foreground">Trạng thái</p>
                                        <Button
                                            variant="outline"
                                            size="sm"
                                            onClick={() => setField('isLiving', !form.isLiving)}
                                            className={form.isLiving ? 'border-emerald-300 text-emerald-700' : 'border-slate-300 text-slate-500'}
                                        >
                                            {form.isLiving ? '● Còn sống' : '✝ Đã mất'}
                                        </Button>
                                    </div>
                                    {!form.isLiving && (
                                        <>
                                            <EditRow label="Năm mất" value={form.deathYear?.toString() || ''} onChange={v => setField('deathYear', v ? parseInt(v) || null : null)} type="number" />
                                            <EditRow label="Ngày mất" value={form.deathDate || ''} onChange={v => setField('deathDate', v)} placeholder="VD: 01/12/2020" />
                                            <EditRow label="Nơi mất" value={form.deathPlace || ''} onChange={v => setField('deathPlace', v)} />
                                        </>
                                    )}
                                </>
                            ) : (
                                <>
                                    <InfoRow label="Giới tính" value={genderLabel} />
                                    {person.nickName && <InfoRow label="Tên thường gọi" value={person.nickName} />}
                                    <InfoRow label="Ngày sinh" value={person.birthDate || (person.birthYear ? `${person.birthYear}` : '—')} />
                                    {person.birthYear && <InfoRow label="Năm âm lịch" value={zodiacYear(person.birthYear) || '—'} />}
                                    {person.birthPlace && <InfoRow label="Nơi sinh" value={person.birthPlace} />}
                                    {!person.isLiving && (
                                        <>
                                            <InfoRow label="Ngày mất" value={person.deathDate || (person.deathYear ? `${person.deathYear}` : '—')} />
                                            {person.deathPlace && <InfoRow label="Nơi mất" value={person.deathPlace} />}
                                        </>
                                    )}
                                </>
                            )}
                        </CardContent>
                    </Card>

                    {/* Liên hệ */}
                    {(editing || person.phone || person.email || person.zalo || person.facebook) && (
                        <Card>
                            <CardHeader>
                                <CardTitle className="text-base flex items-center gap-2">
                                    <Phone className="h-4 w-4" /> Liên hệ
                                </CardTitle>
                            </CardHeader>
                            <CardContent className="grid gap-4 md:grid-cols-2">
                                {editing ? (
                                    <>
                                        <EditRow label="Điện thoại" value={form.phone || ''} onChange={v => setField('phone', v)} placeholder="0912345678" />
                                        <EditRow label="Email" value={form.email || ''} onChange={v => setField('email', v)} placeholder="email@example.com" />
                                        <EditRow label="Zalo" value={form.zalo || ''} onChange={v => setField('zalo', v)} placeholder="Số Zalo" />
                                        <EditRow label="Facebook" value={form.facebook || ''} onChange={v => setField('facebook', v)} placeholder="Link Facebook" />
                                    </>
                                ) : (
                                    <>
                                        {person.phone && <InfoRow label="Điện thoại" value={person.phone} />}
                                        {person.email && <InfoRow label="Email" value={person.email} />}
                                        {person.zalo && <InfoRow label="Zalo" value={person.zalo} />}
                                        {person.facebook && <InfoRow label="Facebook" value={person.facebook} />}
                                    </>
                                )}
                            </CardContent>
                        </Card>
                    )}

                    {/* Địa chỉ */}
                    {(editing || person.hometown || person.currentAddress) && (
                        <Card>
                            <CardHeader>
                                <CardTitle className="text-base flex items-center gap-2">
                                    <MapPin className="h-4 w-4" /> Địa chỉ
                                </CardTitle>
                            </CardHeader>
                            <CardContent className="grid gap-4 md:grid-cols-2">
                                {editing ? (
                                    <>
                                        <EditRow label="Quê quán" value={form.hometown || ''} onChange={v => setField('hometown', v)} />
                                        <EditRow label="Nơi ở hiện tại" value={form.currentAddress || ''} onChange={v => setField('currentAddress', v)} />
                                    </>
                                ) : (
                                    <>
                                        {person.hometown && <InfoRow label="Quê quán" value={person.hometown} />}
                                        {person.currentAddress && <InfoRow label="Nơi ở hiện tại" value={person.currentAddress} />}
                                    </>
                                )}
                            </CardContent>
                        </Card>
                    )}

                    {/* Nghề nghiệp & Học vấn */}
                    {(editing || person.occupation || person.company || person.education) && (
                        <Card>
                            <CardHeader>
                                <CardTitle className="text-base flex items-center gap-2">
                                    <Briefcase className="h-4 w-4" /> Nghề nghiệp & Học vấn
                                </CardTitle>
                            </CardHeader>
                            <CardContent className="grid gap-4 md:grid-cols-2">
                                {editing ? (
                                    <>
                                        <EditRow label="Nghề nghiệp" value={form.occupation || ''} onChange={v => setField('occupation', v)} placeholder="VD: Giáo viên, Kỹ sư..." />
                                        <EditRow label="Nơi công tác" value={form.company || ''} onChange={v => setField('company', v)} placeholder="VD: Công ty ABC..." />
                                        <EditRow label="Học vấn" value={form.education || ''} onChange={v => setField('education', v)} placeholder="VD: Đại học Bách khoa..." />
                                    </>
                                ) : (
                                    <>
                                        {person.occupation && <InfoRow label="Nghề nghiệp" value={person.occupation} />}
                                        {person.company && <InfoRow label="Nơi công tác" value={person.company} />}
                                        {person.education && (
                                            <div className="flex items-start gap-2">
                                                <GraduationCap className="h-4 w-4 text-muted-foreground mt-0.5 shrink-0" />
                                                <div>
                                                    <p className="text-xs font-medium text-muted-foreground">Học vấn</p>
                                                    <p className="text-sm">{person.education}</p>
                                                </div>
                                            </div>
                                        )}
                                    </>
                                )}
                            </CardContent>
                        </Card>
                    )}

                    {/* Tiểu sử & Ghi chú */}
                    {(editing || person.biography || person.notes) && (
                        <Card>
                            <CardHeader>
                                <CardTitle className="text-base flex items-center gap-2">
                                    <FileText className="h-4 w-4" /> Ghi chú
                                </CardTitle>
                            </CardHeader>
                            <CardContent className="space-y-3">
                                {editing ? (
                                    <textarea
                                        className="w-full border border-input rounded-md px-3 py-2 text-sm bg-background resize-y min-h-[80px] focus:outline-none focus:ring-2 focus:ring-ring"
                                        rows={3}
                                        value={form.notes || ''}
                                        onChange={e => setField('notes', e.target.value)}
                                        placeholder="Ghi chú thêm về người này..."
                                    />
                                ) : (
                                    <>
                                        {person.biography && (
                                            <div>
                                                <p className="text-xs font-medium text-muted-foreground mb-1">Tiểu sử</p>
                                                <p className="text-sm leading-relaxed">{person.biography}</p>
                                            </div>
                                        )}
                                        {person.notes && (
                                            <div>
                                                <p className="text-xs font-medium text-muted-foreground mb-1">Ghi chú</p>
                                                <p className="text-sm leading-relaxed text-muted-foreground">{person.notes}</p>
                                            </div>
                                        )}
                                    </>
                                )}
                            </CardContent>
                        </Card>
                    )}

                    {/* Tags */}
                    {person.tags && person.tags.length > 0 && (
                        <Card>
                            <CardHeader>
                                <CardTitle className="text-base flex items-center gap-2">
                                    <Tag className="h-4 w-4" /> Nhãn
                                </CardTitle>
                            </CardHeader>
                            <CardContent>
                                <div className="flex flex-wrap gap-2">
                                    {person.tags.map(tag => (
                                        <Badge key={tag} variant="secondary" className="text-xs">
                                            {tag}
                                        </Badge>
                                    ))}
                                </div>
                            </CardContent>
                        </Card>
                    )}
                </TabsContent>

                {/* Relationships */}
                <TabsContent value="relationships">
                    <Card>
                        <CardHeader>
                            <CardTitle className="text-base">Quan hệ gia đình</CardTitle>
                        </CardHeader>
                        <CardContent>
                            <div className="space-y-3">
                                <div>
                                    <p className="text-sm font-medium text-muted-foreground">Gia đình (cha/mẹ)</p>
                                    {person.parentFamilyIds && person.parentFamilyIds.length > 0 ? (
                                        person.parentFamilyIds.map((f) => (
                                            <Badge key={f} variant="outline" className="mr-1">{f}</Badge>
                                        ))
                                    ) : (
                                        <p className="text-sm text-muted-foreground">Không có thông tin</p>
                                    )}
                                </div>
                                <Separator />
                                <div>
                                    <p className="text-sm font-medium text-muted-foreground">Gia đình (vợ/chồng, con)</p>
                                    {person.familyIds && person.familyIds.length > 0 ? (
                                        person.familyIds.map((f) => (
                                            <Badge key={f} variant="outline" className="mr-1">{f}</Badge>
                                        ))
                                    ) : (
                                        <p className="text-sm text-muted-foreground">Không có thông tin</p>
                                    )}
                                </div>
                            </div>
                        </CardContent>
                    </Card>
                </TabsContent>

                {/* Media */}
                <TabsContent value="media">
                    <Card>
                        <CardHeader>
                            <CardTitle className="text-base">Tư liệu liên quan</CardTitle>
                        </CardHeader>
                        <CardContent>
                            <p className="text-muted-foreground text-sm">
                                {person.mediaCount ? `${person.mediaCount} tư liệu` : 'Chưa có tư liệu nào'}
                            </p>
                            <p className="text-xs text-muted-foreground mt-2">
                                Tính năng xem chi tiết sẽ được bổ sung trong Epic 3 (Media Library).
                            </p>
                        </CardContent>
                    </Card>
                </TabsContent>

                {/* History */}
                <TabsContent value="history">
                    <Card>
                        <CardHeader>
                            <CardTitle className="text-base">Lịch sử thay đổi</CardTitle>
                        </CardHeader>
                        <CardContent>
                            <p className="text-muted-foreground text-sm">
                                Audit log cho entity này sẽ được bổ sung trong Epic 4.
                            </p>
                        </CardContent>
                    </Card>
                </TabsContent>

                {/* Comments */}
                <TabsContent value="comments">
                    <Card>
                        <CardHeader>
                            <CardTitle className="text-base flex items-center gap-2">
                                <MessageCircle className="h-4 w-4" /> Bình luận
                            </CardTitle>
                        </CardHeader>
                        <CardContent>
                            <CommentSection personId={handle} />
                        </CardContent>
                    </Card>
                </TabsContent>
            </Tabs>
        </div>
    );
}

function InfoRow({ label, value }: { label: string; value: string }) {
    return (
        <div>
            <p className="text-xs font-medium text-muted-foreground">{label}</p>
            <p className="text-sm">{value}</p>
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
                placeholder={placeholder}
                className="h-8 text-sm"
            />
        </div>
    );
}
