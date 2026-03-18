import { NextRequest, NextResponse } from 'next/server';
import { getFromR2 } from '@/lib/r2';

/**
 * GET /api/media/image?key=photos/xxx/yyy.jpg
 * Proxy route to serve R2 images (bypasses 401 if public access is not enabled)
 * Cached for 1 year with immutable (content-addressed keys)
 */
export async function GET(req: NextRequest) {
    const key = req.nextUrl.searchParams.get('key');
    if (!key) {
        return NextResponse.json({ error: 'Missing key param' }, { status: 400 });
    }

    try {
        const { body, contentType } = await getFromR2(key);
        if (!body) {
            return NextResponse.json({ error: 'Not found' }, { status: 404 });
        }

        return new NextResponse(body, {
            headers: {
                'Content-Type': contentType,
                'Cache-Control': 'public, max-age=31536000, immutable',
            },
        });
    } catch (err: any) {
        console.error('Image proxy error:', err.message);
        return NextResponse.json({ error: 'Not found' }, { status: 404 });
    }
}
