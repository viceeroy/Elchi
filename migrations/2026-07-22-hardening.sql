-- ===========================================================================
-- Elchi — security hardening for the auth + posting flow
-- Run ONCE in Supabase → SQL Editor BEFORE deploying the hardening branch.
-- Idempotent and safe to re-run.
--
-- Changes:
--   1. rate_limits table (Postgres-backed API throttle; service-role only)
--   2. posts INSERT policy now requires an authenticated author (user_id = uid)
--   3. profiles UPDATE policy gains a WITH CHECK so a user can't rewrite their
--      row into a foreign identity
-- ===========================================================================

-- ---------------------------------------------------------------------------
-- 1. rate_limits — one row per allowed request, keyed by (bucket, identifier).
--    Only the service-role client (api/lib) reads/writes it; RLS is ON with no
--    policies, so the anon key can't see or touch it.
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS rate_limits (
    id         BIGSERIAL PRIMARY KEY,
    bucket     TEXT        NOT NULL,
    identifier TEXT        NOT NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_rate_limits_lookup
    ON rate_limits (bucket, identifier, created_at);

ALTER TABLE rate_limits ENABLE ROW LEVEL SECURITY;

-- Fixed-window check as a SECURITY DEFINER function so the API can enforce
-- limits with the public anon key (no service-role key needed). It prunes aged
-- rows, counts live hits, and records the current one, returning true when the
-- request is under the limit. Runs as the function owner, bypassing the table's
-- RLS, so the anon key never touches rate_limits directly.
CREATE OR REPLACE FUNCTION check_rate_limit(
    p_bucket     TEXT,
    p_identifier TEXT,
    p_max        INTEGER,
    p_window_sec INTEGER
) RETURNS BOOLEAN
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
    v_window_start TIMESTAMPTZ := NOW() - make_interval(secs => p_window_sec);
    v_count        INTEGER;
BEGIN
    DELETE FROM rate_limits
    WHERE bucket = p_bucket AND identifier = p_identifier AND created_at < v_window_start;

    SELECT COUNT(*) INTO v_count
    FROM rate_limits
    WHERE bucket = p_bucket AND identifier = p_identifier AND created_at >= v_window_start;

    IF v_count >= p_max THEN
        RETURN FALSE;
    END IF;

    INSERT INTO rate_limits (bucket, identifier) VALUES (p_bucket, p_identifier);
    RETURN TRUE;
END;
$$;

-- Only expose the controlled function to callers, not the table.
REVOKE ALL ON FUNCTION check_rate_limit(TEXT, TEXT, INTEGER, INTEGER) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION check_rate_limit(TEXT, TEXT, INTEGER, INTEGER)
    TO anon, authenticated, service_role;

-- ---------------------------------------------------------------------------
-- 2. posts INSERT: require a logged-in author whose id matches the row's
--    user_id. Replaces the old WITH CHECK (true), which let the shipped anon
--    key insert freely and attribute posts to any user_id.
-- ---------------------------------------------------------------------------
DROP POLICY IF EXISTS "Allow public inserts to posts" ON posts;
DROP POLICY IF EXISTS "Authenticated users insert own posts" ON posts;
CREATE POLICY "Authenticated users insert own posts"
ON posts FOR INSERT
WITH CHECK (auth.uid() IS NOT NULL AND user_id = auth.uid());

-- ---------------------------------------------------------------------------
-- 3. profiles UPDATE: add WITH CHECK so the post-update row still belongs to
--    the caller (USING alone only gates which rows are visible to update).
-- ---------------------------------------------------------------------------
DROP POLICY IF EXISTS "Users can update own profile" ON profiles;
CREATE POLICY "Users can update own profile"
ON profiles FOR UPDATE
USING (auth.uid() = id)
WITH CHECK (auth.uid() = id);
