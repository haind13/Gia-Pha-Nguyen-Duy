/**
 * Tenant utilities for multi-tenant SaaS
 * Resolves tenant from hostname, provides helpers for tenant-scoped queries
 */

export interface Tenant {
    id: string;
    slug: string;
    name: string;
    description: string | null;
    custom_domain: string | null;
    tree_id: string | null;
    plan: string;
    max_members: number;
    max_admins: number;
    max_storage_gb: number;
    is_active: boolean;
    expires_at: string | null;
    created_at: string;
}

export interface SiteConfig {
    id: string;
    tenant_id: string;
    site_name: string | null;
    description: string | null;
    introduction: string | null;
    logo_url: string | null;
    favicon_url: string | null;
    banner_url: string | null;
    google_map_url: string | null;
    facebook_url: string | null;
    youtube_url: string | null;
    zalo_url: string | null;
    theme_color: string;
}

export interface TenantMember {
    id: string;
    tenant_id: string;
    user_id: string;
    role: 'admin' | 'editor' | 'viewer' | 'member';
    created_at: string;
}

export interface Plan {
    id: string;
    name: string;
    price_yearly: number;
    max_members: number;
    max_admins: number;
    max_storage_gb: number;
    features: string[];
    sort_order: number;
    is_active: boolean;
}

/**
 * Base domain for the SaaS platform
 */
export const PLATFORM_DOMAIN = 'giaphadaiviet.vn';
export const SUPERADMIN_HOST = `admin.${PLATFORM_DOMAIN}`;

/**
 * Detect tenant context from hostname
 */
export type TenantDetection =
    | { type: 'superadmin' }
    | { type: 'tenant_admin'; slug: string }
    | { type: 'tenant_admin_custom'; domain: string }
    | { type: 'tenant_public'; slug: string }
    | { type: 'tenant_public_custom'; domain: string }
    | { type: 'localhost'; isAdmin: boolean }
    | { type: 'unknown' };

export function detectTenantFromHostname(hostname: string): TenantDetection {
    // Remove port
    const host = hostname.split(':')[0];

    // 1. Superadmin: admin.giaphadaiviet.vn
    if (host === SUPERADMIN_HOST) {
        return { type: 'superadmin' };
    }

    // 2. Tenant admin via platform subdomain: cp.{slug}.giaphadaiviet.vn
    const cpPlatformMatch = host.match(new RegExp(`^cp\\.([a-z0-9-]+)\\.${PLATFORM_DOMAIN.replace('.', '\\.')}$`));
    if (cpPlatformMatch) {
        return { type: 'tenant_admin', slug: cpPlatformMatch[1] };
    }

    // 3. Tenant public via platform subdomain: {slug}.giaphadaiviet.vn
    const publicPlatformMatch = host.match(new RegExp(`^([a-z0-9-]+)\\.${PLATFORM_DOMAIN.replace('.', '\\.')}$`));
    if (publicPlatformMatch && publicPlatformMatch[1] !== 'admin' && publicPlatformMatch[1] !== 'www') {
        return { type: 'tenant_public', slug: publicPlatformMatch[1] };
    }

    // 4. Custom domain: cp.{domain} → tenant admin
    if (host.startsWith('cp.') && !host.endsWith(PLATFORM_DOMAIN)) {
        const domain = host.replace(/^cp\./, '');
        return { type: 'tenant_admin_custom', domain };
    }

    // 5. Custom domain (not platform) → tenant public
    if (!host.endsWith(PLATFORM_DOMAIN) && host !== 'localhost' && !host.startsWith('cp.localhost')) {
        return { type: 'tenant_public_custom', domain: host };
    }

    // 6. Localhost development
    if (host === 'localhost' || host === '127.0.0.1') {
        return { type: 'localhost', isAdmin: false };
    }
    if (host === 'cp.localhost') {
        return { type: 'localhost', isAdmin: true };
    }

    return { type: 'unknown' };
}

/**
 * Check if a plan allows more members
 */
export function canAddMembers(currentCount: number, maxMembers: number): boolean {
    if (maxMembers === -1) return true; // unlimited
    return currentCount < maxMembers;
}

/**
 * Check if a plan allows more admins
 */
export function canAddAdmins(currentCount: number, maxAdmins: number): boolean {
    return currentCount < maxAdmins;
}

/**
 * Format storage usage
 */
export function formatStorage(usedBytes: number, maxGb: number): string {
    const usedGb = usedBytes / (1024 * 1024 * 1024);
    if (maxGb === -1) return `${usedGb.toFixed(2)} GB / Không giới hạn`;
    return `${usedGb.toFixed(2)} GB / ${maxGb} GB`;
}

/**
 * Format plan price for display
 */
export function formatPlanPrice(priceYearly: number): string {
    if (priceYearly === 0) return 'Miễn phí';
    return `${priceYearly.toLocaleString('vi-VN')}đ/năm`;
}
