-- ===========================================================================
-- Elchi — Phase 2: pin search_path on every SECURITY DEFINER function
-- Run ONCE in Supabase → SQL Editor. Idempotent and safe to re-run.
--
-- A SECURITY DEFINER function runs as its owner. If its search_path is not
-- pinned, the caller controls which schema an unqualified name resolves to,
-- so any role able to create objects in an earlier schema can shadow a table
-- or function the body references and have it executed as the owner. This is
-- the standard Postgres definer-function escalation, and Supabase's own linter
-- flags it as `function_search_path_mutable`.
--
-- `handle_new_user` fires on every auth.users insert and was the one function
-- still missing the guard. `check_rate_limit` already pinned `public`; it is
-- re-declared here only to append pg_temp, which must come last so a temp
-- table can never shadow a real one.
--
-- Both bodies are otherwise unchanged from their previous migrations.
-- ===========================================================================

-- ---------------------------------------------------------------------------
-- handle_new_user — populates profiles from auth.users on signup.
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION handle_new_user()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
BEGIN
    INSERT INTO public.profiles (id, email, display_name, avatar_url, auth_provider, telegram_id, telegram_username)
    VALUES (
        NEW.id,
        COALESCE(NEW.email, NEW.raw_user_meta_data->>'email'),
        COALESCE(NEW.raw_user_meta_data->>'display_name', NEW.raw_user_meta_data->>'full_name', NEW.raw_user_meta_data->>'name'),
        COALESCE(NEW.raw_user_meta_data->>'avatar_url', NEW.raw_user_meta_data->>'picture'),
        COALESCE(NEW.raw_user_meta_data->>'provider', NEW.raw_app_meta_data->>'provider'),
        (NEW.raw_user_meta_data->>'telegram_id')::BIGINT,
        NEW.raw_user_meta_data->>'telegram_username'
    );
    RETURN NEW;
END;
$$;

-- The trigger keeps pointing at the same function name; re-created so a fresh
-- run of this file leaves a coherent state either way.
DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
CREATE TRIGGER on_auth_user_created
    AFTER INSERT ON auth.users
    FOR EACH ROW EXECUTE FUNCTION handle_new_user();

-- ---------------------------------------------------------------------------
-- check_rate_limit — append pg_temp so it sorts last in the resolution order.
-- ---------------------------------------------------------------------------
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
