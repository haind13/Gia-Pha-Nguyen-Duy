'use client';

import { useState, useCallback } from 'react';
import * as XLSX from 'xlsx';
import { supabase } from '@/lib/supabase';
import { RequireAuth } from '@/components/require-auth';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Download, Upload, FileSpreadsheet, AlertTriangle, CheckCircle, Loader2 } from 'lucide-react';

/* ── Column mapping: DB snake_case → Excel header VN ── */
const COLUMN_MAP = [
    { db: 'id', header: 'Mã (ID)', editable: false },
    { db: 'display_name', header: 'Họ và tên', editable: true },
    { db: 'gender', header: 'Giới tính (1=Nam, 2=Nữ)', editable: false },
    { db: 'generation', header: 'Đời thứ', editable: false },
    { db: 'birth_order', header: 'Thứ tự con', editable: true },
    { db: 'birth_year', header: 'Năm sinh', editable: true },
    { db: 'birth_date', header: 'Ngày sinh (DD/MM)', editable: true },
    { db: 'birth_place', header: 'Nơi sinh', editable: true },
    { db: 'is_living', header: 'Còn sống (TRUE/FALSE)', editable: true },
    { db: 'death_year', header: 'Năm mất', editable: true },
    { db: 'death_date', header: 'Ngày mất ÂL (DD/MM)', editable: true },
    { db: 'death_place', header: 'Nơi mất', editable: true },
    { db: 'phone', header: 'Số điện thoại', editable: true },
    { db: 'email', header: 'Email', editable: true },
    { db: 'zalo', header: 'Zalo', editable: true },
    { db: 'facebook', header: 'Facebook', editable: true },
    { db: 'current_address', header: 'Địa chỉ hiện tại', editable: true },
    { db: 'hometown', header: 'Quê quán', editable: true },
    { db: 'occupation', header: 'Nghề nghiệp', editable: true },
    { db: 'company', header: 'Nơi công tác', editable: true },
    { db: 'education', header: 'Học vấn', editable: true },
    { db: 'nick_name', header: 'Tên gọi khác', editable: true },
    { db: 'marital_status', header: 'Hôn nhân', editable: true },
    { db: 'blood_type', header: 'Nhóm máu', editable: true },
    { db: 'notes', header: 'Ghi chú', editable: true },
];

const EDITABLE_DB_FIELDS = COLUMN_MAP.filter(c => c.editable).map(c => c.db);

/* ── Export: fetch all people → build XLSX ── */
async function exportPeopleToExcel() {
    const { data, error } = await supabase
        .from('people')
        .select(COLUMN_MAP.map(c => c.db).join(', '))
        .order('generation', { ascending: true })
        .order('birth_order', { ascending: true });

    if (error || !data) throw new Error(error?.message || 'Không thể tải dữ liệu');

    // Build rows with Vietnamese headers
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const rows = (data as any[]).map((person) => {
        const row: Record<string, unknown> = {};
        for (const col of COLUMN_MAP) {
            row[col.header] = person[col.db] ?? '';
        }
        return row;
    });

    const wb = XLSX.utils.book_new();
    const ws = XLSX.utils.json_to_sheet(rows);

    // Set column widths
    ws['!cols'] = COLUMN_MAP.map(col => ({
        wch: Math.max(col.header.length + 2, 15),
    }));

    XLSX.utils.book_append_sheet(wb, ws, 'Thành viên');

    // Add instruction sheet
    const instrRows = [
        { 'Hướng dẫn': 'HƯỚNG DẪN ĐIỀN THÔNG TIN GIA PHẢ' },
        { 'Hướng dẫn': '' },
        { 'Hướng dẫn': '1. Mở sheet "Thành viên" để xem và chỉnh sửa thông tin' },
        { 'Hướng dẫn': '2. CÁC CỘT KHÔNG ĐƯỢC THAY ĐỔI: Mã (ID), Giới tính, Đời thứ' },
        { 'Hướng dẫn': '3. Các cột còn lại có thể chỉnh sửa tự do' },
        { 'Hướng dẫn': '' },
        { 'Hướng dẫn': 'QUY ƯỚC:' },
        { 'Hướng dẫn': '- Ngày sinh: ghi theo Dương lịch, format DD/MM (VD: 15/08)' },
        { 'Hướng dẫn': '- Ngày mất: ghi theo ÂM LỊCH, format DD/MM (VD: 30/07)' },
        { 'Hướng dẫn': '- Còn sống: ghi TRUE hoặc FALSE' },
        { 'Hướng dẫn': '- Hôn nhân: single / married / widowed / divorced' },
        { 'Hướng dẫn': '- Nhóm máu: A / B / AB / O' },
        { 'Hướng dẫn': '' },
        { 'Hướng dẫn': 'SAU KHI ĐIỀN XONG:' },
        { 'Hướng dẫn': '- Lưu file Excel' },
        { 'Hướng dẫn': '- Vào trang Quản trị > Nhập Excel, tải file lên' },
        { 'Hướng dẫn': '- Hệ thống sẽ so sánh và chỉ cập nhật những ô thay đổi' },
    ];
    const instrWs = XLSX.utils.json_to_sheet(instrRows);
    instrWs['!cols'] = [{ wch: 60 }];
    XLSX.utils.book_append_sheet(wb, instrWs, 'Hướng dẫn');

    const fileName = `GiaPha_ThanhVien_${new Date().toISOString().slice(0, 10)}.xlsx`;
    XLSX.writeFile(wb, fileName);
    return { count: data.length, fileName };
}

/* ── Import: parse XLSX → diff → update DB ── */
interface ImportDiff {
    id: string;
    name: string;
    changes: { field: string; header: string; oldVal: string; newVal: string }[];
}

async function parseExcelAndDiff(file: File): Promise<{ diffs: ImportDiff[]; skipped: number; errors: string[] }> {
    const buffer = await file.arrayBuffer();
    const wb = XLSX.read(buffer);

    // Find the data sheet
    const ws = wb.Sheets['Thành viên'] || wb.Sheets[wb.SheetNames[0]];
    if (!ws) throw new Error('Không tìm thấy sheet dữ liệu');

    const rows = XLSX.utils.sheet_to_json<Record<string, unknown>>(ws);
    if (rows.length === 0) throw new Error('File Excel trống');

    // Build header → db field mapping (reverse lookup)
    const headerToDb: Record<string, string> = {};
    for (const col of COLUMN_MAP) {
        headerToDb[col.header] = col.db;
    }

    // Find ID column header
    const idHeader = COLUMN_MAP.find(c => c.db === 'id')!.header;
    const nameHeader = COLUMN_MAP.find(c => c.db === 'display_name')!.header;

    // Fetch current data from DB
    const ids = rows.map(r => String(r[idHeader] || '')).filter(Boolean);
    const { data: currentData, error } = await supabase
        .from('people')
        .select(COLUMN_MAP.map(c => c.db).join(', '))
        .in('id', ids);

    if (error) throw new Error(`Lỗi tải dữ liệu: ${error.message}`);

    const currentMap = new Map<string, Record<string, unknown>>();
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    for (const p of ((currentData || []) as any[])) {
        currentMap.set(p.id as string, p);
    }

    const diffs: ImportDiff[] = [];
    const errors: string[] = [];
    let skipped = 0;

    for (const row of rows) {
        const id = String(row[idHeader] || '').trim();
        if (!id) { skipped++; continue; }

        const current = currentMap.get(id);
        if (!current) {
            errors.push(`ID "${id}" không tồn tại trong hệ thống`);
            continue;
        }

        const changes: ImportDiff['changes'] = [];

        for (const col of COLUMN_MAP) {
            if (!col.editable) continue;

            const excelVal = row[col.header];
            const dbVal = current[col.db];

            // Normalize values for comparison
            const normalizedExcel = normalizeValue(excelVal, col.db);
            const normalizedDb = normalizeValue(dbVal, col.db);

            if (normalizedExcel !== normalizedDb && normalizedExcel !== '') {
                changes.push({
                    field: col.db,
                    header: col.header,
                    oldVal: String(dbVal ?? ''),
                    newVal: String(normalizedExcel),
                });
            }
        }

        if (changes.length > 0) {
            diffs.push({
                id,
                name: String(row[nameHeader] || current['display_name'] || ''),
                changes,
            });
        }
    }

    return { diffs, skipped, errors };
}

function normalizeValue(val: unknown, field: string): string {
    if (val === null || val === undefined || val === '') return '';
    if (field === 'is_living') {
        const s = String(val).toLowerCase().trim();
        if (s === 'true' || s === '1' || s === 'có' || s === 'yes') return 'true';
        if (s === 'false' || s === '0' || s === 'không' || s === 'no') return 'false';
        return s;
    }
    if (['birth_year', 'death_year', 'birth_order', 'gender', 'generation'].includes(field)) {
        const n = Number(val);
        return isNaN(n) ? '' : String(n);
    }
    return String(val).trim();
}

async function applyDiffs(diffs: ImportDiff[]): Promise<{ success: number; failed: string[] }> {
    let success = 0;
    const failed: string[] = [];

    for (const diff of diffs) {
        const updates: Record<string, unknown> = {};
        for (const change of diff.changes) {
            let value: unknown = change.newVal;
            // Type conversion
            if (['birth_year', 'death_year', 'birth_order'].includes(change.field)) {
                value = value ? Number(value) : null;
            } else if (change.field === 'is_living') {
                value = change.newVal === 'true';
            } else if (change.newVal === '') {
                value = null;
            }
            updates[change.field] = value;
        }
        updates['updated_at'] = new Date().toISOString();

        const { error } = await supabase
            .from('people')
            .update(updates)
            .eq('id', diff.id);

        if (error) {
            failed.push(`${diff.name} (${diff.id}): ${error.message}`);
        } else {
            success++;
        }
    }

    return { success, failed };
}

/* ═══════════════════════════════════════════
   Main Page Component
   ═══════════════════════════════════════════ */
export default function ExcelPage() {
    const [exporting, setExporting] = useState(false);
    const [exportResult, setExportResult] = useState<{ count: number; fileName: string } | null>(null);

    const [importing, setImporting] = useState(false);
    const [diffs, setDiffs] = useState<ImportDiff[] | null>(null);
    const [importErrors, setImportErrors] = useState<string[]>([]);
    const [skipped, setSkipped] = useState(0);

    const [applying, setApplying] = useState(false);
    const [applyResult, setApplyResult] = useState<{ success: number; failed: string[] } | null>(null);

    const handleExport = useCallback(async () => {
        setExporting(true);
        setExportResult(null);
        try {
            const result = await exportPeopleToExcel();
            setExportResult(result);
        } catch (err) {
            alert(`Lỗi xuất Excel: ${err instanceof Error ? err.message : 'Unknown'}`);
        } finally {
            setExporting(false);
        }
    }, []);

    const handleFileUpload = useCallback(async (e: React.ChangeEvent<HTMLInputElement>) => {
        const file = e.target.files?.[0];
        if (!file) return;
        setImporting(true);
        setDiffs(null);
        setImportErrors([]);
        setApplyResult(null);
        try {
            const result = await parseExcelAndDiff(file);
            setDiffs(result.diffs);
            setImportErrors(result.errors);
            setSkipped(result.skipped);
        } catch (err) {
            alert(`Lỗi đọc file: ${err instanceof Error ? err.message : 'Unknown'}`);
        } finally {
            setImporting(false);
            e.target.value = '';
        }
    }, []);

    const handleApply = useCallback(async () => {
        if (!diffs || diffs.length === 0) return;
        setApplying(true);
        try {
            const result = await applyDiffs(diffs);
            setApplyResult(result);
            if (result.failed.length === 0) {
                setDiffs(null); // Clear diffs on full success
            }
        } catch (err) {
            alert(`Lỗi cập nhật: ${err instanceof Error ? err.message : 'Unknown'}`);
        } finally {
            setApplying(false);
        }
    }, [diffs]);

    return (
        <RequireAuth>
        <div className="space-y-6 max-w-4xl mx-auto">
            <div>
                <h1 className="text-xl sm:text-2xl font-bold tracking-tight flex items-center gap-2">
                    <FileSpreadsheet className="h-5 w-5 sm:h-6 sm:w-6 text-green-600" />
                    Quản lý Excel
                </h1>
                <p className="text-sm text-muted-foreground mt-1">
                    Xuất / nhập thông tin thành viên qua file Excel
                </p>
            </div>

            {/* ── Export Section ── */}
            <Card>
                <CardContent className="p-5 space-y-3">
                    <h2 className="font-semibold text-base flex items-center gap-2">
                        <Download className="h-4 w-4 text-blue-500" />
                        Tải file Excel mẫu
                    </h2>
                    <p className="text-sm text-muted-foreground">
                        Xuất toàn bộ thông tin thành viên thành file Excel. Chia sẻ file cho mọi người trong họ tự điền thông tin, sau đó tải lên lại.
                    </p>
                    <Button onClick={handleExport} disabled={exporting} className="gap-2">
                        {exporting ? <Loader2 className="h-4 w-4 animate-spin" /> : <Download className="h-4 w-4" />}
                        {exporting ? 'Đang xuất...' : 'Xuất file Excel'}
                    </Button>
                    {exportResult && (
                        <p className="text-sm text-green-600 flex items-center gap-1">
                            <CheckCircle className="h-4 w-4" />
                            Đã xuất {exportResult.count} thành viên → <strong>{exportResult.fileName}</strong>
                        </p>
                    )}
                </CardContent>
            </Card>

            {/* ── Import Section ── */}
            <Card>
                <CardContent className="p-5 space-y-4">
                    <h2 className="font-semibold text-base flex items-center gap-2">
                        <Upload className="h-4 w-4 text-amber-500" />
                        Nhập từ Excel
                    </h2>
                    <p className="text-sm text-muted-foreground">
                        Tải file Excel đã điền thông tin lên. Hệ thống sẽ so sánh với dữ liệu hiện tại và chỉ cập nhật những thay đổi.
                    </p>

                    <div className="flex items-center gap-3">
                        <label className="cursor-pointer">
                            <input
                                type="file"
                                accept=".xlsx,.xls"
                                onChange={handleFileUpload}
                                className="hidden"
                                disabled={importing}
                            />
                            <span className="inline-flex items-center gap-2 px-4 py-2 rounded-md bg-amber-50 border border-amber-200 text-amber-700 hover:bg-amber-100 transition-colors text-sm font-medium dark:bg-amber-900/20 dark:border-amber-700 dark:text-amber-300">
                                {importing ? <Loader2 className="h-4 w-4 animate-spin" /> : <Upload className="h-4 w-4" />}
                                {importing ? 'Đang đọc...' : 'Chọn file Excel'}
                            </span>
                        </label>
                    </div>

                    {/* Errors */}
                    {importErrors.length > 0 && (
                        <div className="bg-red-50 border border-red-200 rounded-lg p-3 space-y-1 dark:bg-red-900/20 dark:border-red-700">
                            <p className="text-sm font-medium text-red-700 flex items-center gap-1 dark:text-red-300">
                                <AlertTriangle className="h-4 w-4" /> Lỗi ({importErrors.length})
                            </p>
                            {importErrors.map((err, i) => (
                                <p key={i} className="text-xs text-red-600 dark:text-red-400">• {err}</p>
                            ))}
                        </div>
                    )}

                    {/* Diff Preview */}
                    {diffs !== null && (
                        <div className="space-y-3">
                            <div className="flex items-center justify-between">
                                <p className="text-sm font-medium">
                                    {diffs.length > 0
                                        ? `Tìm thấy ${diffs.length} thành viên có thay đổi`
                                        : 'Không có thay đổi nào'}
                                    {skipped > 0 && <span className="text-muted-foreground ml-2">({skipped} dòng bỏ qua)</span>}
                                </p>
                                {diffs.length > 0 && (
                                    <Button onClick={handleApply} disabled={applying} size="sm" className="gap-2 bg-green-600 hover:bg-green-700">
                                        {applying ? <Loader2 className="h-4 w-4 animate-spin" /> : <CheckCircle className="h-4 w-4" />}
                                        {applying ? 'Đang cập nhật...' : `Áp dụng ${diffs.length} thay đổi`}
                                    </Button>
                                )}
                            </div>

                            {/* Change list */}
                            <div className="max-h-[400px] overflow-auto space-y-2">
                                {diffs.map(diff => (
                                    <div key={diff.id} className="border rounded-lg p-3 bg-card">
                                        <p className="font-medium text-sm flex items-center gap-2">
                                            {diff.name}
                                            <Badge variant="secondary" className="text-[10px]">{diff.id}</Badge>
                                        </p>
                                        <div className="mt-1.5 space-y-1">
                                            {diff.changes.map((ch, i) => (
                                                <div key={i} className="text-xs flex items-start gap-2">
                                                    <span className="text-muted-foreground min-w-[140px] shrink-0">{ch.header}:</span>
                                                    <span className="text-red-500 line-through">{ch.oldVal || '(trống)'}</span>
                                                    <span className="text-muted-foreground">→</span>
                                                    <span className="text-green-600 font-medium">{ch.newVal || '(trống)'}</span>
                                                </div>
                                            ))}
                                        </div>
                                    </div>
                                ))}
                            </div>
                        </div>
                    )}

                    {/* Apply Result */}
                    {applyResult && (
                        <div className={`rounded-lg p-3 border ${applyResult.failed.length === 0
                            ? 'bg-green-50 border-green-200 dark:bg-green-900/20 dark:border-green-700'
                            : 'bg-yellow-50 border-yellow-200 dark:bg-yellow-900/20 dark:border-yellow-700'
                        }`}>
                            <p className="text-sm font-medium flex items-center gap-1">
                                <CheckCircle className="h-4 w-4 text-green-600" />
                                Đã cập nhật thành công {applyResult.success} thành viên
                            </p>
                            {applyResult.failed.length > 0 && (
                                <div className="mt-2 space-y-1">
                                    <p className="text-sm text-red-600 font-medium">Lỗi ({applyResult.failed.length}):</p>
                                    {applyResult.failed.map((f, i) => (
                                        <p key={i} className="text-xs text-red-500">• {f}</p>
                                    ))}
                                </div>
                            )}
                        </div>
                    )}
                </CardContent>
            </Card>
        </div>
        </RequireAuth>
    );
}
