import { NextRequest, NextResponse } from 'next/server';
import { createServiceClient } from '@/lib/supabase';
import { getDownloadUrl, deleteItem, isConfigured as isOnedriveConfigured } from '@/lib/onedrive';
import { deleteFromR2 } from '@/lib/r2';

/**
 * GET /api/media/photos/[id] — Get photo detail with comments, likes, tags
 */
export async function GET(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
    try {
        const { id } = await params;
        const supabase = createServiceClient();

        const [photoRes, commentsRes, likesRes, tagsRes] = await Promise.all([
            supabase.from('media')
                .select('*, uploader:profiles(display_name, email), album:albums(id, title)')
                .eq('id', id)
                .single(),
            supabase.from('photo_comments')
                .select('id, content, created_at, user:profiles(display_name)')
                .eq('media_id', id)
                .order('created_at', { ascending: true }),
            supabase.from('photo_likes')
                .select('id, user_id, reaction')
                .eq('media_id', id),
            supabase.from('photo_tags')
                .select('id, person_id, created_at')
                .eq('media_id', id),
        ]);

        if (photoRes.error) throw photoRes.error;

        // Resolve download URL based on storage provider
        let downloadUrl: string | null = null;
        const photo = photoRes.data;

        if (photo.storage_provider === 'r2' && photo.r2_url) {
            // R2: URL is permanent, no refresh needed
            downloadUrl = photo.r2_url;
        } else if (photo.onedrive_item_id && isOnedriveConfigured()) {
            // OneDrive: refresh download URL
            try {
                downloadUrl = await getDownloadUrl(photo.onedrive_item_id);
            } catch {
                downloadUrl = photo.onedrive_url;
            }
        } else {
            downloadUrl = photo.onedrive_url || photo.r2_url;
        }

        // Aggregate reactions
        const reactionCounts: Record<string, number> = {};
        for (const like of likesRes.data || []) {
            reactionCounts[like.reaction] = (reactionCounts[like.reaction] || 0) + 1;
        }

        return NextResponse.json({
            photo: {
                ...photo,
                downloadUrl,
            },
            comments: commentsRes.data || [],
            likes: {
                total: likesRes.data?.length || 0,
                reactions: reactionCounts,
                userIds: (likesRes.data || []).map(l => l.user_id),
                items: likesRes.data || [],
            },
            tags: tagsRes.data || [],
        });
    } catch (err: any) {
        return NextResponse.json({ error: err.message }, { status: 500 });
    }
}

/**
 * PATCH /api/media/photos/[id] — Update photo (title, description, state)
 */
export async function PATCH(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
    try {
        const { id } = await params;
        const body = await req.json();
        const supabase = createServiceClient();

        const updates: Record<string, any> = {};
        if (body.title !== undefined) updates.title = body.title;
        if (body.description !== undefined) updates.description = body.description;
        if (body.state !== undefined) updates.state = body.state;

        const { data, error } = await supabase
            .from('media')
            .update(updates)
            .eq('id', id)
            .select('id, title, state')
            .single();

        if (error) throw error;
        return NextResponse.json(data);
    } catch (err: any) {
        return NextResponse.json({ error: err.message }, { status: 500 });
    }
}

/**
 * DELETE /api/media/photos/[id] — Delete photo from storage + database
 */
export async function DELETE(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
    try {
        const { id } = await params;
        const supabase = createServiceClient();

        // Get storage info
        const { data: photo } = await supabase
            .from('media')
            .select('onedrive_item_id, r2_key, storage_provider')
            .eq('id', id)
            .single();

        // Delete from storage
        if (photo?.storage_provider === 'r2' && photo.r2_key) {
            try { await deleteFromR2(photo.r2_key); } catch { }
        } else if (photo?.onedrive_item_id && isOnedriveConfigured()) {
            try { await deleteItem(photo.onedrive_item_id); } catch { }
        }

        // Delete from Supabase (cascades to tags, comments, likes)
        const { error } = await supabase.from('media').delete().eq('id', id);
        if (error) throw error;

        return NextResponse.json({ success: true });
    } catch (err: any) {
        return NextResponse.json({ error: err.message }, { status: 500 });
    }
}
