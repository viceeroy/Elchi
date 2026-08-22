-- Migration: Add composite index on date and created_at for faster feed sorting
-- Created: 2026-08-22
--
-- The feed view `public_posts` is ordered by `date ASC, created_at DESC`. Without this
-- index, Postgres must perform an in-memory sort on every feed request, which becomes
-- expensive as the table grows. This index eliminates the sort step.

CREATE INDEX IF NOT EXISTS idx_posts_date_created ON posts (date ASC, created_at DESC);
