import { NextRequest, NextResponse } from 'next/server';
import { createServiceClient } from '@/lib/supabase';
import { createAlbumFolder, isConfigured } from '@/lib/onedrive';

/**
 * GET /api/media/albums — List all albums with photo counts
 */
export async function GET() {
    try {
        const supabase = createServiceClient();

        const { data: albums, error } = await supabase
            .from('albums')
            .select(`
                id, title, description, cover_photo_id, onedrive_folder_id,
                created_at, updated_at,
                cover:media!albums_cover_photo_id_fkey(thumbnail_url)
            `)
            .order('created_at', { ascending: false });

        if (error) throw error;

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
            coverUrl: (album.cover as any)?.thumbnail_url || null,
            photoCount: countMap.get(album.id) || 0,
            createdAt: album.created_at,
        }));

        return NextResponse.json(result);
    } catch (err: any) {
        return NextResponse.json({ error: err.message }, { status: 500 });
    }
}

/**
 * POST /api/media/albums — Create a new album (+ OneDrive folder)
 */
export async function POST(req: NextRequest) {
    try {
        const { title, description } = await req.json();
        if (!title) return NextResponse.json({ error: 'Title required' }, { status: 400 });

        const supabase = createServiceClient();

        // Create folder on OneDrive
        let onedriveFolderId: string | null = null;
        if (isConfigured()) {
            const folder = await createAlbumFolder(title);
            onedriveFolderId = folder.id;
        }

        // Create album in Supabase
        const { data, error } = await supabase
            .from('albums')
            .insert({
                title,
                description: description || '',
                onedrive_folder_id: onedriveFolderId,
            })
            .select('id, title, description, created_at')
            .single();

        if (error) throw error;

        return NextResponse.json(data, { status: 201 });
    } catch (err: any) {
        return NextResponse.json({ error: err.message }, { status: 500 });
    }
}
