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

        // Get cover photo URLs for albums that have cover_photo_id set
        const coverIds = (albums || []).map(a => a.cover_photo_id).filter(Boolean);
        const coverMap = new Map<string, string>();
        if (coverIds.length > 0) {
            const { data: covers } = await supabase
                .from('media')
                .select('id, thumbnail_url, r2_key')
                .in('id', coverIds);
            for (const c of covers || []) {
                const url = c.r2_key
                    ? `${process.env.NEXT_PUBLIC_R2_URL || ''}/cdn-cgi/image/width=400,quality=80,fit=cover,format=auto/${c.r2_key}`
                    : c.thumbnail_url;
                if (url) coverMap.set(c.id, url);
            }
        }

        // Get photo counts per album
        const { data: counts } = await supabase
            .from('media')
            .select('album_id')
            .eq('state', 'PUBLISHED')
            .not('album_id', 'is', null);

        const countMap = new Map<string, number>();
        for (const row of counts || []) {
            if (row.album_id) {
                countMap.set(row.album_id, (countMap.get(row.album_id) || 0) + 1);
            }
        }

        const result = (albums || []).map(album => ({
            id: album.id,
            title: album.title,
            description: album.description,
            coverUrl: coverMap.get(album.cover_photo_id) || null,
            photoCount: countMap.get(album.id) || 0,
            createdAt: album.created_at,
        }));

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
