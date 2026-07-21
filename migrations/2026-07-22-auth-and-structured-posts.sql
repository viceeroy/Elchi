-- ===========================================================================
-- Elchi — production migration for feat/auth-login-modal
-- Run this ONCE in Supabase → SQL Editor BEFORE deploying the merged main.
-- Idempotent: safe to run against the existing DB and safe to re-run.
-- Brings the live `posts` table up to the schema the new API writes, drops the
-- removed `price`/`reports`, tightens RLS, and adds the auth `profiles` table.
-- Login is Telegram + Google only (no email) — see the profiles CHECK below.
-- ===========================================================================

CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- ---------------------------------------------------------------------------
-- posts: add the structured columns the new post form writes
-- ---------------------------------------------------------------------------
ALTER TABLE posts ALTER COLUMN weight TYPE TEXT;

ALTER TABLE posts ADD COLUMN IF NOT EXISTS direction      VARCHAR(3);
ALTER TABLE posts ADD COLUMN IF NOT EXISTS weight_kg      NUMERIC(6,2) NOT NULL DEFAULT 0;
ALTER TABLE posts ADD COLUMN IF NOT EXISTS luggage_count  SMALLINT     NOT NULL DEFAULT 0;
ALTER TABLE posts ADD COLUMN IF NOT EXISTS categories     TEXT[]       NOT NULL DEFAULT '{}';
ALTER TABLE posts ADD COLUMN IF NOT EXISTS category_other TEXT;
ALTER TABLE posts ADD COLUMN IF NOT EXISTS contact_type   VARCHAR(10);
ALTER TABLE posts ADD COLUMN IF NOT EXISTS contact2_type  VARCHAR(10);

CREATE INDEX IF NOT EXISTS idx_posts_direction  ON posts(direction);
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

-- Backfill structured columns from legacy rows (parse the old `weight` string
-- and the "@" contact convention).
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

-- Remove things the app no longer uses.
ALTER TABLE posts DROP COLUMN IF EXISTS price;
DROP TABLE IF EXISTS reports;

-- ---------------------------------------------------------------------------
-- posts RLS: public read of active posts + public insert. No UPDATE/DELETE
-- policy, so the anon key can't tamper with or wipe existing rows.
-- ---------------------------------------------------------------------------
ALTER TABLE posts ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Allow public read access to active posts" ON posts;
CREATE POLICY "Allow public read access to active posts"
ON posts FOR SELECT
USING (expires_at >= CURRENT_DATE);

DROP POLICY IF EXISTS "Allow public inserts to posts" ON posts;
CREATE POLICY "Allow public inserts to posts"
ON posts FOR INSERT
WITH CHECK (true);

-- ---------------------------------------------------------------------------
-- profiles: backs the login flow only (posts stay anonymous, no user_id).
-- auth_provider is restricted to google + telegram — email login is disabled.
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS profiles (
    id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
    display_name TEXT,
    avatar_url TEXT,
    auth_provider TEXT NOT NULL CHECK (auth_provider IN ('google', 'telegram')),
    telegram_id BIGINT UNIQUE,
    telegram_username TEXT,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- If profiles already exists from an earlier run, tighten the constraint to
-- drop 'email'.
DO $$
BEGIN
    IF EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'profiles_auth_provider_check') THEN
        ALTER TABLE profiles DROP CONSTRAINT profiles_auth_provider_check;
    END IF;
    ALTER TABLE profiles ADD CONSTRAINT profiles_auth_provider_check
        CHECK (auth_provider IN ('google', 'telegram'));
END $$;

CREATE OR REPLACE FUNCTION handle_new_user()
RETURNS TRIGGER AS $$
BEGIN
    INSERT INTO public.profiles (id, display_name, avatar_url, auth_provider, telegram_id, telegram_username)
    VALUES (
        NEW.id,
        COALESCE(NEW.raw_user_meta_data->>'display_name', NEW.raw_user_meta_data->>'full_name', NEW.raw_user_meta_data->>'name'),
        COALESCE(NEW.raw_user_meta_data->>'avatar_url', NEW.raw_user_meta_data->>'picture'),
        COALESCE(NEW.raw_user_meta_data->>'provider', NEW.raw_app_meta_data->>'provider'),
        (NEW.raw_user_meta_data->>'telegram_id')::BIGINT,
        NEW.raw_user_meta_data->>'telegram_username'
    );
    RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

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
USING (auth.uid() = id);
