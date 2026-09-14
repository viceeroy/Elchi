CREATE TABLE IF NOT EXISTS signup_tokens (
    token UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    status VARCHAR(20) NOT NULL CHECK (status IN ('pending', 'verified')) DEFAULT 'pending',
    telegram_id BIGINT,
    hashed_token TEXT,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    expires_at TIMESTAMPTZ NOT NULL
);
ALTER TABLE signup_tokens ENABLE ROW LEVEL SECURITY;
