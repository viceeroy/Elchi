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
    -- Two shapes, one table: 'traveler' (flying, has spare luggage space) and
    -- 'request' (has a parcel). They share every column — the split is which
    -- side of the same trade the author is on. See posts_shape_by_type_check
    -- below, which is now a single predicate for exactly that reason.
    --
    -- A third type, 'announcement' (a standing service ad), lived here until
    -- 2026-08-07. Rows written under it are kept but retired: public_posts
    -- filters them out, and both CHECKs are NOT VALID so they are never
    -- re-examined. See migrations/2026-08-07-remove-announcements.sql.
    type VARCHAR(20) NOT NULL CHECK (type IN ('traveler', 'request')),

    -- Route.
    direction VARCHAR(3) CHECK (direction IN ('k2u', 'u2k')),
    from_city VARCHAR(100),
    to_city VARCHAR(100),
    -- NULL means "no fixed date" — a request whose date is negotiated directly
    -- with the traveler.
    date DATE,

    -- Capacity / cargo (structured).
    weight_kg NUMERIC(6,2) NOT NULL DEFAULT 0,
    luggage_count SMALLINT NOT NULL DEFAULT 0,
    categories TEXT[] NOT NULL DEFAULT '{}',
    category_other TEXT,
    -- Display cache, e.g. "5 kg + 2 chamadon" or "3 kg · Hujjatlar, Dori-darmon".
    -- Stays NOT NULL: the feed card matches on it without a guard.
    weight TEXT NOT NULL,

    -- Retired announcement headline. Always NULL on a parcel post — the shape
    -- constraint requires it — and kept only because the retired rows still
    -- hold theirs.
    headline VARCHAR(120),

    -- The free-text body of an ad: an optional remark on a parcel post.
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
-- corridor_country lived here until 2026-08-07. It existed solely so a standing
-- announcement — which sits in ONE country, and so cannot name its own corridor
-- when that country is Uzbekistan — could say which board it belonged to. A
-- parcel post's corridor has always been its own route, so the column was
-- required to be NULL on every surviving row. Dropped with the type. See
-- migrations/2026-08-07-remove-announcements.sql.
ALTER TABLE posts DROP CONSTRAINT IF EXISTS posts_corridor_country_check;
ALTER TABLE posts DROP COLUMN IF EXISTS corridor_country;
CREATE INDEX IF NOT EXISTS idx_posts_user_id ON posts(user_id);
CREATE INDEX IF NOT EXISTS idx_posts_route ON posts(from_country, to_country);
-- Every list request ends in ORDER BY created_at DESC LIMIT n OFFSET m, and
-- this is the index that serves it: scanned in order, with `type` demoted to a
-- filter. The old composite (type, created_at DESC) is dropped rather than
-- kept — it only ever helped the single-value `type = 'announcement'` lookup.
-- The surviving `type IN ('traveler','request')` is a ScalarArrayOp scan that
-- orders rows only within each type value, so the planner ignored the composite
-- and did a full scan plus top-N sort: 33,333 rows / 12.2 ms against 36 rows /
-- 0.06 ms here, measured on 50k synthetic rows. See
-- migrations/2026-08-05-posts-created-at-index.sql for those measurements and
-- for why the view's expires_at filter cannot become a partial-index predicate.
DROP INDEX IF EXISTS idx_posts_type_created;
CREATE INDEX IF NOT EXISTS idx_posts_created_at ON posts (created_at DESC);
CREATE INDEX IF NOT EXISTS idx_posts_date_created ON posts (date ASC, created_at DESC);

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
END $$;

-- The type CHECK is NOT wrapped in the pg_constraint guard used above: it was
-- declared inline on the column in CREATE TABLE, so it already exists under the
-- name `posts_type_check` in every deployed database. The guard would find it
-- and skip, silently leaving the older list in place.
--
-- NOT VALID because the retired announcement rows are kept: Postgres applies a
-- NOT VALID CHECK to inserts and updates only and never re-scans the table, and
-- `posts` has no UPDATE policy, so those rows can never be re-examined. New
-- rows are gated in full.
ALTER TABLE posts DROP CONSTRAINT IF EXISTS posts_type_check;
ALTER TABLE posts ADD  CONSTRAINT posts_type_check
    CHECK (type IN ('traveler', 'request')) NOT VALID;

ALTER TABLE posts ADD COLUMN IF NOT EXISTS headline VARCHAR(120);

-- `date` covers a parcel request whose date is negotiable, which previously
-- tried to store the string "flexible" in a DATE column and failed. from_city /
-- to_city were relaxed for the announcement shape and stay relaxed at the
-- column level; the constraint below is what makes them mandatory again.
ALTER TABLE posts ALTER COLUMN from_city DROP NOT NULL;
ALTER TABLE posts ALTER COLUMN to_city   DROP NOT NULL;
ALTER TABLE posts ALTER COLUMN date      DROP NOT NULL;

-- Keeps the relaxation above from weakening parcel posts: cities and weight
-- stay mandatory, enforced in the database rather than only in api/posts.ts.
--
-- No CASE any more — with announcements gone there is one shape, and
-- posts_type_check above admits nothing else. NOT VALID for both the original
-- reason (legacy rows predating the constraint) and the new one (the retired
-- announcement rows, which this predicate would reject).
ALTER TABLE posts DROP CONSTRAINT IF EXISTS posts_shape_by_type_check;
ALTER TABLE posts ADD  CONSTRAINT posts_shape_by_type_check CHECK (
        headline IS NULL
    AND from_city IS NOT NULL AND btrim(from_city) <> ''
    AND to_city   IS NOT NULL AND btrim(to_city)   <> ''
    AND btrim(weight) <> ''
    -- The route countries are the direction of a parcel post, not just its
    -- filter key, and `authenticated` can insert through PostgREST without
    -- going past api/posts.ts. A row with neither one renders backwards (the
    -- card falls back to KR → UZ) and is invisible to every corridor filter.
    -- See migrations/2026-08-01-parcel-route-required.sql.
    AND from_country IS NOT NULL
    AND to_country   IS NOT NULL
    AND from_country <> to_country
) NOT VALID;

DROP INDEX IF EXISTS idx_posts_corridor;
DROP INDEX IF EXISTS idx_posts_user_announcement;

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

-- public_posts — the board's read model — used to be defined here. It now
-- joins `profiles` for the author's display_name, so it cannot be created
-- until that table exists; it lives immediately after the profiles section
-- below. get_post_contact() stays here because it reads `posts` only.

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
-- Retired announcement machinery
-- ---------------------------------------------------------------------------
-- Two BEFORE INSERT triggers used to fire on every row written to this table:
-- one_active_announcement (a one-standing-ad-per-author cap, raising SQLSTATE
-- 23505 so the API could answer 409) and announcement_corridor_default (which
-- derived a missing corridor_country from from_country). Both opened with
-- `IF NEW.type = 'announcement'`, so with the type gone they are pure overhead
-- on every parcel insert. Dropped along with the functions behind them —
-- has_active_announcement() had no other caller.
-- See migrations/2026-08-07-remove-announcements.sql.
DROP TRIGGER  IF EXISTS one_active_announcement       ON posts;
DROP TRIGGER  IF EXISTS announcement_corridor_default ON posts;
DROP FUNCTION IF EXISTS enforce_one_active_announcement();
DROP FUNCTION IF EXISTS default_announcement_corridor();
DROP FUNCTION IF EXISTS has_active_announcement(UUID);

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
    -- The name printed on every card this user posts. Seeded from provider
    -- metadata on signup, but not trusted to be there: Google can hand back a
    -- row with no name and the Telegram bridge only has a first name, so the
    -- client shows a blocking capture step after login whenever this is NULL
    -- (src/components/NameGateModal.tsx). Nullable on purpose — every row that
    -- predates the gate is NULL until its owner next logs in.
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
-- longer missing their address. avatar_url comes from user metadata (google:
-- picture; telegram: avatar_url). display_name deliberately does NOT — it is
-- the one column the user fills in themselves.
-- search_path is pinned because this is a SECURITY DEFINER function firing on
-- every auth.users insert: without it, a role that can create objects in an
-- earlier schema could shadow `profiles` and have its own table written to as
-- the function owner. pg_temp comes last so a temp table can't shadow a real
-- one either.
-- An earlier version of this file seeded display_name from provider metadata
-- through a normalize_display_name() helper. Both are gone: see the trigger
-- body below for why, and 2026-08-06-display-name-user-entered.sql for the
-- migration that removed them from live databases.
-- Re-added: we now want to auto-fill display_name again.
CREATE OR REPLACE FUNCTION normalize_display_name(raw TEXT)
RETURNS TEXT
LANGUAGE sql IMMUTABLE
AS $$
    SELECT CASE 
        WHEN raw IS NULL THEN 'Foydalanuvchi'
        WHEN char_length(btrim(raw)) BETWEEN 2 AND 40 THEN btrim(raw)
        ELSE 'Foydalanuvchi'
    END;
$$;
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
        normalize_display_name(COALESCE(NEW.raw_user_meta_data->>'display_name', NEW.raw_user_meta_data->>'full_name', NEW.raw_user_meta_data->>'name', NEW.raw_user_meta_data->>'first_name')),
        COALESCE(NEW.raw_user_meta_data->>'avatar_url', NEW.raw_user_meta_data->>'picture'),
        -- Derived, not copied. auth_provider is NOT NULL with a two-value
        -- CHECK, but the metadata can say 'email' (the oldest accounts do) or
        -- say nothing at all — and since this trigger runs inside the signup
        -- transaction, a value the CHECK rejects fails the whole signup. The
        -- synthetic address the Telegram bridge mints is what reliably tells
        -- the two apart; everything else is the only other login on offer.
        CASE
            WHEN COALESCE(NEW.email, '') LIKE 'telegram\_%@elchi.local' THEN 'telegram'
            WHEN NEW.raw_user_meta_data->>'telegram_id' IS NOT NULL THEN 'telegram'
            ELSE 'google'
        END,
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

-- The trigger above only fires on INSERT, so it cannot reach accounts that
-- already existed when it was first created (2026-07-22) — and a missing
-- profiles row is silent until something writes to it, at which point an
-- own-row UPDATE matches nothing and PostgREST reports success anyway. This
-- reconciles the two tables on every run. See
-- migrations/2026-08-06-backfill-missing-profiles.sql.
INSERT INTO profiles (id, email, display_name, avatar_url, auth_provider, telegram_id, telegram_username)
SELECT
    u.id,
    COALESCE(u.email, u.raw_user_meta_data->>'email'),
    normalize_display_name(COALESCE(u.raw_user_meta_data->>'display_name', u.raw_user_meta_data->>'full_name', u.raw_user_meta_data->>'name', u.raw_user_meta_data->>'first_name')),
    COALESCE(u.raw_user_meta_data->>'avatar_url', u.raw_user_meta_data->>'picture'),
    CASE
        WHEN COALESCE(u.email, '') LIKE 'telegram\_%@elchi.local' THEN 'telegram'
        WHEN u.raw_user_meta_data->>'telegram_id' IS NOT NULL THEN 'telegram'
        ELSE 'google'
    END,
    (u.raw_user_meta_data->>'telegram_id')::BIGINT,
    u.raw_user_meta_data->>'telegram_username'
FROM auth.users u
LEFT JOIN profiles p ON p.id = u.id
WHERE p.id IS NULL
ON CONFLICT (id) DO NOTHING;

ALTER TABLE profiles ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Users can read own profile" ON profiles;
CREATE POLICY "Users can read own profile"
ON profiles FOR SELECT
USING (auth.uid() = id);

DROP POLICY IF EXISTS "Users can update own profile" ON profiles;
-- The UPDATE policy has been removed because display_name is now auto-populated
-- and immutable by the user.

-- The shape of a display name, and the only enforcement of it that matters:
-- the capture gate writes through PostgREST under the policy above, with the
-- bundled anon key, so api/posts.ts is not in that write path at all. The
-- client copy in lib/profileName.ts is inline feedback — same split as
-- lib/contact.ts. Bounds mirror DISPLAY_NAME_MIN / DISPLAY_NAME_MAX; the
-- btrim equality rejects a name that is only padded whitespace away from blank.
DO $$
BEGIN
    IF EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'profiles_display_name_check') THEN
        ALTER TABLE profiles DROP CONSTRAINT profiles_display_name_check;
    END IF;
    ALTER TABLE profiles ADD CONSTRAINT profiles_display_name_check
        CHECK (
            display_name IS NULL
            OR (
                char_length(btrim(display_name)) BETWEEN 2 AND 40
                AND btrim(display_name) = display_name
            )
        );
END $$;

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
--
-- The join to `profiles` is what puts a real author name on a card. It rides on
-- the same security_invoker = false: the view reads profiles as its owner, so
-- the own-row-only SELECT policy above does not block an anonymous reader.
-- Which also means every profiles column named here is world-readable —
-- display_name is the only one, and adding email / telegram_id / avatar_url
-- would publish them. LEFT JOIN because pre-auth rows carry no user_id and an
-- inner join would drop them out of the feed.
--
-- Defined here rather than beside the `posts` policies because it now depends
-- on the profiles table above.
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
    p.headline,
    p.note,
    p.contact_type,
    p.contact2_type,
    (p.contact2 IS NOT NULL) AS has_contact2,
    pr.display_name,
    p.created_at,
    p.expires_at
FROM posts p
LEFT JOIN profiles pr ON pr.id = p.user_id
WHERE p.expires_at >= CURRENT_DATE
  -- Announcement rows are kept but retired: no client has a card for them, and
  -- the deep-link path (/api/posts?id=…) reads this view too, so hiding them
  -- here is what stops an orphan arriving somewhere that would render it as a
  -- parcel post with no cities and no date.
  AND p.type <> 'announcement';

GRANT SELECT ON public_posts TO anon, authenticated;

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
