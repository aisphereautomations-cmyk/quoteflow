import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase-server';
import { getPrice, type PlanId, type BillingCycle } from '@/lib/plans';

export async function POST(request: NextRequest) {
    try {
        const { plan, billingCycle, promoCode } = await request.json() as {
            plan: PlanId;
            billingCycle: BillingCycle;
            promoCode?: string;
        };

        if (!plan || !billingCycle) {
            return NextResponse.json({ error: 'Plan and billing cycle are required' }, { status: 400 });
        }

        const supabase = await createClient();

        // Get current user
        const { data: { user }, error: authError } = await supabase.auth.getUser();
        if (authError || !user) {
            return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
        }

        // Check if user already has an active subscription
        const { data: existingSub } = await supabase
            .from('subscriptions')
            .select('id')
            .eq('user_id', user.id)
            .in('status', ['active', 'trial'])
            .maybeSingle();

        if (existingSub) {
            return NextResponse.json({ error: 'You already have an active subscription' }, { status: 400 });
        }

        let finalPrice = getPrice(plan, billingCycle);
        let promoData: { type: string; value: number; code: string } | null = null;

        // Validate promo code if provided
        if (promoCode) {
            const { data: promo, error: promoError } = await supabase
                .from('promo_codes')
                .select('*')
                .eq('code', promoCode.toUpperCase().trim())
                .eq('is_active', true)
                .maybeSingle();

            if (promoError || !promo) {
                return NextResponse.json({ error: 'Invalid promo code' }, { status: 400 });
            }

            // Check validity
            if (promo.valid_until && new Date(promo.valid_until) < new Date()) {
                return NextResponse.json({ error: 'Promo code expired' }, { status: 400 });
            }
            if (promo.max_uses !== null && promo.times_used >= promo.max_uses) {
                return NextResponse.json({ error: 'Promo code usage limit reached' }, { status: 400 });
            }
            if (promo.applies_to_plans && !promo.applies_to_plans.includes(plan)) {
                return NextResponse.json({ error: 'Promo code does not apply to this plan' }, { status: 400 });
            }

            promoData = { type: promo.type, value: promo.value, code: promo.code };

            // Handle "free_days" promo — activate trial immediately
            if (promo.type === 'free_days') {
                const trialEnd = new Date();
                trialEnd.setDate(trialEnd.getDate() + promo.value);

                const { error: subError } = await supabase
                    .from('subscriptions')
                    .insert({
                        user_id: user.id,
                        plan,
                        billing_cycle: billingCycle,
                        status: 'trial',
                        trial_ends_at: trialEnd.toISOString(),
                        current_period_start: new Date().toISOString(),
                        current_period_end: trialEnd.toISOString(),
                        promo_code_used: promo.code,
                        amount_paid: 0,
                    });

                if (subError) throw subError;

                // Increment promo usage
                await supabase
                    .from('promo_codes')
                    .update({ times_used: promo.times_used + 1 })
                    .eq('id', promo.id);

                return NextResponse.json({ success: true, trial: true });
            }

            // Apply discount
            if (promo.type === 'percentage_discount') {
                finalPrice = finalPrice * (1 - promo.value / 100);
            } else if (promo.type === 'fixed_discount') {
                finalPrice = Math.max(0, finalPrice - promo.value);
            }
        }

        // ─── If price is zero after promo, activate subscription directly ───
        if (finalPrice <= 0 && promoData) {
            const periodEnd = new Date();
            if (billingCycle === 'yearly') {
                periodEnd.setFullYear(periodEnd.getFullYear() + 1);
            } else {
                periodEnd.setMonth(periodEnd.getMonth() + 1);
            }

            const { error: subError } = await supabase
                .from('subscriptions')
                .insert({
                    user_id: user.id,
                    plan,
                    billing_cycle: billingCycle,
                    status: 'active',
                    current_period_start: new Date().toISOString(),
                    current_period_end: periodEnd.toISOString(),
                    promo_code_used: promoData.code,
                    amount_paid: 0,
                });

            if (subError) throw subError;

            // Increment promo usage
            await supabase
                .from('promo_codes')
                .update({ times_used: (await supabase.from('promo_codes').select('times_used').eq('code', promoData.code).single()).data?.times_used + 1 })
                .eq('code', promoData.code);

            return NextResponse.json({ success: true });
        }

        // ─── Airwallex Integration ───

        const airwallexApiKey = process.env.AIRWALLEX_API_KEY;
        const airwallexClientId = process.env.AIRWALLEX_CLIENT_ID;

        if (!airwallexApiKey || !airwallexClientId) {
            // Development mode: create subscription directly
            const periodEnd = new Date();
            if (billingCycle === 'yearly') {
                periodEnd.setFullYear(periodEnd.getFullYear() + 1);
            } else {
                periodEnd.setMonth(periodEnd.getMonth() + 1);
            }

            const { error: subError } = await supabase
                .from('subscriptions')
                .insert({
                    user_id: user.id,
                    plan,
                    billing_cycle: billingCycle,
                    status: 'active',
                    current_period_start: new Date().toISOString(),
                    current_period_end: periodEnd.toISOString(),
                    promo_code_used: promoData?.code || null,
                    amount_paid: finalPrice,
                });

            if (subError) throw subError;

            // Increment promo usage
            if (promoData) {
                await supabase
                    .from('promo_codes')
                    .update({ times_used: (await supabase.from('promo_codes').select('times_used').eq('code', promoData.code).single()).data?.times_used + 1 })
                    .eq('code', promoData.code);
            }

            return NextResponse.json({ success: true });
        }

        // ─── Real Airwallex flow ───
        // Step 1: Get auth token
        let authRes;
        try {
            authRes = await fetch('https://api.airwallex.com/api/v1/authentication/login', {
                method: 'POST',
                headers: {
                    'x-client-id': airwallexClientId,
                    'x-api-key': airwallexApiKey,
                    'Content-Type': 'application/json',
                },
            });
        } catch (fetchErr) {
            console.error('Airwallex auth fetch failed:', fetchErr);
            return NextResponse.json({ error: 'Cannot reach payment service', debug: String(fetchErr) }, { status: 503 });
        }

        const authData = await authRes.json();
        const token = authData.token;

        if (!token) {
            console.error('Airwallex auth failed:', JSON.stringify(authData));
            return NextResponse.json({
                error: `Airwallex auth failed: ${authData.message || authData.code || JSON.stringify(authData)}`,
            }, { status: 503 });
        }

        // Step 2: Create Payment Intent
        const intentBody = {
            request_id: `qf_${user.id}_${Date.now()}`,
            amount: Math.round(finalPrice * 100) / 100,
            currency: 'EUR',
            merchant_order_id: `qf_${plan}_${billingCycle}_${Date.now()}`,
            metadata: {
                user_id: user.id,
                plan,
                billing_cycle: billingCycle,
                promo_code: promoData?.code || '',
            },
        };

        let intentRes;
        try {
            intentRes = await fetch('https://api.airwallex.com/api/v1/pa/payment_intents/create', {
                method: 'POST',
                headers: {
                    'Authorization': `Bearer ${token}`,
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify(intentBody),
            });
        } catch (fetchErr) {
            console.error('Airwallex intent fetch failed:', fetchErr);
            return NextResponse.json({ error: 'Cannot reach payment service', debug: String(fetchErr) }, { status: 503 });
        }

        const intentData = await intentRes.json();

        if (!intentData.id) {
            console.error('Airwallex intent error:', JSON.stringify(intentData));
            return NextResponse.json({
                error: `Payment error: ${intentData.message || intentData.code || JSON.stringify(intentData)}`,
            }, { status: 500 });
        }

        // Return intent details for client-side SDK redirect
        return NextResponse.json({
            intentId: intentData.id,
            clientSecret: intentData.client_secret,
            currency: 'EUR',
            amount: finalPrice,
        });

    } catch (err) {
        console.error('Checkout error:', err);
        return NextResponse.json({ error: `Server error: ${err instanceof Error ? err.message : String(err)}` }, { status: 500 });
    }
}

