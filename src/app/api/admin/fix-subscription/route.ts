import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase-server';
import { createClient as createSupabaseClient } from '@supabase/supabase-js';

// Service role client — bypasses RLS
function getAdminClient() {
    return createSupabaseClient(
        process.env.NEXT_PUBLIC_SUPABASE_URL!,
        process.env.SUPABASE_SERVICE_ROLE_KEY!,
    );
}

// Helper to check admin role
async function isAdmin(supabase: Awaited<ReturnType<typeof createClient>>) {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return false;
    return user.app_metadata?.role === 'admin';
}

// GET — check subscription status for a user by email
// POST — manually activate subscription for a user
export async function GET(request: NextRequest) {
    const supabase = await createClient();
    if (!(await isAdmin(supabase))) {
        return NextResponse.json({ error: 'Unauthorized' }, { status: 403 });
    }

    const email = request.nextUrl.searchParams.get('email');
    if (!email) {
        return NextResponse.json({ error: 'Email parameter required' }, { status: 400 });
    }

    const admin = getAdminClient();

    // Find user by email
    const { data: { users }, error: userError } = await admin.auth.admin.listUsers();
    if (userError) {
        return NextResponse.json({ error: userError.message }, { status: 500 });
    }

    const targetUser = users.find(u => u.email === email);
    if (!targetUser) {
        return NextResponse.json({ error: 'User not found' }, { status: 404 });
    }

    // Get their subscription
    const { data: sub, error: subError } = await admin
        .from('subscriptions')
        .select('*')
        .eq('user_id', targetUser.id)
        .order('created_at', { ascending: false })
        .limit(1)
        .maybeSingle();

    return NextResponse.json({
        userId: targetUser.id,
        email: targetUser.email,
        subscription: sub,
        hasActiveSubscription: sub && (sub.status === 'active' || sub.status === 'trial'),
    });
}

export async function POST(request: NextRequest) {
    const supabase = await createClient();
    if (!(await isAdmin(supabase))) {
        return NextResponse.json({ error: 'Unauthorized' }, { status: 403 });
    }

    const { email, plan, billingCycle } = await request.json();
    if (!email || !plan || !billingCycle) {
        return NextResponse.json(
            { error: 'email, plan, and billingCycle are required' },
            { status: 400 },
        );
    }

    const admin = getAdminClient();

    // Find user by email
    const { data: { users }, error: userError } = await admin.auth.admin.listUsers();
    if (userError) {
        return NextResponse.json({ error: userError.message }, { status: 500 });
    }

    const targetUser = users.find(u => u.email === email);
    if (!targetUser) {
        return NextResponse.json({ error: 'User not found' }, { status: 404 });
    }

    const periodEnd = new Date();
    if (billingCycle === 'yearly') {
        periodEnd.setFullYear(periodEnd.getFullYear() + 1);
    } else {
        periodEnd.setMonth(periodEnd.getMonth() + 1);
    }

    // Delete any existing subscription first, then insert new one
    await admin
        .from('subscriptions')
        .delete()
        .eq('user_id', targetUser.id);

    const { data: sub, error: subError } = await admin
        .from('subscriptions')
        .insert({
            user_id: targetUser.id,
            plan,
            billing_cycle: billingCycle,
            status: 'active',
            current_period_start: new Date().toISOString(),
            current_period_end: periodEnd.toISOString(),
            amount_paid: 0,
        })
        .select()
        .single();

    if (subError) {
        return NextResponse.json({ error: subError.message }, { status: 500 });
    }

    return NextResponse.json({
        success: true,
        message: `Subscription activated for ${email}`,
        subscription: sub,
    });
}
