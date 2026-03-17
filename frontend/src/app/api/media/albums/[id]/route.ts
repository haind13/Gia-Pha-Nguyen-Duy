import { NextRequest, NextResponse } from 'next/server';
import { createServiceClient } from '@/lib/supabase';
import { deleteItem, isConfigured } from '@/lib/onedrive';

/**
 * GET /api/media/albums/[id] — Get album with its photos
 */
export async function GET(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
    try {
        const { id } = await params;
        const supabase = createServiceClient();

        const [albumRes, photosRes] = await Promise.all([
            supabase.from('albums').select('*').eq('id', id).single(),
            supabase.from('media')
                .select('id, file_name, title, thumbnail_url, onedrive_url, width, height, created_at, state')
                .eq('album_id', id)
                .eq('state', 'PUBLISHED')
                .order('created_at', { ascending: false }),
        ]);

        if (albumRes.error) throw albumRes.error;

        return NextResponse.json({
            album: albumRes.data,
            photos: photosRes.data || [],
        });
    } catch (err: any) {
        return NextResponse.json({ error: err.message }, { status: 500 });
    }
}

/**
 * DELETE /api/media/albums/[id] — Delete album (+ OneDrive folder)
 */
export async function DELETE(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
    try {
        const { id } = await params;
        const supabase = createServiceClient();

        // Get album info
        const { data: album } = await supabase.from('albums').select('onedrive_folder_id').eq('id', id).single();

        // Delete from OneDrive
        if (album?.onedrive_folder_id && isConfigured()) {
            try { await deleteItem(album.onedrive_folder_id); } catch { /* folder may not exist */ }
        }

        // Nullify album_id on media rows (don't delete photos)
        await supabase.from('media').update({ album_id: null }).eq('album_id', id);

        // Delete album
        const { error } = await supabase.from('albums').delete().eq('id', id);
        if (error) throw error;

        return NextResponse.json({ success: true });
    } catch (err: any) {
        return NextResponse.json({ error: err.message }, { status: 500 });
    }
}
