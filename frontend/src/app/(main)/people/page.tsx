'use client';

import { useEffect, useState } from 'react';
import { Users, Search, MoreHorizontal, Eye, Pencil, GitBranch } from 'lucide-react';
import { Input } from '@/components/ui/input';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import {
    Table,
    TableBody,
    TableCell,
    TableHead,
    TableHeader,
    TableRow,
} from '@/components/ui/table';
import {
    DropdownMenu,
    DropdownMenuContent,
    DropdownMenuItem,
    DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { PersonDetailPanel } from '@/components/person-detail-panel';
import { useAuth } from '@/components/auth-provider';
import { useRouter } from 'next/navigation';
import { RequireAuth } from '@/components/require-auth';

interface Person {
    id: string;
    displayName: string;
    gender: number;
    birthYear?: number;
    deathYear?: number;
    isLiving: boolean;
    isPrivacyFiltered: boolean;
}

export default function PeopleListPage() {
    const [people, setPeople] = useState<Person[]>([]);
    const [loading, setLoading] = useState(true);
    const [search, setSearch] = useState('');
    const [genderFilter, setGenderFilter] = useState<number | null>(null);
    const [livingFilter, setLivingFilter] = useState<boolean | null>(null);
    const [selectedHandle, setSelectedHandle] = useState<string | null>(null);
    const [editHandle, setEditHandle] = useState<string | null>(null);
    const { canEdit, isLoggedIn, loading: authLoading } = useAuth();
    const router = useRouter();

    useEffect(() => {
        const fetchPeople = async () => {
            try {
                const { supabase } = await import('@/lib/supabase');
                const { data, error } = await supabase
                    .from('people')
                    .select('id, display_name, gender, birth_year, death_year, is_living, is_privacy_filtered')
                    .order('display_name', { ascending: true });
                if (!error && data) {
                    setPeople(data.map((row: Record<string, unknown>) => ({
                        id: row.id as string,
                        displayName: row.display_name as string,
                        gender: row.gender as number,
                        birthYear: row.birth_year as number | undefined,
                        deathYear: row.death_year as number | undefined,
                        isLiving: row.is_living as boolean,
                        isPrivacyFiltered: row.is_privacy_filtered as boolean,
                    })));
                }
            } catch { /* ignore */ }
            setLoading(false);
        };
        fetchPeople();
    }, []);

    // Auth guard
    if (!authLoading && !isLoggedIn) {
        return <RequireAuth>{null}</RequireAuth>;
    }

    const filtered = people.filter((p) => {
        if (search && !p.displayName.toLowerCase().includes(search.toLowerCase())) return false;
        if (genderFilter !== null && p.gender !== genderFilter) return false;
        if (livingFilter !== null && p.isLiving !== livingFilter) return false;
        return true;
    });

    return (
        <div className="space-y-6">
            <div>
                <h1 className="text-2xl font-bold tracking-tight flex items-center gap-2">
                    <Users className="h-6 w-6" />
                    Thành viên gia phả
                </h1>
                <p className="text-muted-foreground">{people.length} người trong gia phả</p>
            </div>

            {/* Filters */}
            <div className="flex flex-wrap gap-2 sm:gap-3 items-center">
                <div className="relative w-full sm:flex-1 sm:min-w-[200px] sm:max-w-sm">
                    <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                    <Input placeholder="Tìm theo tên..." value={search} onChange={(e) => setSearch(e.target.value)} className="pl-9" />
                </div>
                <div className="flex gap-1.5 sm:gap-2 flex-wrap">
                    <Button variant={genderFilter === null ? 'default' : 'outline'} size="sm" className="h-8 text-xs sm:text-sm" onClick={() => setGenderFilter(null)}>Tất cả</Button>
                    <Button variant={genderFilter === 1 ? 'default' : 'outline'} size="sm" className="h-8 text-xs sm:text-sm" onClick={() => setGenderFilter(1)}>Nam</Button>
                    <Button variant={genderFilter === 2 ? 'default' : 'outline'} size="sm" className="h-8 text-xs sm:text-sm" onClick={() => setGenderFilter(2)}>Nữ</Button>
                </div>
                <div className="flex gap-1.5 sm:gap-2 flex-wrap">
                    <Button variant={livingFilter === null ? 'default' : 'outline'} size="sm" className="h-8 text-xs sm:text-sm" onClick={() => setLivingFilter(null)}>Tất cả</Button>
                    <Button variant={livingFilter === true ? 'default' : 'outline'} size="sm" className="h-8 text-xs sm:text-sm" onClick={() => setLivingFilter(true)}>Còn sống</Button>
                    <Button variant={livingFilter === false ? 'default' : 'outline'} size="sm" className="h-8 text-xs sm:text-sm" onClick={() => setLivingFilter(false)}>Đã mất</Button>
                </div>
            </div>

            {/* Table */}
            <Card>
                <CardContent className="p-0 overflow-x-auto">
                    {loading ? (
                        <div className="flex items-center justify-center h-48">
                            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary" />
                        </div>
                    ) : (
                        <Table className="min-w-[500px]">
                            <TableHeader>
                                <TableRow>
                                    <TableHead>Họ tên</TableHead>
                                    <TableHead>Giới tính</TableHead>
                                    <TableHead>Năm sinh</TableHead>
                                    <TableHead>Năm mất</TableHead>
                                    <TableHead>Trạng thái</TableHead>
                                    <TableHead className="w-10"></TableHead>
                                </TableRow>
                            </TableHeader>
                            <TableBody>
                                {filtered.map((p) => (
                                    <TableRow
                                        key={p.id}
                                        className="cursor-pointer hover:bg-accent/50"
                                        onClick={() => setSelectedHandle(p.id)}
                                    >
                                        <TableCell className="font-medium">
                                            {p.displayName}
                                            {p.isPrivacyFiltered && <span className="ml-1 text-amber-500">🔒</span>}
                                        </TableCell>
                                        <TableCell>
                                            <Badge variant="outline">
                                                {p.gender === 1 ? 'Nam' : p.gender === 2 ? 'Nữ' : '?'}
                                            </Badge>
                                        </TableCell>
                                        <TableCell>{p.birthYear || '—'}</TableCell>
                                        <TableCell>{p.deathYear || (p.isLiving ? '—' : '?')}</TableCell>
                                        <TableCell>
                                            <Badge variant={p.isLiving ? 'default' : 'secondary'}>
                                                {p.isLiving ? 'Còn sống' : 'Đã mất'}
                                            </Badge>
                                        </TableCell>
                                        <TableCell className="text-center" onClick={(e) => e.stopPropagation()}>
                                            <DropdownMenu>
                                                <DropdownMenuTrigger asChild>
                                                    <Button variant="ghost" size="icon" className="h-8 w-8">
                                                        <MoreHorizontal className="h-4 w-4 text-muted-foreground" />
                                                    </Button>
                                                </DropdownMenuTrigger>
                                                <DropdownMenuContent align="end">
                                                    <DropdownMenuItem onClick={() => setSelectedHandle(p.id)}>
                                                        <Eye className="h-4 w-4 mr-2" />
                                                        Xem chi tiết
                                                    </DropdownMenuItem>
                                                    {canEdit && (
                                                        <DropdownMenuItem onClick={() => setEditHandle(p.id)}>
                                                            <Pencil className="h-4 w-4 mr-2" />
                                                            Chỉnh sửa
                                                        </DropdownMenuItem>
                                                    )}
                                                    <DropdownMenuItem onClick={() => { window.location.href = `/pha-do?focus=${p.id}`; }}>
                                                        <GitBranch className="h-4 w-4 mr-2" />
                                                        Xem trên cây
                                                    </DropdownMenuItem>
                                                </DropdownMenuContent>
                                            </DropdownMenu>
                                        </TableCell>
                                    </TableRow>
                                ))}
                                {filtered.length === 0 && (
                                    <TableRow>
                                        <TableCell colSpan={6} className="text-center text-muted-foreground py-8">
                                            {search ? 'Không tìm thấy kết quả' : 'Chưa có dữ liệu gia phả'}
                                        </TableCell>
                                    </TableRow>
                                )}
                            </TableBody>
                        </Table>
                    )}
                </CardContent>
            </Card>

            {/* Person detail panel (slide-in) */}
            {(selectedHandle || editHandle) && (
                <PersonDetailPanel
                    personId={(editHandle || selectedHandle)!}
                    initialEdit={!!editHandle}
                    onClose={() => { setSelectedHandle(null); setEditHandle(null); }}
                    onNavigate={(h) => { setSelectedHandle(h); setEditHandle(null); }}
                    onPersonUpdated={(h, fields) => {
                        setPeople(prev => prev.map(p => {
                            if (p.id !== h) return p;
                            return {
                                ...p,
                                ...(fields.displayName !== undefined && { displayName: fields.displayName }),
                                ...(fields.birthYear !== undefined && { birthYear: fields.birthYear ?? undefined }),
                                ...(fields.deathYear !== undefined && { deathYear: fields.deathYear ?? undefined }),
                                ...(fields.isLiving !== undefined && { isLiving: fields.isLiving }),
                            };
                        }));
                    }}
                />
            )}
        </div>
    );
}
