'use client';

import { ThemeProvider as NextThemesProvider } from 'next-themes';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { useState } from 'react';
import { AuthProvider } from '@/components/auth-provider';
import { TenantProvider } from '@/components/tenant-provider';

interface ProvidersProps {
    children: React.ReactNode;
    tenantSlug?: string | null;
    tenantDomain?: string | null;
}

export function Providers({ children, tenantSlug, tenantDomain }: ProvidersProps) {
    const [queryClient] = useState(
        () =>
            new QueryClient({
                defaultOptions: {
                    queries: {
                        staleTime: 60 * 1000,
                        retry: 1,
                    },
                },
            }),
    );

    return (
        <QueryClientProvider client={queryClient}>
            <NextThemesProvider attribute="class" defaultTheme="light" enableSystem disableTransitionOnChange>
                <TenantProvider tenantSlug={tenantSlug} tenantDomain={tenantDomain}>
                    <AuthProvider>{children}</AuthProvider>
                </TenantProvider>
            </NextThemesProvider>
        </QueryClientProvider>
    );
}
