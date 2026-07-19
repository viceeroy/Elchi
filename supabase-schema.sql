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
