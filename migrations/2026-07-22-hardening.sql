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
