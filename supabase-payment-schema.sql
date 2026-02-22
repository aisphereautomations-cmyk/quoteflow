-- =============================================
-- Quote Flow — Payment & Subscription Schema
-- Run this in Supabase SQL Editor
-- =============================================

-- 1. Promo Codes table
CREATE TABLE IF NOT EXISTS promo_codes (
    id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
    code text UNIQUE NOT NULL,
    type text NOT NULL CHECK (type IN ('percentage_discount', 'fixed_discount', 'free_days')),
    value numeric NOT NULL,
    max_uses integer,
    times_used integer DEFAULT 0,
    valid_from timestamp with time zone DEFAULT now(),
    valid_until timestamp with time zone,
    applies_to_plans text[] DEFAULT '{starter,pro,enterprise}',
    created_by uuid REFERENCES auth.users(id),
    is_active boolean DEFAULT true,
    created_at timestamp with time zone DEFAULT now()
);

-- 2. Update subscriptions table (drop and recreate if needed)
DROP TABLE IF EXISTS subscriptions;

CREATE TABLE subscriptions (
    id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
    user_id uuid REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
    plan text NOT NULL CHECK (plan IN ('starter', 'pro', 'enterprise')),
    billing_cycle text NOT NULL CHECK (billing_cycle IN ('monthly', 'yearly')),
    status text NOT NULL DEFAULT 'active' CHECK (status IN ('active', 'cancelled', 'expired', 'trial', 'past_due')),
    airwallex_subscription_id text,
    airwallex_payment_intent_id text,
    promo_code_used text,
    trial_ends_at timestamp with time zone,
    current_period_start timestamp with time zone DEFAULT now(),
    current_period_end timestamp with time zone,
    amount_paid numeric,
    currency text DEFAULT 'EUR',
    created_at timestamp with time zone DEFAULT now(),
    updated_at timestamp with time zone DEFAULT now()
);

-- 3. Token usage tracking
CREATE TABLE IF NOT EXISTS token_usage (
    id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
    user_id uuid REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
    tokens_used integer NOT NULL DEFAULT 0,
    period_start timestamp with time zone NOT NULL,
    period_end timestamp with time zone NOT NULL,
    created_at timestamp with time zone DEFAULT now()
);

-- 4. RLS Policies

-- Subscriptions: users can read their own
ALTER TABLE subscriptions ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view own subscriptions"
    ON subscriptions FOR SELECT
    TO authenticated
    USING (auth.uid() = user_id);

CREATE POLICY "Service role can manage subscriptions"
    ON subscriptions FOR ALL
    TO service_role
    USING (true);

-- Promo codes: anyone authenticated can read active codes (for validation)
ALTER TABLE promo_codes ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Authenticated users can read active promo codes"
    ON promo_codes FOR SELECT
    TO authenticated
    USING (is_active = true);

CREATE POLICY "Service role can manage promo codes"
    ON promo_codes FOR ALL
    TO service_role
    USING (true);

-- Token usage: users can read their own
ALTER TABLE token_usage ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view own token usage"
    ON token_usage FOR SELECT
    TO authenticated
    USING (auth.uid() = user_id);

CREATE POLICY "Service role can manage token usage"
    ON token_usage FOR ALL
    TO service_role
    USING (true);

-- 5. Admin role helper (set your user as admin)
-- After creating your account, run this replacing YOUR_USER_ID:
-- UPDATE auth.users SET raw_app_meta_data = raw_app_meta_data || '{"role": "admin"}' WHERE id = 'YOUR_USER_ID';
