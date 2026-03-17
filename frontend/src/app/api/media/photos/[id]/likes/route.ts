import { NextRequest, NextResponse } from 'next/server';
import { createServiceClient } from '@/lib/supabase';

/**
 * POST /api/media/photos/[id]/likes — Toggle like/reaction
 */
export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
    try {
        const { id } = await params;
        const { userId, reaction = 'like' } = await req.json();

        if (!userId) return NextResponse.json({ error: 'userId required' }, { status: 400 });

        const supabase = createServiceClient();

        // Check if already liked
        const { data: existing } = await supabase
            .from('photo_likes')
            .select('id, reaction')
            .eq('media_id', id)
            .eq('user_id', userId)
            .single();

        if (existing) {
            if (existing.reaction === reaction) {
                // Same reaction → remove (toggle off)
                await supabase.from('photo_likes').delete().eq('id', existing.id);
                return NextResponse.json({ action: 'removed' });
            } else {
                // Different reaction → update
                await supabase.from('photo_likes').update({ reaction }).eq('id', existing.id);
                return NextResponse.json({ action: 'updated', reaction });
            }
        }

        // New like
        const { error } = await supabase
            .from('photo_likes')
            .insert({ media_id: id, user_id: userId, reaction });

        if (error) throw error;
        return NextResponse.json({ action: 'added', reaction }, { status: 201 });
    } catch (err: any) {
        return NextResponse.json({ error: err.message }, { status: 500 });
    }
}
