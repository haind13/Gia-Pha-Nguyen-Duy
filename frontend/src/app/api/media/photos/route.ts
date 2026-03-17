import { NextRequest, NextResponse } from 'next/server';
import { createServiceClient } from '@/lib/supabase';
import { uploadPhoto, isConfigured } from '@/lib/onedrive';

/**
 * GET /api/media/photos — List photos (paginated)
 * Query params: albumId, state, page, limit
 */
export async function GET(req: NextRequest) {
    try {
        const { searchParams } = new URL(req.url);
        const albumId = searchParams.get('albumId');
        const state = searchParams.get('state') || 'PUBLISHED';
        const page = parseInt(searchParams.get('page') || '1');
        const limit = parseInt(searchParams.get('limit') || '30');
        const offset = (page - 1) * limit;

        const supabase = createServiceClient();

        let query = supabase
            .from('media')
            .select('id, file_name, title, description, thumbnail_url, onedrive_url, width, height, state, album_id, created_at, uploader:profiles(display_name)', { count: 'exact' })
            .order('created_at', { ascending: false })
            .range(offset, offset + limit - 1);

        if (albumId) query = query.eq('album_id', albumId);
        if (state !== 'all') query = query.eq('state', state);

        // Only return image types
        query = query.like('mime_type', 'image/%');

        const { data, error, count } = await query;
        if (error) throw error;

        return NextResponse.json({
            photos: data || [],
            total: count || 0,
            page,
            limit,
            hasMore: (count || 0) > offset + limit,
        });
    } catch (err: any) {
        return NextResponse.json({ error: err.message }, { status: 500 });
    }
}

/**
 * POST /api/media/photos — Upload photo(s)
 * Expects multipart form data: file(s) + albumId
 */
export async function POST(req: NextRequest) {
    try {
        const formData = await req.formData();
        const files = formData.getAll('files') as File[];
        const albumId = formData.get('albumId') as string | null;

        if (!files.length) {
            return NextResponse.json({ error: 'No files provided' }, { status: 400 });
        }

        const supabase = createServiceClient();

        // Get album's OneDrive folder ID
        let onedriveFolderId: string | null = null;
        if (albumId) {
            const { data: album } = await supabase
                .from('albums')
                .select('onedrive_folder_id')
                .eq('id', albumId)
                .single();
            onedriveFolderId = album?.onedrive_folder_id || null;
        }

        const uploaded = [];

        for (const file of files) {
            const buffer = new Uint8Array(await file.arrayBuffer());
            const fileName = `${Date.now()}_${file.name}`;

            let onedriveItemId: string | null = null;
            let onedriveUrl: string | null = null;
            let thumbnailUrl: string | null = null;
            let width: number | null = null;
            let height: number | null = null;

            // Upload to OneDrive
            if (isConfigured() && onedriveFolderId) {
                const item = await uploadPhoto(onedriveFolderId, fileName, buffer, file.type);
                onedriveItemId = item.id;
                onedriveUrl = item['@microsoft.graph.downloadUrl'] || item.webUrl;
                if (item.image) {
                    width = item.image.width;
                    height = item.image.height;
                }
                if (item.thumbnails?.[0]) {
                    thumbnailUrl = item.thumbnails[0].medium?.url || item.thumbnails[0].large?.url || '';
                }
            }

            // Insert into Supabase
            const { data, error } = await supabase
                .from('media')
                .insert({
                    file_name: file.name,
                    mime_type: file.type,
                    file_size: file.size,
                    album_id: albumId,
                    onedrive_item_id: onedriveItemId,
                    onedrive_url: onedriveUrl,
                    thumbnail_url: thumbnailUrl,
                    width,
                    height,
                    state: 'PENDING',
                })
                .select('id, file_name, thumbnail_url, state')
                .single();

            if (!error && data) uploaded.push(data);
        }

        return NextResponse.json({ uploaded, count: uploaded.length }, { status: 201 });
    } catch (err: any) {
        console.error('Upload error:', err);
        return NextResponse.json({ error: err.message }, { status: 500 });
    }
}
