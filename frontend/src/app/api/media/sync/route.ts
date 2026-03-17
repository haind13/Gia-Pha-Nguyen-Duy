import { NextResponse } from 'next/server';
import { createServiceClient } from '@/lib/supabase';
import {
    listAlbumFolders,
    listPhotosInFolder,
    getThumbnailUrls,
    isConfigured,
    type OneDriveItem,
} from '@/lib/onedrive';

/**
 * POST /api/media/sync
 * Sync OneDrive folders/photos → Supabase albums/media tables
 * Admin only operation
 */
export async function POST() {
    if (!isConfigured()) {
        return NextResponse.json({ error: 'OneDrive not configured' }, { status: 500 });
    }

    try {
        const supabase = createServiceClient();

        // 1. Get all folders from OneDrive
        const folders = await listAlbumFolders();

        // 2. Get existing albums from DB
        const { data: existingAlbums } = await supabase
            .from('albums')
            .select('id, onedrive_folder_id, title');

        const albumMap = new Map(
            (existingAlbums || []).map(a => [a.onedrive_folder_id, a])
        );

        let albumsSynced = 0;
        let photosSynced = 0;

        // 3. Sync each folder as album
        for (const folder of folders) {
            let albumId: string;

            if (albumMap.has(folder.id)) {
                // Album exists, use existing ID
                albumId = albumMap.get(folder.id)!.id;
                // Update title if changed
                if (albumMap.get(folder.id)!.title !== folder.name) {
                    await supabase.from('albums').update({ title: folder.name, updated_at: new Date().toISOString() }).eq('id', albumId);
                }
            } else {
                // New folder → create album
                const { data: newAlbum, error } = await supabase
                    .from('albums')
                    .insert({
                        title: folder.name,
                        onedrive_folder_id: folder.id,
                    })
                    .select('id')
                    .single();

                if (error || !newAlbum) continue;
                albumId = newAlbum.id;
                albumsSynced++;
            }

            // 4. Sync photos in this folder
            const photos = await listPhotosInFolder(folder.id);
            const { data: existingMedia } = await supabase
                .from('media')
                .select('id, onedrive_item_id')
                .eq('album_id', albumId);

            const mediaMap = new Set(
                (existingMedia || []).map(m => m.onedrive_item_id)
            );

            for (const photo of photos) {
                if (mediaMap.has(photo.id)) continue;

                const thumbs = getThumbnailUrls(photo);
                const downloadUrl = photo['@microsoft.graph.downloadUrl'] || '';

                const { error } = await supabase.from('media').insert({
                    file_name: photo.name,
                    mime_type: photo.file?.mimeType || 'image/jpeg',
                    file_size: photo.size,
                    storage_path: photo.webUrl,
                    album_id: albumId,
                    onedrive_item_id: photo.id,
                    onedrive_url: downloadUrl,
                    thumbnail_url: thumbs.medium || thumbs.large || '',
                    width: photo.image?.width,
                    height: photo.image?.height,
                    state: 'PUBLISHED',
                });

                if (!error) photosSynced++;
            }

            // Set cover photo for album if not set
            if (!albumMap.get(folder.id)) {
                const { data: firstPhoto } = await supabase
                    .from('media')
                    .select('id')
                    .eq('album_id', albumId)
                    .limit(1)
                    .single();

                if (firstPhoto) {
                    await supabase.from('albums').update({ cover_photo_id: firstPhoto.id }).eq('id', albumId);
                }
            }
        }

        return NextResponse.json({
            success: true,
            albumsSynced,
            photosSynced,
            totalAlbums: folders.length,
        });
    } catch (err: any) {
        console.error('Sync error:', err);
        return NextResponse.json({ error: err.message }, { status: 500 });
    }
}
