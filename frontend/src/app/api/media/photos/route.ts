import { NextRequest, NextResponse } from 'next/server';
import { createServiceClient } from '@/lib/supabase';
import { uploadPhoto, isConfigured as isOnedriveConfigured } from '@/lib/onedrive';
import { uploadToR2, isR2Configured, generateR2Key, getR2PublicUrl } from '@/lib/r2';

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
            .select('id, file_name, title, description, thumbnail_url, onedrive_url, r2_key, r2_url, storage_provider, width, height, state, album_id, created_at, uploader_id', { count: 'exact' })
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
 * Expects multipart form data: file(s) + albumId + dimensions (JSON)
 * Uploads to Cloudflare R2 (primary) or OneDrive (fallback)
 */
export async function POST(req: NextRequest) {
    try {
        const formData = await req.formData();
        const files = formData.getAll('files') as File[];
        const albumId = formData.get('albumId') as string | null;
        const dimensionsStr = formData.get('dimensions') as string | null;
        const dimensions: { width: number; height: number }[] = dimensionsStr
            ? JSON.parse(dimensionsStr)
            : [];

        if (!files.length) {
            return NextResponse.json({ error: 'No files provided' }, { status: 400 });
        }

        const supabase = createServiceClient();
        const useR2 = isR2Configured();
        const uploaded = [];

        for (let i = 0; i < files.length; i++) {
            const file = files[i];
            const buffer = new Uint8Array(await file.arrayBuffer());
            const dim = dimensions[i] || null;

            let r2Key: string | null = null;
            let r2Url: string | null = null;
            let onedriveItemId: string | null = null;
            let onedriveUrl: string | null = null;
            let thumbnailUrl: string | null = null;
            let width: number | null = dim?.width || null;
            let height: number | null = dim?.height || null;
            let storageProvider: 'r2' | 'onedrive' = 'r2';

            if (useR2) {
                // ── Upload to Cloudflare R2 ──
                r2Key = generateR2Key(albumId, file.name);
                await uploadToR2(r2Key, buffer, file.type);
                r2Url = getR2PublicUrl(r2Key);
            } else if (isOnedriveConfigured()) {
                // ── Fallback: Upload to OneDrive ──
                storageProvider = 'onedrive';
                let onedriveFolderId: string | null = null;
                if (albumId) {
                    const { data: album } = await supabase
                        .from('albums')
                        .select('onedrive_folder_id')
                        .eq('id', albumId)
                        .single();
                    onedriveFolderId = album?.onedrive_folder_id || null;
                }

                if (onedriveFolderId) {
                    const fileName = `${Date.now()}_${file.name}`;
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
            }

            // Insert into Supabase
            const { data, error } = await supabase
                .from('media')
                .insert({
                    file_name: file.name,
                    mime_type: file.type,
                    file_size: file.size,
                    album_id: albumId,
                    r2_key: r2Key,
                    r2_url: r2Url,
                    storage_provider: storageProvider,
                    onedrive_item_id: onedriveItemId,
                    onedrive_url: onedriveUrl,
                    thumbnail_url: thumbnailUrl,
                    width,
                    height,
                    state: 'PUBLISHED',
                })
                .select('id, file_name, thumbnail_url, r2_url, state')
                .single();

            if (!error && data) uploaded.push(data);
        }

        return NextResponse.json({ uploaded, count: uploaded.length }, { status: 201 });
    } catch (err: any) {
        console.error('Upload error:', err);
        return NextResponse.json({ error: err.message }, { status: 500 });
    }
}
