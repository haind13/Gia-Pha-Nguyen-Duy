/**
 * Privacy utility — Che khuyết dữ liệu cá nhân theo Luật BVDLCN (91/2025)
 *
 * AccessTier:
 *   guest  — chưa đăng nhập: chỉ thấy thông tin cơ bản
 *   member — đã đăng nhập (viewer/member/editor): thấy cá nhân + sensitive dạng che
 *   admin  — admin: thấy đầy đủ
 */

export type AccessTier = 'admin' | 'member' | 'guest';

export function getAccessTier(role: string | null | undefined): AccessTier {
    if (!role) return 'guest';
    if (role === 'admin') return 'admin';
    return 'member'; // viewer, member, editor
}

// ─── Masking functions ───

/** '0912345678' → '0912***678' */
export function maskPhone(phone: string): string {
    if (!phone) return '';
    const digits = phone.replace(/\D/g, '');
    if (digits.length <= 6) return '***';
    return digits.slice(0, 4) + '***' + digits.slice(-3);
}

/** 'user@email.com' → 'u***@e***.com' */
export function maskEmail(email: string): string {
    if (!email) return '';
    const at = email.indexOf('@');
    if (at < 0) return '***';
    const local = email.slice(0, at);
    const domain = email.slice(at + 1);
    const dot = domain.lastIndexOf('.');
    if (dot < 0) return local[0] + '***@***';
    const domainName = domain.slice(0, dot);
    const ext = domain.slice(dot);
    return local[0] + '***@' + domainName[0] + '***' + ext;
}

/** Giữ lại phần cuối (tỉnh/thành phố). 'Số 10, Đường ABC, Quận 1, TP.HCM' → '*** TP.HCM' */
export function maskAddress(address: string): string {
    if (!address) return '';
    const parts = address.split(',').map(s => s.trim());
    if (parts.length <= 1) return '***';
    return '*** ' + parts[parts.length - 1];
}

/** Social links → '***' */
export function maskSocial(link: string): string {
    if (!link) return '';
    return '***';
}

/** '15/03/1990' → '1990' (chỉ giữ năm) */
export function maskDate(dateStr: string | undefined, year: number | undefined): string {
    if (year) return String(year);
    if (!dateStr) return '—';
    // Try to extract year from DD/MM/YYYY
    const parts = dateStr.split('/');
    if (parts.length === 3) return parts[2];
    return '—';
}

// ─── Field classification ───

type FieldCategory = 'basic' | 'personal' | 'sensitive';

const FIELD_CATEGORIES: Record<string, FieldCategory> = {
    // Basic — always visible
    displayName: 'basic', gender: 'basic', generation: 'basic',
    birthYear: 'basic', deathYear: 'basic', isLiving: 'basic',
    isPatrilineal: 'basic', surname: 'basic', firstName: 'basic',
    chi: 'basic', id: 'basic',

    // Personal — hidden for guests, visible for members
    birthDate: 'personal', deathDate: 'personal',
    birthPlace: 'personal', deathPlace: 'personal',
    occupation: 'personal', company: 'personal', education: 'personal',
    maritalStatus: 'personal', notes: 'personal', biography: 'personal',
    nickName: 'personal', title: 'personal', birthOrder: 'personal',
    // Genealogical info
    tenHuy: 'personal', hieu: 'personal', tu: 'personal',
    chiName: 'personal', phanChi: 'personal',
    nganh: 'personal', phanNganh: 'personal',
    nhanh: 'personal', phanNhanh: 'personal',
    chucVu: 'personal', noiAnTang: 'personal', tho: 'personal',

    // Sensitive — hidden for guests, masked for members, full for admin
    phone: 'sensitive', email: 'sensitive',
    zalo: 'sensitive', facebook: 'sensitive',
    currentAddress: 'sensitive', hometown: 'sensitive',
    bloodType: 'sensitive',
};

/** Check if a field should be visible for a given tier */
export function isFieldVisible(fieldName: string, tier: AccessTier): boolean {
    const cat = FIELD_CATEGORIES[fieldName] || 'personal';
    if (tier === 'admin') return true;
    if (tier === 'member') return true; // visible but may be masked
    // guest
    return cat === 'basic';
}

/** Check if a field should be shown in masked form */
export function isFieldMasked(fieldName: string, tier: AccessTier): boolean {
    if (tier === 'admin') return false;
    const cat = FIELD_CATEGORIES[fieldName] || 'personal';
    if (tier === 'member' && cat === 'sensitive') return true;
    return false;
}

/** Mask a single field value */
export function maskFieldValue(fieldName: string, value: string | undefined | null): string {
    if (!value) return '';
    switch (fieldName) {
        case 'phone': return maskPhone(value);
        case 'email': return maskEmail(value);
        case 'zalo': return maskSocial(value);
        case 'facebook': return maskSocial(value);
        case 'currentAddress': return maskAddress(value);
        case 'hometown': return maskAddress(value);
        case 'bloodType': return '***';
        default: return value;
    }
}

// ─── Privacy notice constant ───
export const PRIVACY_LOGIN_MSG = 'Đăng nhập để xem thông tin';
export const PRIVACY_MASKED_LABEL = 'Thông tin đã được che khuyết';
