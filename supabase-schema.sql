-- SQL Migration for Elchi Database Schema (Supabase / PostgreSQL)
--
-- This file is the full desired state. It is idempotent: running it against a
-- fresh project creates everything, and running it against the existing project
-- applies the migrations in the "Migrations" section below.

-- Enable UUID extension if not enabled
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- ---------------------------------------------------------------------------
-- posts
-- ---------------------------------------------------------------------------
-- Every value the post form collects gets its own column. `weight` is kept as a
-- pre-rendered display string, but it is a cache: weight_kg / luggage_count /
-- categories are the source of truth and are what queries and filters use.
CREATE TABLE IF NOT EXISTS posts (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    type VARCHAR(20) NOT NULL CHECK (type IN ('traveler', 'request')),

    -- Route
    direction VARCHAR(3) CHECK (direction IN ('k2u', 'u2k')),
    from_city VARCHAR(100) NOT NULL,
    to_city VARCHAR(100) NOT NULL,
    date DATE NOT NULL,

    -- Capacity / cargo (structured)
    weight_kg NUMERIC(6,2) NOT NULL DEFAULT 0,
    luggage_count SMALLINT NOT NULL DEFAULT 0,
    categories TEXT[] NOT NULL DEFAULT '{}',
    category_other TEXT,
    -- Display cache, e.g. "5 kg + 2 chamadon" or "3 kg · Hujjatlar, Dori-darmon"
    weight TEXT NOT NULL,

    note TEXT,

    -- Contacts. *_type records which channel the handle belongs to, so the UI
    -- can build tg://resolve vs tel: links without sniffing a leading "@".
    contact VARCHAR(100) NOT NULL,
    contact_type VARCHAR(10) CHECK (contact_type IN ('telegram', 'phone')),
    contact2 VARCHAR(100),
    contact2_type VARCHAR(10) CHECK (contact2_type IN ('telegram', 'phone')),

    created_at TIMESTAMPTZ DEFAULT NOW(),
    expires_at DATE NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_posts_expires_at ON posts(expires_at);
CREATE INDEX IF NOT EXISTS idx_posts_type ON posts(type);

-- ---------------------------------------------------------------------------
-- Migrations for existing databases
-- ---------------------------------------------------------------------------

-- Widen `weight` so multi-category requests don't overflow the old VARCHAR(50)
-- limit, which caused inserts to fail with SQLSTATE 22001.
ALTER TABLE posts ALTER COLUMN weight TYPE TEXT;

-- Structured route / cargo / contact columns.
ALTER TABLE posts ADD COLUMN IF NOT EXISTS direction VARCHAR(3);
ALTER TABLE posts ADD COLUMN IF NOT EXISTS weight_kg NUMERIC(6,2) NOT NULL DEFAULT 0;
ALTER TABLE posts ADD COLUMN IF NOT EXISTS luggage_count SMALLINT NOT NULL DEFAULT 0;
ALTER TABLE posts ADD COLUMN IF NOT EXISTS categories TEXT[] NOT NULL DEFAULT '{}';
ALTER TABLE posts ADD COLUMN IF NOT EXISTS category_other TEXT;
ALTER TABLE posts ADD COLUMN IF NOT EXISTS contact_type VARCHAR(10);
ALTER TABLE posts ADD COLUMN IF NOT EXISTS contact2_type VARCHAR(10);

-- These two depend on columns that only exist after the ADD COLUMN block
-- above, so they must run after it (on a fresh install the columns already
-- exist from CREATE TABLE, but CREATE TABLE IF NOT EXISTS is a no-op when
-- the table is already present, so the ordering here has to hold either way).
CREATE INDEX IF NOT EXISTS idx_posts_direction ON posts(direction);
CREATE INDEX IF NOT EXISTS idx_posts_categories ON posts USING GIN (categories);

DO $$
BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'posts_direction_check') THEN
        ALTER TABLE posts ADD CONSTRAINT posts_direction_check
            CHECK (direction IN ('k2u', 'u2k'));
    END IF;
    IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'posts_contact_type_check') THEN
        ALTER TABLE posts ADD CONSTRAINT posts_contact_type_check
            CHECK (contact_type IN ('telegram', 'phone'));
    END IF;
    IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'posts_contact2_type_check') THEN
        ALTER TABLE posts ADD CONSTRAINT posts_contact2_type_check
            CHECK (contact2_type IN ('telegram', 'phone'));
    END IF;
END $$;

-- Backfill the new columns for rows written before this migration, by parsing
-- the legacy `weight` display string and the "@" convention on contacts.
UPDATE posts SET
    weight_kg = COALESCE((substring(weight from '([0-9]+(?:\.[0-9]+)?)\s*kg'))::NUMERIC, 0)
WHERE weight_kg = 0 AND weight ~ '[0-9]+\s*kg';

UPDATE posts SET
    luggage_count = COALESCE((substring(weight from '([0-9]+)\s*chamadon'))::SMALLINT, 0)
WHERE luggage_count = 0 AND weight ~ '[0-9]+\s*chamadon';

UPDATE posts SET contact_type = CASE WHEN contact LIKE '@%' THEN 'telegram' ELSE 'phone' END
WHERE contact_type IS NULL;

UPDATE posts SET contact2_type = CASE WHEN contact2 LIKE '@%' THEN 'telegram' ELSE 'phone' END
WHERE contact2_type IS NULL AND contact2 IS NOT NULL;

-- Price was removed from the post form; the column is no longer written or read.
ALTER TABLE posts DROP COLUMN IF EXISTS price;

-- The report button was removed from the UI, so the table has no writer left.
DROP TABLE IF EXISTS reports;

-- TODO: Add images column for v2 (e.g. image_url TEXT)
-- ALTER TABLE posts ADD COLUMN image_url TEXT;

-- ---------------------------------------------------------------------------
-- Row Level Security
-- ---------------------------------------------------------------------------
-- Reading the table directly is NOT public. The anon key ships inside the
-- browser bundle, so a world-readable `posts` table means anyone can download
-- every active post's phone number and Telegram handle straight from PostgREST,
-- bypassing the API entirely. Instead:
--   * anon reads the `public_posts` view (no contact values, no user_id);
--   * authenticated gets a column-level SELECT grant on (id, user_id) only;
--   * contact values come one at a time from get_post_contact().
-- Creating a post requires a logged-in author (user_id must equal auth.uid()),
-- so the shipped anon key cannot insert or attribute a post to someone else.
-- There is no UPDATE policy, so posts can't be tampered with; DELETE is scoped
-- to the author only.
ALTER TABLE posts ENABLE ROW LEVEL SECURITY;

-- Kept defined (scoped to authenticated) so that if a SELECT grant is ever
-- restored by hand, the table does not silently become world-readable again.
-- With the grants below it governs only the (id, user_id) columns.
DROP POLICY IF EXISTS "Allow public read access to active posts" ON posts;
DROP POLICY IF EXISTS "Authenticated users read active posts" ON posts;
CREATE POLICY "Authenticated users read active posts"
ON posts FOR SELECT
TO authenticated
USING (expires_at >= CURRENT_DATE);

REVOKE SELECT ON posts FROM anon;
REVOKE SELECT ON posts FROM authenticated;

-- Column-level grant: enough for `DELETE ... WHERE id = ? AND user_id = ?`
-- (Postgres requires SELECT on every column a statement references), for the
-- `.select('id')` that follows an insert, and for the profile post count.
-- Not enough to read a single contact value.
GRANT SELECT (id, user_id) ON posts TO authenticated;

DROP POLICY IF EXISTS "Allow public inserts to posts" ON posts;
DROP POLICY IF EXISTS "Authenticated users insert own posts" ON posts;
CREATE POLICY "Authenticated users insert own posts"
ON posts FOR INSERT
WITH CHECK (auth.uid() IS NOT NULL AND user_id = auth.uid());

DROP POLICY IF EXISTS "Users can delete own posts" ON posts;
CREATE POLICY "Users can delete own posts"
ON posts FOR DELETE
USING (auth.uid() = user_id);

-- ---------------------------------------------------------------------------
-- public_posts — the board's read model
-- ---------------------------------------------------------------------------
-- Everything the feed needs to render, minus the contact values and minus
-- user_id. Deliberately a SECURITY DEFINER view (security_invoker = false): it
-- runs as its owner and bypasses the `posts` RLS above, which is what lets anon
-- read the non-sensitive columns while having no access to the table itself.
-- The expires_at filter is reproduced here so the view cannot leak expired rows.
--
-- contact_type / contact2_type are exposed (telegram vs phone) but the handles
-- are not, so the UI can render the right icon before the viewer logs in.
-- Requires PostgreSQL 15+ for the security_invoker option.
DROP VIEW IF EXISTS public_posts;
CREATE VIEW public_posts
WITH (security_invoker = false) AS
SELECT
    p.id,
    p.type,
    p.direction,
    p.from_country,
    p.to_country,
    p.from_city,
    p.to_city,
    p.date,
    p.weight_kg,
    p.luggage_count,
    p.categories,
    p.category_other,
    p.weight,
    p.note,
    p.contact_type,
    p.contact2_type,
    (p.contact2 IS NOT NULL) AS has_contact2,
    p.created_at,
    p.expires_at
FROM posts p
WHERE p.expires_at >= CURRENT_DATE;

GRANT SELECT ON public_posts TO anon, authenticated;

-- The only route to a contact value: one post per call, authenticated callers
-- only, so harvesting requires an account and is rate-limitable per user.
-- SECURITY DEFINER so it can read columns the caller's own grants exclude;
-- search_path is pinned so the definer context can't be hijacked.
CREATE OR REPLACE FUNCTION get_post_contact(p_id UUID)
RETURNS TABLE (
    contact       TEXT,
    contact_type  TEXT,
    contact2      TEXT,
    contact2_type TEXT
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
BEGIN
    IF auth.uid() IS NULL THEN
        RAISE EXCEPTION 'authentication required' USING ERRCODE = '42501';
    END IF;

    RETURN QUERY
    SELECT p.contact::TEXT, p.contact_type::TEXT, p.contact2::TEXT, p.contact2_type::TEXT
    FROM posts p
    WHERE p.id = p_id AND p.expires_at >= CURRENT_DATE;
END;
$$;

REVOKE ALL ON FUNCTION get_post_contact(UUID) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION get_post_contact(UUID) TO authenticated, service_role;

-- ---------------------------------------------------------------------------
-- profiles (Supabase Auth)
-- ---------------------------------------------------------------------------
-- Auth is not wired into posts: posts stay anonymous and carry no user_id.
-- These tables exist for the login flow only (Google OAuth and a Telegram
-- bridge via admin.createUser — see api/auth-telegram.ts). Email login is
-- intentionally disabled.
CREATE TABLE IF NOT EXISTS profiles (
    id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
    email TEXT,
    display_name TEXT,
    avatar_url TEXT,
    auth_provider TEXT NOT NULL CHECK (auth_provider IN ('google', 'telegram')),
    telegram_id BIGINT UNIQUE,
    telegram_username TEXT,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Populates profiles from auth.users on signup, regardless of provider.
-- email comes from auth.users.email (the real gmail for Google; the synthetic
-- telegram_<id>@elchi.local for the Telegram bridge), so Google rows are no
-- longer missing their address. display_name/avatar come from user metadata
-- (google: full_name/name + picture; telegram: display_name + avatar_url).
-- search_path is pinned because this is a SECURITY DEFINER function firing on
-- every auth.users insert: without it, a role that can create objects in an
-- earlier schema could shadow `profiles` and have its own table written to as
-- the function owner. pg_temp comes last so a temp table can't shadow a real
-- one either.
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

DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
CREATE TRIGGER on_auth_user_created
    AFTER INSERT ON auth.users
    FOR EACH ROW EXECUTE FUNCTION handle_new_user();

ALTER TABLE profiles ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Users can read own profile" ON profiles;
CREATE POLICY "Users can read own profile"
ON profiles FOR SELECT
USING (auth.uid() = id);

DROP POLICY IF EXISTS "Users can update own profile" ON profiles;
CREATE POLICY "Users can update own profile"
ON profiles FOR UPDATE
USING (auth.uid() = id)
WITH CHECK (auth.uid() = id);

-- ---------------------------------------------------------------------------
-- rate_limits (API throttle)
-- ---------------------------------------------------------------------------
-- Postgres-backed fixed-window limiter for the serverless API (see
-- lib/rate-limit.ts). One row per allowed request, keyed by (bucket,
-- identifier). Only the service-role client touches it: RLS is ON with no
-- policies, so the anon key can neither read nor write it.
CREATE TABLE IF NOT EXISTS rate_limits (
    id         BIGSERIAL PRIMARY KEY,
    bucket     TEXT        NOT NULL,
    identifier TEXT        NOT NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_rate_limits_lookup
    ON rate_limits (bucket, identifier, created_at);

ALTER TABLE rate_limits ENABLE ROW LEVEL SECURITY;

-- Fixed-window check as a SECURITY DEFINER function so the API enforces limits
-- with the public anon key (no service-role key needed). Prunes aged rows,
-- counts live hits, records the current one, and returns true when under the
-- limit. Runs as owner, bypassing RLS, so anon never touches the table directly.
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
