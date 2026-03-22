-- Media Usage Tracking for Subscriptions
-- Tracks monthly photo and document uploads for plan-based limits

ALTER TABLE subscriptions
ADD COLUMN IF NOT EXISTS photo_uploads_used INTEGER DEFAULT 0,
ADD COLUMN IF NOT EXISTS doc_uploads_used INTEGER DEFAULT 0,
ADD COLUMN IF NOT EXISTS media_usage_reset_at TIMESTAMPTZ DEFAULT NOW();

COMMENT ON COLUMN subscriptions.photo_uploads_used IS 'Photo uploads used in current billing period';
COMMENT ON COLUMN subscriptions.doc_uploads_used IS 'Document uploads used in current billing period';
COMMENT ON COLUMN subscriptions.media_usage_reset_at IS 'When the media usage counter was last reset';
