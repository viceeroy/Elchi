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
-- The board is intentionally anonymous: anyone may read active posts and anyone
-- may create one. RLS stays ON with no UPDATE and no DELETE policy, so the
-- public anon key cannot tamper with or wipe existing rows.
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
-- profiles (Supabase Auth)
-- ---------------------------------------------------------------------------
-- Auth is not wired into posts: posts stay anonymous and carry no user_id.
-- These tables exist for the login flow only (email OTP, Google OAuth, and a
-- Telegram bridge via admin.createUser — see api/auth-telegram.ts).
CREATE TABLE IF NOT EXISTS profiles (
    id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
    display_name TEXT,
    avatar_url TEXT,
    auth_provider TEXT NOT NULL CHECK (auth_provider IN ('email', 'google', 'telegram')),
    telegram_id BIGINT UNIQUE,
    telegram_username TEXT,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Populates profiles from auth.users metadata on signup, regardless of
-- provider (email/google set raw_app_meta_data.provider; the Telegram
-- bridge passes the same fields via user_metadata on admin.createUser).
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
