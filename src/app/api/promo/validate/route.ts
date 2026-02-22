import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase-server';

export async function POST(request: NextRequest) {
    try {
        const { code, plan } = await request.json();

        if (!code || !plan) {
            return NextResponse.json(
                { valid: false, error: 'Code and plan are required' },
                { status: 400 }
            );
        }

        const supabase = await createClient();

        const { data, error } = await supabase
            .from('promo_codes')
            .select('*')
            .eq('code', code.toUpperCase().trim())
            .eq('is_active', true)
            .maybeSingle();

        if (error) throw error;

        if (!data) {
            return NextResponse.json({ valid: false, error: 'Invalid promo code' });
        }

        // Check expiry
        if (data.valid_until && new Date(data.valid_until) < new Date()) {
            return NextResponse.json({ valid: false, error: 'This code has expired' });
        }

        // Check start date
        if (data.valid_from && new Date(data.valid_from) > new Date()) {
            return NextResponse.json({ valid: false, error: 'This code is not yet active' });
        }

        // Check max uses
        if (data.max_uses !== null && data.times_used >= data.max_uses) {
            return NextResponse.json({ valid: false, error: 'This code has reached its usage limit' });
        }

        // Check plan eligibility
        if (data.applies_to_plans && !data.applies_to_plans.includes(plan)) {
            return NextResponse.json({ valid: false, error: 'This code does not apply to the selected plan' });
        }

        return NextResponse.json({
            valid: true,
            type: data.type,
            value: data.value,
            code: data.code,
        });
    } catch (err) {
        console.error('Promo validation error:', err);
        return NextResponse.json(
            { valid: false, error: 'Server error' },
            { status: 500 }
        );
    }
}
