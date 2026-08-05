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
    -- 'announcement' is a standing ad (a cargo service, an agency) rather than
    -- one trip: it carries a headline, a body, a route and a contact, and none
    -- of the cities/date/cargo columns. See posts_shape_by_type_check below.
    type VARCHAR(20) NOT NULL CHECK (type IN ('traveler', 'request', 'announcement')),

    -- Route. Cities are NULL on announcements.
    direction VARCHAR(3) CHECK (direction IN ('k2u', 'u2k')),
    from_city VARCHAR(100),
    to_city VARCHAR(100),
    -- NULL means "no fixed date" — an announcement, or a request whose date is
    -- negotiated directly with the traveler.
    date DATE,

    -- Capacity / cargo (structured). All zero/empty on announcements.
    weight_kg NUMERIC(6,2) NOT NULL DEFAULT 0,
    luggage_count SMALLINT NOT NULL DEFAULT 0,
    categories TEXT[] NOT NULL DEFAULT '{}',
    category_other TEXT,
    -- Display cache, e.g. "5 kg + 2 chamadon" or "3 kg · Hujjatlar, Dori-darmon".
    -- Stays NOT NULL: the feed card matches on it without a guard, so an
    -- announcement stores '' rather than NULL.
    weight TEXT NOT NULL,

    -- Announcement headline. NULL on parcel posts.
    headline VARCHAR(120),

    -- The free-text body of an ad: an optional remark on a parcel post, the
    -- required body copy on an announcement.
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

-- Drop the view before touching column types. `ALTER COLUMN ... TYPE` runs its
-- dependency scan whether or not the type actually changes, so on any re-run of
-- this file the `weight` statement below would fail with "cannot alter type of
-- a column used by a view or rule". The view is recreated further down.
DROP VIEW IF EXISTS public_posts;

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

-- Columns this file's policies, view and indexes reference but never created:
-- they arrived via migrations/2026-07-22-posts-user-id.sql and
-- migrations/2026-07-23-post-countries.sql, so a fresh run of this file alone
-- used to fail on the first policy that mentions them.
ALTER TABLE posts ADD COLUMN IF NOT EXISTS user_id UUID REFERENCES auth.users(id) ON DELETE SET NULL;
ALTER TABLE posts ADD COLUMN IF NOT EXISTS from_country VARCHAR(2);
ALTER TABLE posts ADD COLUMN IF NOT EXISTS to_country VARCHAR(2);
-- Which corridor an announcement is listed under: the FAR country of the
-- corridor its author was browsing when they posted. An announcement sits in
-- one country (from_country) and that alone cannot place it on the board,
-- because every corridor has Uzbekistan on the near side — a Tashkent note
-- would otherwise belong to all of them at once. NULL on parcel posts, whose
-- corridor is already stated by from_country/to_country. See
-- migrations/2026-08-01-announcement-corridor.sql.
ALTER TABLE posts ADD COLUMN IF NOT EXISTS corridor_country VARCHAR(2);
CREATE INDEX IF NOT EXISTS idx_posts_user_id ON posts(user_id);
CREATE INDEX IF NOT EXISTS idx_posts_route ON posts(from_country, to_country);
-- The announcement feed filters on corridor_country alone, which a lookup
-- against idx_posts_route cannot use.
CREATE INDEX IF NOT EXISTS idx_posts_corridor
    ON posts (corridor_country) WHERE type = 'announcement';
-- Serves the notes board only: `type = 'announcement'` is a single value, so
-- this composite is scanned with created_at already ordered underneath it and
-- no sort node. The parcel board's `type IN ('traveler','request')` cannot use
-- it — a ScalarArrayOp scan orders rows only within each type value, so the
-- planner ignores the index and does a full scan plus top-N sort. That path
-- wants a plain (created_at DESC) index instead. See
-- migrations/2026-08-05-posts-created-at-index.sql for the measurements and for
-- why the view's expires_at filter cannot become a partial-index predicate.
CREATE INDEX IF NOT EXISTS idx_posts_type_created
    ON posts (type, created_at DESC);

DO $$
BEGIN
    -- Shape only, not a fixed country list: adding a corridor is an API change
    -- (ALLOWED_COUNTRIES in api/posts.ts), never a migration.
    IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'posts_from_country_check') THEN
        ALTER TABLE posts ADD CONSTRAINT posts_from_country_check
            CHECK (from_country IS NULL OR from_country ~ '^[A-Z]{2}$');
    END IF;
    IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'posts_to_country_check') THEN
        ALTER TABLE posts ADD CONSTRAINT posts_to_country_check
            CHECK (to_country IS NULL OR to_country ~ '^[A-Z]{2}$');
    END IF;
    IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'posts_corridor_country_check') THEN
        ALTER TABLE posts ADD CONSTRAINT posts_corridor_country_check
            CHECK (corridor_country IS NULL OR corridor_country ~ '^[A-Z]{2}$');
    END IF;
END $$;

-- Korea is the only corridor the board has ever served, so every announcement
-- written before the column existed belongs to it — including the Uzbek-side
-- ones, which is the point: they were written for the Korea board and must not
-- follow the next corridor that opens.
UPDATE posts
SET corridor_country = COALESCE(NULLIF(from_country, 'UZ'), 'KR')
WHERE type = 'announcement' AND corridor_country IS NULL;

-- Announcements — see migrations/2026-08-01-announcements.sql for the reasoning
-- behind each statement in this block.
--
-- The type CHECK is NOT wrapped in the pg_constraint guard used above: it was
-- declared inline on the column in CREATE TABLE, so it already exists under the
-- name `posts_type_check` in every deployed database. The guard would find it
-- and skip, silently leaving the old two-value list in place.
ALTER TABLE posts DROP CONSTRAINT IF EXISTS posts_type_check;
ALTER TABLE posts ADD  CONSTRAINT posts_type_check
    CHECK (type IN ('traveler', 'request', 'announcement'));

ALTER TABLE posts ADD COLUMN IF NOT EXISTS headline VARCHAR(120);

-- An announcement has no cities and no date; `date` additionally covers a
-- parcel request whose date is negotiable, which previously tried to store the
-- string "flexible" in a DATE column and failed.
ALTER TABLE posts ALTER COLUMN from_city DROP NOT NULL;
ALTER TABLE posts ALTER COLUMN to_city   DROP NOT NULL;
ALTER TABLE posts ALTER COLUMN date      DROP NOT NULL;

-- Keeps the relaxation above from weakening parcel posts: cities and weight
-- stay mandatory for traveler/request, enforced in the database rather than
-- only in api/posts.ts. NOT VALID so it cannot fail on a legacy row.
ALTER TABLE posts DROP CONSTRAINT IF EXISTS posts_shape_by_type_check;
ALTER TABLE posts ADD  CONSTRAINT posts_shape_by_type_check CHECK (
    CASE type
      WHEN 'announcement' THEN
          -- The headline is optional: the composer is a single text box, so
          -- only older two-field rows carry one.
              note     IS NOT NULL AND btrim(note)     <> ''
          AND date IS NULL
          AND from_city IS NULL AND to_city IS NULL
          AND weight = ''
          AND weight_kg = 0 AND luggage_count = 0
          AND categories = '{}'::TEXT[] AND category_other IS NULL
          -- An announcement sits in ONE country: it is a standing service, not
          -- a delivery in a direction.
          AND from_country IS NOT NULL
          AND to_country IS NULL
          -- ...but the board lists corridors, not countries, and every corridor
          -- has Uzbekistan on one side — so a note sitting at home cannot say
          -- which corridor it is for. corridor_country records the answer
          -- instead of the feed guessing it. See
          -- migrations/2026-08-01-announcement-corridor.sql.
          AND corridor_country IS NOT NULL
          AND corridor_country <> 'UZ'
          AND from_country IN (corridor_country, 'UZ')
      ELSE
              headline IS NULL
          AND from_city IS NOT NULL AND btrim(from_city) <> ''
          AND to_city   IS NOT NULL AND btrim(to_city)   <> ''
          AND btrim(weight) <> ''
          -- The route countries are the direction of a parcel post, not just
          -- its filter key, and `authenticated` can insert through PostgREST
          -- without going past api/posts.ts. A row with neither one renders
          -- backwards (the card falls back to KR → UZ) and is invisible to
          -- every corridor filter. See
          -- migrations/2026-08-01-parcel-route-required.sql.
          AND from_country IS NOT NULL
          AND to_country   IS NOT NULL
          AND from_country <> to_country
          -- A parcel post's corridor is its route. One fact, one column.
          AND corridor_country IS NULL
    END
) NOT VALID;

CREATE INDEX IF NOT EXISTS idx_posts_user_announcement
    ON posts (user_id) WHERE type = 'announcement';

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
    p.corridor_country,
    p.from_city,
    p.to_city,
    p.date,
    p.weight_kg,
    p.luggage_count,
    p.categories,
    p.category_other,
    p.weight,
    p.headline,
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
-- One active announcement per author
-- ---------------------------------------------------------------------------
-- Parcel ads are one-off; a standing service ad is not, so without a cap one
-- agency can paper the board with the same offer.
--
-- This cannot be a partial unique index: the predicate would need
-- `expires_at >= CURRENT_DATE`, and CURRENT_DATE is STABLE while index
-- predicates must be IMMUTABLE (Postgres rejects it with 42P17). Nor can it
-- live in api/posts.ts alone — `authenticated` can INSERT through PostgREST
-- with the bundled anon key, so the API is not in every writer's path.
-- A BEFORE INSERT trigger has neither problem.
CREATE OR REPLACE FUNCTION has_active_announcement(p_user UUID)
RETURNS BOOLEAN
LANGUAGE sql
SECURITY DEFINER
SET search_path = public, pg_temp
STABLE
AS $$
    SELECT EXISTS (
        SELECT 1 FROM posts p
        WHERE p.user_id = p_user
          AND p.type = 'announcement'
          AND p.expires_at >= CURRENT_DATE
    );
$$;

-- Not granted to `authenticated`: it takes an arbitrary user id, so exposing it
-- would let any logged-in caller probe another user. The trigger calls it as
-- the definer and needs no grant.
REVOKE ALL ON FUNCTION has_active_announcement(UUID) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION has_active_announcement(UUID) TO service_role;

-- SECURITY DEFINER is mandatory here, not stylistic. A trigger function runs
-- with the privileges of whoever fired it — `authenticated`, which holds only
-- GRANT SELECT (id, user_id) ON posts. Postgres requires SELECT on every column
-- a statement references, so an invoker-rights version reading `type` and
-- `expires_at` would fail with "permission denied for table posts" and turn
-- every announcement insert into a 500.
--
-- ERRCODE 23505 so supabase-js surfaces error.code and the API can answer 409
-- rather than 500; `posts` has no unique constraint besides the primary key.
CREATE OR REPLACE FUNCTION enforce_one_active_announcement()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
BEGIN
    IF NEW.type = 'announcement'
       AND NEW.user_id IS NOT NULL
       AND has_active_announcement(NEW.user_id)
    THEN
        RAISE EXCEPTION 'user already has an active announcement'
            USING ERRCODE = '23505';
    END IF;
    RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS one_active_announcement ON posts;
CREATE TRIGGER one_active_announcement
    BEFORE INSERT ON posts
    FOR EACH ROW EXECUTE FUNCTION enforce_one_active_announcement();

-- ---------------------------------------------------------------------------
-- An announcement's corridor, when the writer omits it
-- ---------------------------------------------------------------------------
-- corridor_country is mandatory on announcements, but api/posts.ts is not every
-- writer: `authenticated` can INSERT through PostgREST with the bundled anon
-- key, and a cached bundle outlives a deploy. A note sitting in the corridor's
-- far country names its own corridor, so that case is derived rather than
-- refused. A note sitting in the home country is NOT guessed — Uzbekistan is on
-- the near side of every corridor, so there is no honest answer, and it fails
-- posts_shape_by_type_check instead. See
-- migrations/2026-08-02-announcement-corridor-default.sql.
--
-- Unlike the trigger above, this reads no table — it only edits the row being
-- inserted — so it needs no SECURITY DEFINER.
CREATE OR REPLACE FUNCTION default_announcement_corridor()
RETURNS TRIGGER
LANGUAGE plpgsql
AS $$
BEGIN
    IF NEW.type = 'announcement' AND NEW.corridor_country IS NULL THEN
        NEW.corridor_country := NULLIF(NEW.from_country, 'UZ');
    END IF;
    RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS announcement_corridor_default ON posts;
CREATE TRIGGER announcement_corridor_default
    BEFORE INSERT ON posts
    FOR EACH ROW EXECUTE FUNCTION default_announcement_corridor();

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
