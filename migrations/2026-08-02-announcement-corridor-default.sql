-- ===========================================================================
-- Elchi — fill in an announcement's corridor when the writer omits it
-- Run ONCE in Supabase → SQL Editor. Idempotent and safe to re-run.
-- Depends on 2026-08-01-announcement-corridor.sql.
--
-- That migration made corridor_country mandatory on announcements. The database
-- accepted it immediately; the API that fills it in only exists once the bundle
-- is deployed. In between, every note written by the deployed-but-older API is
-- rejected by posts_shape_by_type_check and surfaces to the author as a 500.
--
-- The same gap reopens for any writer that is not api/posts.ts: `authenticated`
-- can INSERT through PostgREST with the anon key shipped in the browser bundle,
-- and a cached bundle can outlive a deploy by a long time.
--
-- So the corridor gets derived where it can be derived honestly. An
-- announcement that sits in the corridor's far country names its own corridor —
-- a Korea note is a Korea note, whatever the caller did or didn't send. That
-- covers every insert the older API produces, because the composer sends the
-- corridor the author was browsing as from_country.
--
-- What is NOT guessed: a note sitting in Uzbekistan. The home country is on the
-- near side of every corridor, so there is no honest answer, and inventing one
-- is the exact bug 2026-08-01-announcement-corridor.sql was written to end.
-- Those inserts still fail the constraint, which is the correct outcome — the
-- current API supplies the corridor explicitly and never reaches this path.
--
-- Mirrors the fallback in api/posts.ts, and no country code is hardcoded here,
-- so opening a corridor stays an API change rather than a migration.
-- ===========================================================================

-- Unlike enforce_one_active_announcement, this reads no table — it only edits
-- the row being inserted — so it needs no SECURITY DEFINER and no grants beyond
-- the INSERT the writer already holds.
CREATE OR REPLACE FUNCTION default_announcement_corridor()
RETURNS TRIGGER
LANGUAGE plpgsql
AS $$
BEGIN
    IF NEW.type = 'announcement' AND NEW.corridor_country IS NULL THEN
        -- NULLIF leaves it NULL for a home-country note, so the constraint
        -- still rejects the one case that has no honest answer.
        NEW.corridor_country := NULLIF(NEW.from_country, 'UZ');
    END IF;
    RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS announcement_corridor_default ON posts;
CREATE TRIGGER announcement_corridor_default
    BEFORE INSERT ON posts
    FOR EACH ROW EXECUTE FUNCTION default_announcement_corridor();

-- Self-check: every column should read true.
SELECT
    (SELECT count(*) = 1 FROM pg_trigger
       WHERE tgrelid = 'posts'::regclass
         AND tgname = 'announcement_corridor_default')       AS trigger_present,
    -- Unchanged from the previous migration: nothing here backfills or rewrites
    -- an existing row, so both invariants must still hold.
    (SELECT NOT EXISTS (
       SELECT 1 FROM posts
       WHERE type = 'announcement'
         AND (corridor_country IS NULL OR corridor_country = 'UZ')))  AS every_note_has_a_corridor,
    (SELECT NOT EXISTS (
       SELECT 1 FROM posts
       WHERE type = 'announcement'
         AND from_country NOT IN (corridor_country, 'UZ')))           AS every_note_sits_on_its_corridor;
