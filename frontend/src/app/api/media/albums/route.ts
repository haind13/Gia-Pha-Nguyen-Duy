import { NextRequest, NextResponse } from 'next/server';
import { createServiceClient } from '@/lib/supabase';

/**
 * GET /api/media/albums — List all albums with photo counts
 */
export async function GET() {
    try {
        const supabase = createServiceClient();

        const { data: albums, error } = await supabase
            .from('albums')
            .select('id, title, description, cover_photo_id, created_at, updated_at')
            .order('created_at', { ascending: false });

        if (error) throw error;

        // Get all published photos with album_id (for counts + auto-cover)
        const { data: albumPhotos } = await supabase
            .from('media')
            .select('id, album_id, r2_key, thumbnail_url, created_at')
            .eq('state', 'PUBLISHED')
            .not('album_id', 'is', null)
            .order('created_at', { ascending: true });

        // Build count map and first-photo map per album
        const countMap = new Map<string, number>();
        const firstPhotoMap = new Map<string, { r2_key: string | null; thumbnail_url: string | null; id: string }>();
        for (const p of albumPhotos || []) {
            if (!p.album_id) continue;
            countMap.set(p.album_id, (countMap.get(p.album_id) || 0) + 1);
            if (!firstPhotoMap.has(p.album_id)) {
                firstPhotoMap.set(p.album_id, { r2_key: p.r2_key, thumbnail_url: p.thumbnail_url, id: p.id });
            }
        }

        // Get explicit cover photo URLs
        const coverIds = (albums || []).map(a => a.cover_photo_id).filter(Boolean);
        const coverMap = new Map<string, string>();
        if (coverIds.length > 0) {
            const { data: covers } = await supabase
                .from('media')
                .select('id, thumbnail_url, r2_key')
                .in('id', coverIds);
            for (const c of covers || []) {
                const url = c.r2_key
                    ? `/api/media/image?key=${encodeURIComponent(c.r2_key)}`
                    : c.thumbnail_url;
                if (url) coverMap.set(c.id, url);
            }
        }

        const result = (albums || []).map(album => {
            // Explicit cover > first photo in album > null
            let coverUrl = coverMap.get(album.cover_photo_id) || null;
            if (!coverUrl) {
                const first = firstPhotoMap.get(album.id);
                if (first) {
                    coverUrl = first.r2_key
                        ? `/api/media/image?key=${encodeURIComponent(first.r2_key)}`
                        : first.thumbnail_url || null;
                }
            }
            return {
                id: album.id,
                title: album.title,
                description: album.description,
                coverUrl,
                photoCount: countMap.get(album.id) || 0,
                createdAt: album.created_at,
            };
        });

        return NextResponse.json(result);
    } catch (err: any) {
        return NextResponse.json({ error: err.message }, { status: 500 });
    }
}

/**
 * POST /api/media/albums — Create a new album
 */
export async function POST(req: NextRequest) {
    try {
        const { title, description } = await req.json();
        if (!title) return NextResponse.json({ error: 'Title required' }, { status: 400 });

        const supabase = createServiceClient();

        const { data, error } = await supabase
            .from('albums')
            .insert({
                title,
                description: description || '',
            })
            .select('id, title, description, created_at')
            .single();

        if (error) throw error;

        return NextResponse.json(data, { status: 201 });
    } catch (err: any) {
        return NextResponse.json({ error: err.message }, { status: 500 });
    }
}
