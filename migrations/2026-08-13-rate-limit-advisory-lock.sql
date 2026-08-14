-- ===========================================================================
-- Elchi — rate limiter: close TOCTOU race with advisory lock
-- Run ONCE in Supabase → SQL Editor.
-- Idempotent and safe to re-run (CREATE OR REPLACE).
--
-- Problem: the SELECT COUNT + INSERT in check_rate_limit are not atomic under
-- READ COMMITTED. Two concurrent requests can both read count = N-1 (under
-- limit), both insert, and the real count becomes N+1 — exceeding the cap.
--
-- Fix: a transaction-scoped advisory lock on the (bucket, identifier) pair
-- serialises concurrent calls for the same limiter key. Different keys are
-- still fully concurrent. pg_advisory_xact_lock is released automatically
-- at COMMIT/ROLLBACK, which plpgsql does implicitly at function exit.
-- ===========================================================================

CREATE OR REPLACE FUNCTION check_rate_limit(
    p_bucket     TEXT,
    p_identifier TEXT,
    p_max        INTEGER,
    p_window_sec INTEGER
) RETURNS BOOLEAN
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
    v_window_start TIMESTAMPTZ := NOW() - make_interval(secs => p_window_sec);
    v_count        INTEGER;
BEGIN
    -- Serialise concurrent calls for the same (bucket, identifier). Different
    -- keys hash differently and do not block each other. The lock is released
    -- at function exit (transaction commit).
    PERFORM pg_advisory_xact_lock(hashtext(p_bucket || '|' || p_identifier));

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

REVOKE ALL ON FUNCTION check_rate_limit(TEXT, TEXT, INTEGER, INTEGER) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION check_rate_limit(TEXT, TEXT, INTEGER, INTEGER)
    TO anon, authenticated, service_role;
