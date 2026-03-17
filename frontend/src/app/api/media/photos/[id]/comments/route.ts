import { NextRequest, NextResponse } from 'next/server';
import { createServiceClient } from '@/lib/supabase';

/**
 * POST /api/media/photos/[id]/comments — Add a comment
 */
export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
    try {
        const { id } = await params;
        const { content, userId } = await req.json();

        if (!content || !userId) {
            return NextResponse.json({ error: 'content and userId required' }, { status: 400 });
        }

        const supabase = createServiceClient();
        const { data, error } = await supabase
            .from('photo_comments')
            .insert({ media_id: id, user_id: userId, content })
            .select('id, content, created_at, user:profiles(display_name)')
            .single();

        if (error) throw error;
        return NextResponse.json(data, { status: 201 });
    } catch (err: any) {
        return NextResponse.json({ error: err.message }, { status: 500 });
    }
}

/**
 * DELETE /api/media/photos/[id]/comments — Delete a comment (by commentId in body)
 */
export async function DELETE(req: NextRequest) {
    try {
        const { commentId } = await req.json();
        if (!commentId) return NextResponse.json({ error: 'commentId required' }, { status: 400 });

        const supabase = createServiceClient();
        const { error } = await supabase.from('photo_comments').delete().eq('id', commentId);
        if (error) throw error;

        return NextResponse.json({ success: true });
    } catch (err: any) {
        return NextResponse.json({ error: err.message }, { status: 500 });
    }
}
