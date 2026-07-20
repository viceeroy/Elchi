-- SQL Migration for Elchi Database Schema (Supabase / PostgreSQL)

-- Enable UUID extension if not enabled
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- Create posts table
CREATE TABLE IF NOT EXISTS posts (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    type VARCHAR(20) NOT NULL CHECK (type IN ('traveler', 'request')),
    from_city VARCHAR(100) NOT NULL,
    to_city VARCHAR(100) NOT NULL,
    date DATE NOT NULL,
    weight TEXT NOT NULL,
    price VARCHAR(100),
    note TEXT,
    contact VARCHAR(100) NOT NULL,
    contact2 VARCHAR(100),
    created_at TIMESTAMPTZ DEFAULT NOW(),
    expires_at DATE NOT NULL
);

-- Index for searching active posts
CREATE INDEX IF NOT EXISTS idx_posts_expires_at ON posts(expires_at);
CREATE INDEX IF NOT EXISTS idx_posts_type ON posts(type);

-- Create reports table
CREATE TABLE IF NOT EXISTS reports (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    post_id UUID REFERENCES posts(id) ON DELETE CASCADE,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Migration for existing databases: widen `weight` so multi-category requests
-- (e.g. "3 kg · Hujjatlar, Dori-darmon, Telefon/Texnika") don't overflow the old
-- VARCHAR(50) limit, which caused inserts to fail with SQLSTATE 22001.
ALTER TABLE posts ALTER COLUMN weight TYPE TEXT;

-- TODO: Add images column for v2 (e.g. image_url TEXT)
-- ALTER TABLE posts ADD COLUMN image_url TEXT;

-- Simple RLS (Row Level Security) rules for Supabase
-- Enable RLS
ALTER TABLE posts ENABLE ROW LEVEL SECURITY;
ALTER TABLE reports ENABLE ROW LEVEL SECURITY;

-- Allow public read access to active posts
CREATE POLICY "Allow public read access to active posts" 
ON posts FOR SELECT 
USING (expires_at >= CURRENT_DATE);

-- Allow public inserts
CREATE POLICY "Allow public inserts to posts" 
ON posts FOR INSERT 
WITH CHECK (true);

-- Allow public inserts to reports
CREATE POLICY "Allow public inserts to reports"
ON reports FOR INSERT
WITH CHECK (true);

-- Migration: profiles table + auto-provisioning trigger for Supabase Auth
-- (email OTP, Google OAuth, and a Telegram bridge via admin.createUser all
-- land here — see api/auth-telegram.ts for the Telegram flow).
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

CREATE POLICY "Users can read own profile"
ON profiles FOR SELECT
USING (auth.uid() = id);

CREATE POLICY "Users can update own profile"
ON profiles FOR UPDATE
USING (auth.uid() = id);
