-- AI Token Usage Tracking for Subscriptions
-- Adds columns to track monthly AI token usage for plan-gated model selection

ALTER TABLE subscriptions
ADD COLUMN IF NOT EXISTS ai_tokens_used INTEGER DEFAULT 0,
ADD COLUMN IF NOT EXISTS ai_tokens_reset_at TIMESTAMPTZ DEFAULT NOW();

-- Index for efficient lookups during chat API calls
CREATE INDEX IF NOT EXISTS idx_subscriptions_user_status
ON subscriptions (user_id, status);

COMMENT ON COLUMN subscriptions.ai_tokens_used IS 'Cumulative AI tokens used in current billing period';
COMMENT ON COLUMN subscriptions.ai_tokens_reset_at IS 'When the token counter was last reset (start of billing period)';
