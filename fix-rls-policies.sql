-- =============================================
-- Fix RLS Policies for user_settings and quotes
-- Run this in Supabase SQL Editor
-- =============================================

-- 1. Create user_settings table if it doesn't exist
CREATE TABLE IF NOT EXISTS user_settings (
    id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
    user_id uuid REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL UNIQUE,
    company_name text,
    email text,
    phone text,
    website text,
    brand_color text DEFAULT '#1e3a5f',
    currency text DEFAULT '€',
    vat_enabled boolean DEFAULT true,
    vat_percentage numeric DEFAULT 23,
    logo_url text,
    whatsapp_message text,
    email_message text,
    quote_description text DEFAULT 'Quote Description',
    created_at timestamp with time zone DEFAULT now(),
    updated_at timestamp with time zone DEFAULT now()
);

-- 2. Enable RLS on user_settings
ALTER TABLE user_settings ENABLE ROW LEVEL SECURITY;

-- 3. Drop existing policies if they exist (safe to re-run)
DROP POLICY IF EXISTS "Users can view own settings" ON user_settings;
DROP POLICY IF EXISTS "Users can insert own settings" ON user_settings;
DROP POLICY IF EXISTS "Users can update own settings" ON user_settings;

-- 4. Create RLS policies for user_settings
CREATE POLICY "Users can view own settings"
    ON user_settings FOR SELECT
    TO authenticated
    USING (auth.uid() = user_id);

CREATE POLICY "Users can insert own settings"
    ON user_settings FOR INSERT
    TO authenticated
    WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update own settings"
    ON user_settings FOR UPDATE
    TO authenticated
    USING (auth.uid() = user_id)
    WITH CHECK (auth.uid() = user_id);

-- 5. Create quotes table if it doesn't exist
CREATE TABLE IF NOT EXISTS quotes (
    id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
    user_id uuid REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
    title text,
    services jsonb,
    base_value numeric DEFAULT 0,
    vat_override text,
    estimated_time text,
    expiration_date text,
    payment_conditions text,
    client_name text,
    client_email text,
    client_whatsapp text,
    client_service_title text,
    created_at timestamp with time zone DEFAULT now(),
    updated_at timestamp with time zone DEFAULT now()
);

-- 6. Enable RLS on quotes
ALTER TABLE quotes ENABLE ROW LEVEL SECURITY;

-- 7. Drop existing policies if they exist (safe to re-run)
DROP POLICY IF EXISTS "Users can view own quotes" ON quotes;
DROP POLICY IF EXISTS "Users can insert own quotes" ON quotes;
DROP POLICY IF EXISTS "Users can update own quotes" ON quotes;
DROP POLICY IF EXISTS "Users can delete own quotes" ON quotes;

-- 8. Create RLS policies for quotes
CREATE POLICY "Users can view own quotes"
    ON quotes FOR SELECT
    TO authenticated
    USING (auth.uid() = user_id);

CREATE POLICY "Users can insert own quotes"
    ON quotes FOR INSERT
    TO authenticated
    WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update own quotes"
    ON quotes FOR UPDATE
    TO authenticated
    USING (auth.uid() = user_id)
    WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can delete own quotes"
    ON quotes FOR DELETE
    TO authenticated
    USING (auth.uid() = user_id);
