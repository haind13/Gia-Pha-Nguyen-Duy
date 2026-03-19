import { NextRequest, NextResponse } from 'next/server';
import { detectTenantFromHostname } from '@/lib/tenant';

/**
 * Multi-Tenant Middleware
 *
 * PATH-BASED routing (Vercel Free compatible):
 *   /g/{slug}/...           → set tenant cookie + rewrite to /...
 *   /g/{slug}/admin/...     → set tenant cookie + rewrite to /admin/...
 *   /superadmin/...         → superadmin (no tenant)
 *   /...                    → use tenant from cookie (or default)
 *
 * SUBDOMAIN routing (future VPS hosting):
 *   admin.giaphadaiviet.vn            → /superadmin/*
 *   cp.{slug}.giaphadaiviet.vn        → /admin/* + tenant slug
 *   {slug}.giaphadaiviet.vn           → public + tenant slug
 *   cp.{custom-domain}               → /admin/* + tenant domain
 *   {custom-domain}                   → public + tenant domain
 */

const TENANT_COOKIE = 'tenant_slug';

export function middleware(request: NextRequest) {
    const hostname = request.headers.get('host') ?? '';
    const { pathname } = request.nextUrl;

    // Skip static files and Next.js internals
    if (
        pathname.startsWith('/_next') ||
        pathname.startsWith('/api') ||
        pathname.startsWith('/favicon') ||
        pathname.includes('.')
    ) {
        return NextResponse.next();
    }

    // ── PATH-BASED ROUTING: /g/{slug}/... ──
    const pathMatch = pathname.match(/^\/g\/([a-z0-9-]+)(\/.*)?$/);
    if (pathMatch) {
        const slug = pathMatch[1];
        const remainingPath = pathMatch[2] || '/';

        const url = request.nextUrl.clone();
        url.pathname = remainingPath;

        const response = NextResponse.rewrite(url);
        // Set cookie so TenantProvider can read it client-side
        response.cookies.set(TENANT_COOKIE, slug, {
            path: '/',
            maxAge: 60 * 60 * 24 * 365, // 1 year
            sameSite: 'lax',
        });
        return response;
    }

    // ── SUBDOMAIN ROUTING (for future VPS hosting) ──
    const detection = detectTenantFromHostname(hostname);

    switch (detection.type) {
        case 'superadmin': {
            if (!pathname.startsWith('/superadmin') && !pathname.startsWith('/login')) {
                const url = request.nextUrl.clone();
                url.pathname = pathname === '/' ? '/superadmin' : `/superadmin${pathname}`;
                return NextResponse.rewrite(url);
            }
            return NextResponse.next();
        }

        case 'tenant_admin': {
            const response = NextResponse.next();
            response.cookies.set(TENANT_COOKIE, detection.slug, { path: '/', maxAge: 60 * 60 * 24 * 365, sameSite: 'lax' });
            if (!pathname.startsWith('/admin') && !pathname.startsWith('/login')) {
                const url = request.nextUrl.clone();
                url.pathname = pathname === '/' ? '/admin' : `/admin${pathname}`;
                return NextResponse.rewrite(url);
            }
            return response;
        }

        case 'tenant_public': {
            const response = NextResponse.next();
            response.cookies.set(TENANT_COOKIE, detection.slug, { path: '/', maxAge: 60 * 60 * 24 * 365, sameSite: 'lax' });
            return response;
        }

        case 'tenant_admin_custom': {
            if (!pathname.startsWith('/admin') && !pathname.startsWith('/login')) {
                const url = request.nextUrl.clone();
                url.pathname = pathname === '/' ? '/admin' : `/admin${pathname}`;
                return NextResponse.rewrite(url);
            }
            return NextResponse.next();
        }

        case 'tenant_public_custom':
            return NextResponse.next();

        case 'localhost': {
            if (detection.isAdmin && !pathname.startsWith('/admin') && !pathname.startsWith('/login')) {
                const url = request.nextUrl.clone();
                url.pathname = pathname === '/' ? '/admin' : `/admin${pathname}`;
                return NextResponse.rewrite(url);
            }
            return NextResponse.next();
        }

        default:
            return NextResponse.next();
    }
}

export const config = {
    matcher: ['/((?!_next/static|_next/image|favicon.ico).*)'],
};
