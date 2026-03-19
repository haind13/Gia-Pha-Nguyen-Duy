import { NextRequest, NextResponse } from 'next/server';

/**
 * Middleware: rewrite requests from cp.donghonguyenduy-langnghin.asia → /admin/*
 * e.g.  cp.donghonguyenduy-langnghin.asia/         → /admin
 *       cp.donghonguyenduy-langnghin.asia/users     → /admin/users
 *       cp.donghonguyenduy-langnghin.asia/thong-ke  → /admin/thong-ke
 */
const CP_HOSTNAMES = [
    'cp.donghonguyenduy-langnghin.asia',
    'cp.localhost', // local dev
];

export function middleware(request: NextRequest) {
    const hostname = request.headers.get('host')?.split(':')[0] ?? '';

    // Only rewrite for cp subdomain
    if (!CP_HOSTNAMES.includes(hostname)) {
        return NextResponse.next();
    }

    const { pathname } = request.nextUrl;

    // Already on /admin path — pass through
    if (pathname.startsWith('/admin')) {
        return NextResponse.next();
    }

    // Skip Next.js internals and static files
    if (
        pathname.startsWith('/_next') ||
        pathname.startsWith('/api') ||
        pathname.startsWith('/favicon') ||
        pathname.includes('.')
    ) {
        return NextResponse.next();
    }

    // Rewrite / → /admin, /users → /admin/users, etc.
    const adminPath = pathname === '/' ? '/admin' : `/admin${pathname}`;
    const url = request.nextUrl.clone();
    url.pathname = adminPath;
    return NextResponse.rewrite(url);
}

export const config = {
    matcher: ['/((?!_next/static|_next/image|favicon.ico).*)'],
};
