import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase-server';
import { createClient as createSupabaseClient } from '@supabase/supabase-js';

function getAdminClient() {
    return createSupabaseClient(
        process.env.NEXT_PUBLIC_SUPABASE_URL!,
        process.env.SUPABASE_SERVICE_ROLE_KEY!,
    );
}

export async function POST(request: NextRequest) {
    try {
        const { intentId } = await request.json();

        if (!intentId) {
            return NextResponse.json({ error: 'Intent ID is required' }, { status: 400 });
        }

        const supabase = await createClient();
        const { data: { user }, error: authError } = await supabase.auth.getUser();
        if (authError || !user) {
            return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
        }

        // Check if user already has an active subscription
        const admin = getAdminClient();
        const { data: existingSub } = await admin
            .from('subscriptions')
            .select('id, status')
            .eq('user_id', user.id)
            .in('status', ['active', 'trial'])
            .maybeSingle();

        if (existingSub) {
            return NextResponse.json({ success: true, alreadyActive: true });
        }

        // Authenticate with Airwallex
        const airwallexApiKey = process.env.AIRWALLEX_API_KEY;
        const airwallexClientId = process.env.AIRWALLEX_CLIENT_ID;

        if (!airwallexApiKey || !airwallexClientId) {
            return NextResponse.json({ error: 'Payment service not configured' }, { status: 503 });
        }

        const authRes = await fetch('https://api.airwallex.com/api/v1/authentication/login', {
            method: 'POST',
            headers: {
                'x-client-id': airwallexClientId,
                'x-api-key': airwallexApiKey,
                'Content-Type': 'application/json',
            },
        });

        const authData = await authRes.json();
        if (!authData.token) {
            console.error('Airwallex auth failed:', authData);
            return NextResponse.json({ error: 'Payment service auth failed' }, { status: 503 });
        }

        // Retrieve the payment intent from Airwallex
        const intentRes = await fetch(`https://api.airwallex.com/api/v1/pa/payment_intents/${intentId}`, {
            headers: {
                'Authorization': `Bearer ${authData.token}`,
            },
        });

        const intent = await intentRes.json();

        if (!intent || !intent.id) {
            return NextResponse.json({ error: 'Payment intent not found' }, { status: 404 });
        }

        // Check payment status — capture if needed
        if (intent.status === 'REQUIRES_CAPTURE') {
            // Payment was authorized but not captured — capture it now
            const captureRes = await fetch(
                `https://api.airwallex.com/api/v1/pa/payment_intents/${intentId}/capture`,
                {
                    method: 'POST',
                    headers: {
                        'Authorization': `Bearer ${authData.token}`,
                        'Content-Type': 'application/json',
                    },
                    body: JSON.stringify({
                        request_id: `capture_${intentId}_${Date.now()}`,
                    }),
                },
            );
            const captureData = await captureRes.json();
            if (captureData.status !== 'SUCCEEDED') {
                console.error('Capture failed:', captureData);
                return NextResponse.json({
                    error: `Payment capture failed. Status: ${captureData.status}`,
                    status: captureData.status,
                }, { status: 400 });
            }
            // Update intent reference to captured version
            intent.status = 'SUCCEEDED';
        } else if (intent.status !== 'SUCCEEDED') {
            return NextResponse.json({
                error: `Payment not confirmed. Status: ${intent.status}`,
                status: intent.status,
            }, { status: 400 });
        }

        // Extract metadata
        const metadata = intent.metadata || {};
        const plan = metadata.plan;
        const billingCycle = metadata.billing_cycle || 'monthly';
        const promoCode = metadata.promo_code;

        // Verify the payment intent belongs to this user
        if (metadata.user_id && metadata.user_id !== user.id) {
            return NextResponse.json({ error: 'Payment does not belong to this user' }, { status: 403 });
        }

        if (!plan) {
            return NextResponse.json({ error: 'Plan metadata missing from payment' }, { status: 400 });
        }

        // Create subscription
        const periodEnd = new Date();
        if (billingCycle === 'yearly') {
            periodEnd.setFullYear(periodEnd.getFullYear() + 1);
        } else {
            periodEnd.setMonth(periodEnd.getMonth() + 1);
        }

        const { error: subError } = await admin
            .from('subscriptions')
            .insert({
                user_id: user.id,
                plan,
                billing_cycle: billingCycle,
                status: 'active',
                airwallex_payment_intent_id: intent.id,
                current_period_start: new Date().toISOString(),
                current_period_end: periodEnd.toISOString(),
                promo_code_used: promoCode || null,
                amount_paid: intent.amount,
            });

        if (subError) {
            console.error('Subscription create error:', subError);
            return NextResponse.json({ error: subError.message }, { status: 500 });
        }

        // Increment promo usage if applicable
        if (promoCode) {
            const { data: promo } = await admin
                .from('promo_codes')
                .select('times_used')
                .eq('code', promoCode)
                .single();

            if (promo) {
                await admin
                    .from('promo_codes')
                    .update({ times_used: promo.times_used + 1 })
                    .eq('code', promoCode);
            }
        }

        return NextResponse.json({ success: true });
    } catch (err) {
        console.error('Verify payment error:', err);
        return NextResponse.json(
            { error: `Server error: ${err instanceof Error ? err.message : String(err)}` },
            { status: 500 },
        );
    }
}
