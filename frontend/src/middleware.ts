import { NextRequest, NextResponse } from 'next/server';
import { detectTenantFromHostname } from '@/lib/tenant';

/**
 * Multi-Tenant Middleware
 *
 * Routing:
 *   admin.giaphadaiviet.vn            → /superadmin/*   (x-tenant-type: superadmin)
 *   cp.{slug}.giaphadaiviet.vn        → /admin/*        (x-tenant-slug: {slug})
 *   {slug}.giaphadaiviet.vn           → public          (x-tenant-slug: {slug})
 *   cp.{custom-domain}               → /admin/*        (x-tenant-domain: {domain})
 *   {custom-domain}                   → public          (x-tenant-domain: {domain})
 *   localhost / cp.localhost           → dev fallback
 */
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

    const detection = detectTenantFromHostname(hostname);
    const response = NextResponse.next();

    switch (detection.type) {
        case 'superadmin': {
            // admin.giaphadaiviet.vn → rewrite to /superadmin/*
            response.headers.set('x-tenant-type', 'superadmin');
            if (!pathname.startsWith('/superadmin') && !pathname.startsWith('/login')) {
                const url = request.nextUrl.clone();
                url.pathname = pathname === '/' ? '/superadmin' : `/superadmin${pathname}`;
                return NextResponse.rewrite(url, { headers: response.headers });
            }
            return response;
        }

        case 'tenant_admin': {
            // cp.{slug}.giaphadaiviet.vn → rewrite to /admin/*
            response.headers.set('x-tenant-slug', detection.slug);
            response.headers.set('x-tenant-type', 'admin');
            if (!pathname.startsWith('/admin') && !pathname.startsWith('/login')) {
                const url = request.nextUrl.clone();
                url.pathname = pathname === '/' ? '/admin' : `/admin${pathname}`;
                return NextResponse.rewrite(url, { headers: response.headers });
            }
            return response;
        }

        case 'tenant_admin_custom': {
            // cp.{custom-domain} → rewrite to /admin/*
            response.headers.set('x-tenant-domain', detection.domain);
            response.headers.set('x-tenant-type', 'admin');
            if (!pathname.startsWith('/admin') && !pathname.startsWith('/login')) {
                const url = request.nextUrl.clone();
                url.pathname = pathname === '/' ? '/admin' : `/admin${pathname}`;
                return NextResponse.rewrite(url, { headers: response.headers });
            }
            return response;
        }

        case 'tenant_public': {
            // {slug}.giaphadaiviet.vn → public site
            response.headers.set('x-tenant-slug', detection.slug);
            response.headers.set('x-tenant-type', 'public');
            return response;
        }

        case 'tenant_public_custom': {
            // {custom-domain} → public site
            response.headers.set('x-tenant-domain', detection.domain);
            response.headers.set('x-tenant-type', 'public');
            return response;
        }

        case 'localhost': {
            // Development mode
            response.headers.set('x-tenant-type', detection.isAdmin ? 'admin' : 'public');
            if (detection.isAdmin && !pathname.startsWith('/admin') && !pathname.startsWith('/login')) {
                const url = request.nextUrl.clone();
                url.pathname = pathname === '/' ? '/admin' : `/admin${pathname}`;
                return NextResponse.rewrite(url, { headers: response.headers });
            }
            return response;
        }

        default:
            return response;
    }
}

export const config = {
    matcher: ['/((?!_next/static|_next/image|favicon.ico).*)'],
};
