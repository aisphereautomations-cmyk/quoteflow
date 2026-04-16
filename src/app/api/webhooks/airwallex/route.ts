import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

// Use service role for webhook processing (bypasses RLS)
const supabaseAdmin = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
);

export async function POST(request: NextRequest) {
    try {
        const body = await request.json();
        const eventType = body.name || body.type;

        console.log('Airwallex webhook received:', eventType);

        // TODO: Verify webhook signature with AIRWALLEX_WEBHOOK_SECRET
        // const signature = request.headers.get('x-signature');

        switch (eventType) {
            case 'payment_intent.succeeded': {
                const intent = body.data?.object || body.data;
                const metadata = intent?.metadata || {};
                const userId = metadata.user_id;
                const plan = metadata.plan;
                const billingCycle = metadata.billing_cycle;
                const promoCode = metadata.promo_code;

                if (!userId || !plan) {
                    console.error('Missing metadata in payment intent');
                    break;
                }

                const periodEnd = new Date();
                if (billingCycle === 'yearly') {
                    periodEnd.setFullYear(periodEnd.getFullYear() + 1);
                } else {
                    periodEnd.setMonth(periodEnd.getMonth() + 1);
                }

                // Insert subscription
                await supabaseAdmin
                    .from('subscriptions')
                    .insert({
                        user_id: userId,
                        plan,
                        billing_cycle: billingCycle || 'monthly',
                        status: 'active',
                        airwallex_payment_intent_id: intent.id,
                        current_period_start: new Date().toISOString(),
                        current_period_end: periodEnd.toISOString(),
                        promo_code_used: promoCode || null,
                        amount_paid: intent.amount,
                    });

                // Increment promo usage if applicable
                if (promoCode) {
                    const { data: promo } = await supabaseAdmin
                        .from('promo_codes')
                        .select('times_used')
                        .eq('code', promoCode)
                        .single();

                    if (promo) {
                        await supabaseAdmin
                            .from('promo_codes')
                            .update({ times_used: promo.times_used + 1 })
                            .eq('code', promoCode);
                    }
                }

                break;
            }

            case 'subscription.cancelled':
            case 'subscription.expired': {
                const sub = body.data?.object || body.data;
                const metadata = sub?.metadata || {};

                if (metadata.user_id) {
                    await supabaseAdmin
                        .from('subscriptions')
                        .update({ status: 'cancelled', updated_at: new Date().toISOString() })
                        .eq('user_id', metadata.user_id)
                        .eq('status', 'active');
                }
                break;
            }

            default:
                console.log('Unhandled webhook event:', eventType);
        }

        return NextResponse.json({ received: true });
    } catch (err) {
        console.error('Webhook error:', err);
        return NextResponse.json({ error: 'Webhook processing failed' }, { status: 500 });
    }
}
