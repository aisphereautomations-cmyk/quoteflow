import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase-server';

// Helper to check admin role
async function isAdmin(supabase: Awaited<ReturnType<typeof createClient>>) {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return false;
    return user.app_metadata?.role === 'admin';
}

// GET — list all promo codes
export async function GET() {
    const supabase = await createClient();
    if (!(await isAdmin(supabase))) {
        return NextResponse.json({ error: 'Unauthorized' }, { status: 403 });
    }

    const { data, error } = await supabase
        .from('promo_codes')
        .select('*')
        .order('created_at', { ascending: false });

    if (error) {
        return NextResponse.json({ error: error.message }, { status: 500 });
    }

    return NextResponse.json(data);
}

// POST — create new promo code
export async function POST(request: NextRequest) {
    const supabase = await createClient();
    if (!(await isAdmin(supabase))) {
        return NextResponse.json({ error: 'Unauthorized' }, { status: 403 });
    }

    const { data: { user } } = await supabase.auth.getUser();
    const body = await request.json();

    const { data, error } = await supabase
        .from('promo_codes')
        .insert({
            code: body.code?.toUpperCase().trim(),
            type: body.type,
            value: body.value,
            max_uses: body.maxUses || null,
            valid_from: body.validFrom || new Date().toISOString(),
            valid_until: body.validUntil || null,
            applies_to_plans: body.appliesTo || ['starter', 'pro', 'enterprise'],
            created_by: user!.id,
            is_active: true,
        })
        .select()
        .single();

    if (error) {
        return NextResponse.json({ error: error.message }, { status: 500 });
    }

    return NextResponse.json(data);
}

// PUT — update promo code
export async function PUT(request: NextRequest) {
    const supabase = await createClient();
    if (!(await isAdmin(supabase))) {
        return NextResponse.json({ error: 'Unauthorized' }, { status: 403 });
    }

    const body = await request.json();

    if (!body.id) {
        return NextResponse.json({ error: 'ID is required' }, { status: 400 });
    }

    const updateData: Record<string, unknown> = {};
    if (body.code !== undefined) updateData.code = body.code.toUpperCase().trim();
    if (body.type !== undefined) updateData.type = body.type;
    if (body.value !== undefined) updateData.value = body.value;
    if (body.maxUses !== undefined) updateData.max_uses = body.maxUses;
    if (body.validUntil !== undefined) updateData.valid_until = body.validUntil;
    if (body.appliesTo !== undefined) updateData.applies_to_plans = body.appliesTo;
    if (body.isActive !== undefined) updateData.is_active = body.isActive;

    const { data, error } = await supabase
        .from('promo_codes')
        .update(updateData)
        .eq('id', body.id)
        .select()
        .single();

    if (error) {
        return NextResponse.json({ error: error.message }, { status: 500 });
    }

    return NextResponse.json(data);
}

// DELETE — delete promo code
export async function DELETE(request: NextRequest) {
    const supabase = await createClient();
    if (!(await isAdmin(supabase))) {
        return NextResponse.json({ error: 'Unauthorized' }, { status: 403 });
    }

    const { id } = await request.json();

    if (!id) {
        return NextResponse.json({ error: 'ID is required' }, { status: 400 });
    }

    const { error } = await supabase
        .from('promo_codes')
        .delete()
        .eq('id', id);

    if (error) {
        return NextResponse.json({ error: error.message }, { status: 500 });
    }

    return NextResponse.json({ success: true });
}
