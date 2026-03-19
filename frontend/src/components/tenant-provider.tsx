'use client';

import { createContext, useContext, useEffect, useState, useCallback, type ReactNode } from 'react';
import { supabase } from '@/lib/supabase';
import type { Tenant, SiteConfig } from '@/lib/tenant';

const TENANT_COOKIE = 'tenant_slug';

interface TenantContextValue {
    tenant: Tenant | null;
    siteConfig: SiteConfig | null;
    treeId: string | null;
    tenantSlug: string | null;
    loading: boolean;
    error: string | null;
    refetchConfig: () => Promise<void>;
    /** Build a path with tenant prefix: /g/{slug}/path */
    tenantPath: (path: string) => string;
}

const TenantContext = createContext<TenantContextValue | null>(null);

/** Read tenant_slug cookie from document.cookie */
function getTenantSlugFromCookie(): string | null {
    if (typeof document === 'undefined') return null;
    const match = document.cookie.match(new RegExp(`(?:^|; )${TENANT_COOKIE}=([^;]*)`));
    return match ? decodeURIComponent(match[1]) : null;
}

/**
 * TenantProvider resolves the current tenant from:
 * 1. Explicit tenantSlug prop (from parent or server)
 * 2. Cookie `tenant_slug` (set by middleware for /g/{slug} path routing)
 * 3. URL path: detect /g/{slug} in current URL
 * 4. Fallback: first active tenant (development / single-tenant mode)
 */
export function TenantProvider({ children, tenantSlug: propSlug, tenantDomain }: {
    children: ReactNode;
    tenantSlug?: string | null;
    tenantDomain?: string | null;
}) {
    const [tenant, setTenant] = useState<Tenant | null>(null);
    const [siteConfig, setSiteConfig] = useState<SiteConfig | null>(null);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);
    const [resolvedSlug, setResolvedSlug] = useState<string | null>(propSlug ?? null);

    // Resolve slug from multiple sources
    useEffect(() => {
        if (propSlug) {
            setResolvedSlug(propSlug);
            return;
        }
        // Try URL path first
        if (typeof window !== 'undefined') {
            const pathMatch = window.location.pathname.match(/^\/g\/([a-z0-9-]+)/);
            if (pathMatch) {
                setResolvedSlug(pathMatch[1]);
                return;
            }
        }
        // Try cookie
        const cookieSlug = getTenantSlugFromCookie();
        if (cookieSlug) {
            setResolvedSlug(cookieSlug);
            return;
        }
        // null = use fallback (first active tenant)
        setResolvedSlug(null);
    }, [propSlug]);

    const fetchTenant = useCallback(async () => {
        try {
            let tenantData: Tenant | null = null;

            if (resolvedSlug) {
                const { data, error: err } = await supabase
                    .from('tenants')
                    .select('*')
                    .eq('slug', resolvedSlug)
                    .eq('is_active', true)
                    .maybeSingle();
                if (err) throw err;
                tenantData = data;
            } else if (tenantDomain) {
                const { data, error: err } = await supabase
                    .from('tenants')
                    .select('*')
                    .eq('custom_domain', tenantDomain)
                    .eq('is_active', true)
                    .maybeSingle();
                if (err) throw err;
                tenantData = data;
            } else {
                // Fallback: first active tenant
                const { data, error: err } = await supabase
                    .from('tenants')
                    .select('*')
                    .eq('is_active', true)
                    .order('created_at', { ascending: true })
                    .limit(1)
                    .maybeSingle();
                if (err) throw err;
                tenantData = data;
            }

            if (!tenantData) {
                // No tenant found — not an error in single-tenant mode, just no multi-tenant data yet
                setError(null);
                setLoading(false);
                return;
            }

            setTenant(tenantData);

            const { data: configData } = await supabase
                .from('site_config')
                .select('*')
                .eq('tenant_id', tenantData.id)
                .maybeSingle();

            setSiteConfig(configData);
            setError(null);
        } catch (e) {
            console.error('Failed to load tenant:', e);
            // Don't block the app if tenants table doesn't exist yet
            setError(null);
        }
        setLoading(false);
    }, [resolvedSlug, tenantDomain]);

    const refetchConfig = useCallback(async () => {
        if (!tenant) return;
        const { data } = await supabase
            .from('site_config')
            .select('*')
            .eq('tenant_id', tenant.id)
            .maybeSingle();
        if (data) setSiteConfig(data);
    }, [tenant]);

    useEffect(() => {
        fetchTenant();
    }, [fetchTenant]);

    const treeId = tenant?.tree_id ?? null;
    const tenantSlug = tenant?.slug ?? resolvedSlug;

    /** Build a URL path with tenant prefix for path-based routing */
    const tenantPath = useCallback((path: string) => {
        if (!tenantSlug) return path;
        // If we're on a subdomain, don't add prefix
        if (typeof window !== 'undefined') {
            const host = window.location.hostname;
            if (host !== 'localhost' && host !== '127.0.0.1' && !host.includes('vercel.app') && !host.includes('giaphadaiviet.vn')) {
                // Custom domain — no prefix needed
                return path;
            }
        }
        const cleanPath = path.startsWith('/') ? path : `/${path}`;
        return `/g/${tenantSlug}${cleanPath}`;
    }, [tenantSlug]);

    return (
        <TenantContext.Provider value={{
            tenant, siteConfig, treeId, tenantSlug, loading, error, refetchConfig, tenantPath,
        }}>
            {children}
        </TenantContext.Provider>
    );
}

export function useTenant() {
    const ctx = useContext(TenantContext);
    if (!ctx) throw new Error('useTenant must be used within TenantProvider');
    return ctx;
}

export function useTenantTreeId(): string | null {
    const { treeId } = useTenant();
    return treeId;
}
