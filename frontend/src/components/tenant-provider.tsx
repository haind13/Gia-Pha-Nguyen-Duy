'use client';

import { createContext, useContext, useEffect, useState, useCallback, type ReactNode } from 'react';
import { supabase } from '@/lib/supabase';
import type { Tenant, SiteConfig } from '@/lib/tenant';

interface TenantContextValue {
    tenant: Tenant | null;
    siteConfig: SiteConfig | null;
    treeId: string | null;
    loading: boolean;
    error: string | null;
    refetchConfig: () => Promise<void>;
}

const TenantContext = createContext<TenantContextValue | null>(null);

/**
 * TenantProvider resolves the current tenant from:
 * 1. x-tenant-slug header (set by middleware for subdomain routing)
 * 2. x-tenant-domain header (set by middleware for custom domain routing)
 * 3. Fallback: first active tenant (development mode)
 */
export function TenantProvider({ children, tenantSlug, tenantDomain }: {
    children: ReactNode;
    tenantSlug?: string | null;
    tenantDomain?: string | null;
}) {
    const [tenant, setTenant] = useState<Tenant | null>(null);
    const [siteConfig, setSiteConfig] = useState<SiteConfig | null>(null);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);

    const fetchTenant = useCallback(async () => {
        try {
            let tenantData: Tenant | null = null;

            if (tenantSlug) {
                // Resolve by slug
                const { data, error: err } = await supabase
                    .from('tenants')
                    .select('*')
                    .eq('slug', tenantSlug)
                    .eq('is_active', true)
                    .maybeSingle();
                if (err) throw err;
                tenantData = data;
            } else if (tenantDomain) {
                // Resolve by custom domain
                const { data, error: err } = await supabase
                    .from('tenants')
                    .select('*')
                    .eq('custom_domain', tenantDomain)
                    .eq('is_active', true)
                    .maybeSingle();
                if (err) throw err;
                tenantData = data;
            } else {
                // Fallback: first active tenant (dev mode)
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
                setError('Không tìm thấy gia phả');
                setLoading(false);
                return;
            }

            setTenant(tenantData);

            // Fetch site config
            const { data: configData } = await supabase
                .from('site_config')
                .select('*')
                .eq('tenant_id', tenantData.id)
                .maybeSingle();

            setSiteConfig(configData);
            setError(null);
        } catch (e) {
            console.error('Failed to load tenant:', e);
            setError('Lỗi tải thông tin gia phả');
        }
        setLoading(false);
    }, [tenantSlug, tenantDomain]);

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

    return (
        <TenantContext.Provider value={{ tenant, siteConfig, treeId, loading, error, refetchConfig }}>
            {children}
        </TenantContext.Provider>
    );
}

export function useTenant() {
    const ctx = useContext(TenantContext);
    if (!ctx) throw new Error('useTenant must be used within TenantProvider');
    return ctx;
}

/**
 * Hook to get tree_id for data queries.
 * Returns null if tenant not loaded yet.
 */
export function useTenantTreeId(): string | null {
    const { treeId } = useTenant();
    return treeId;
}
