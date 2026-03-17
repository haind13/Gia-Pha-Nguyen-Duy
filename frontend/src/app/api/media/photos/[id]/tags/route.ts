import { NextRequest, NextResponse } from 'next/server';
import { createServiceClient } from '@/lib/supabase';

/**
 * POST /api/media/photos/[id]/tags — Tag a person in photo
 */
export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
    try {
        const { id } = await params;
        const { personId, taggedBy } = await req.json();

        if (!personId) return NextResponse.json({ error: 'personId required' }, { status: 400 });

        const supabase = createServiceClient();
        const { data, error } = await supabase
            .from('photo_tags')
            .upsert({ media_id: id, person_id: personId, tagged_by: taggedBy }, { onConflict: 'media_id,person_id' })
            .select('id, person_id, created_at')
            .single();

        if (error) throw error;
        return NextResponse.json(data, { status: 201 });
    } catch (err: any) {
        return NextResponse.json({ error: err.message }, { status: 500 });
    }
}

/**
 * DELETE /api/media/photos/[id]/tags — Remove person tag
 */
export async function DELETE(req: NextRequest) {
    try {
        const { tagId } = await req.json();
        if (!tagId) return NextResponse.json({ error: 'tagId required' }, { status: 400 });

        const supabase = createServiceClient();
        const { error } = await supabase.from('photo_tags').delete().eq('id', tagId);
        if (error) throw error;

        return NextResponse.json({ success: true });
    } catch (err: any) {
        return NextResponse.json({ error: err.message }, { status: 500 });
    }
}
