import { NextRequest, NextResponse } from 'next/server';
import { createServiceClient } from '@/lib/supabase';
import { getDownloadUrl, deleteItem, isConfigured } from '@/lib/onedrive';

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

        // Refresh download URL from OneDrive if available
        let downloadUrl = photoRes.data.onedrive_url;
        if (photoRes.data.onedrive_item_id && isConfigured()) {
            try {
                downloadUrl = await getDownloadUrl(photoRes.data.onedrive_item_id);
            } catch { /* Use stored URL as fallback */ }
        }

        // Aggregate reactions
        const reactionCounts: Record<string, number> = {};
        for (const like of likesRes.data || []) {
            reactionCounts[like.reaction] = (reactionCounts[like.reaction] || 0) + 1;
        }

        return NextResponse.json({
            photo: {
                ...photoRes.data,
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
 * DELETE /api/media/photos/[id] — Delete photo
 */
export async function DELETE(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
    try {
        const { id } = await params;
        const supabase = createServiceClient();

        // Get OneDrive item ID
        const { data: photo } = await supabase.from('media').select('onedrive_item_id').eq('id', id).single();

        // Delete from OneDrive
        if (photo?.onedrive_item_id && isConfigured()) {
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
