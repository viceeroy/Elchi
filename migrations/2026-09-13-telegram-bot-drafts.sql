-- Create telegram_bot_drafts table to store conversation state
CREATE TABLE IF NOT EXISTS telegram_bot_drafts (
    telegram_id BIGINT PRIMARY KEY,
    step VARCHAR(50) NOT NULL,
    state JSONB NOT NULL DEFAULT '{}'::jsonb,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Protect table by enabling RLS but providing no policies
-- This ensures only the service_role key can read/write to it
ALTER TABLE telegram_bot_drafts ENABLE ROW LEVEL SECURITY;
