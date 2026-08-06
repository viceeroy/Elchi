-- ===========================================================================
-- Elchi — remove the `announcement` post type
-- Run ONCE in Supabase → SQL Editor. Idempotent and safe to re-run.
--
-- The board is back to two shapes: `traveler` (I'm flying, I have space) and
-- `request` (I have a parcel). The standing service ad — a cargo company or an
-- agency listing itself indefinitely — is gone, and with it every piece of
-- machinery that existed only to hold that third shape upright:
--
--   * the `announcement` arm of posts_type_check and posts_shape_by_type_check
--   * one_active_announcement + enforce_one_active_announcement()
--       + has_active_announcement()          (the one-per-author cap)
--   * announcement_corridor_default + default_announcement_corridor()
--   * corridor_country, and both indexes that existed for it
--
-- EXISTING ROWS ARE NOT TOUCHED. Announcement rows written before this
-- migration stay in `posts` exactly as they are — no DELETE, no UPDATE. The two
-- CHECK constraints below are re-added NOT VALID, which is what makes that
-- possible: Postgres applies them to new and updated rows only, and never
-- re-scans the table. `posts` has no UPDATE policy (posts are immutable once
-- written), so a surviving announcement row can never be re-checked and can
-- never fail. The one thing those rows do lose is corridor_country — the column
-- is dropped, so the NOTICE block below prints each row's corridor first rather
-- than letting the value disappear unrecorded.
--
-- They stop being *readable*, though, which is the point: public_posts is
-- recreated with `type <> 'announcement'`, so an orphaned row cannot arrive at
-- a client that has no card component for it. That covers the deep-link path
-- (`/api/posts?id=…`) as well as the feed, and it covers a caller talking to
-- PostgREST directly — the view is the only route anon has into post data.
-- ===========================================================================

-- --------------------------------------------------------------------------
-- 0. What is about to become unreadable, and what corridor it was filed under
-- --------------------------------------------------------------------------
-- corridor_country is dropped below and cannot be recovered from the remaining
-- columns (from_country alone cannot name a corridor — that is precisely why
-- the column existed). Print it before it goes.
DO $$
DECLARE
    v_row   RECORD;
    v_count BIGINT;
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns
        WHERE table_name = 'posts' AND column_name = 'corridor_country'
    ) THEN
        RAISE NOTICE 'corridor_country already dropped — nothing to record.';
        RETURN;
    END IF;

    EXECUTE 'SELECT count(*) FROM posts WHERE type = ''announcement''' INTO v_count;
    RAISE NOTICE 'announcement rows kept in place: %', v_count;

    FOR v_row IN
        EXECUTE 'SELECT id, corridor_country, from_country, expires_at
                   FROM posts WHERE type = ''announcement'' ORDER BY created_at'
    LOOP
        RAISE NOTICE '  % corridor=% from=% expires=%',
            v_row.id, v_row.corridor_country, v_row.from_country, v_row.expires_at;
    END LOOP;
END $$;

-- --------------------------------------------------------------------------
-- 1. Drop the view first
-- --------------------------------------------------------------------------
-- It selects corridor_country, so the column cannot be dropped underneath it.
-- Recreated at the end.
DROP VIEW IF EXISTS public_posts;

-- --------------------------------------------------------------------------
-- 2. The announcement-only triggers and their functions
-- --------------------------------------------------------------------------
-- The cap and the corridor default both fire BEFORE INSERT on every row and
-- both open with `IF NEW.type = 'announcement'`, so with the type gone they are
-- pure overhead on every parcel post. has_active_announcement() has no other
-- caller once its trigger is gone.
DROP TRIGGER  IF EXISTS one_active_announcement       ON posts;
DROP TRIGGER  IF EXISTS announcement_corridor_default ON posts;
DROP FUNCTION IF EXISTS enforce_one_active_announcement();
DROP FUNCTION IF EXISTS default_announcement_corridor();
DROP FUNCTION IF EXISTS has_active_announcement(UUID);

-- --------------------------------------------------------------------------
-- 3. The type gate
-- --------------------------------------------------------------------------
-- Not wrapped in a pg_constraint existence guard, for the same reason the
-- announcements migration wasn't: this constraint already exists under this
-- name in every deployed database, so a guard would find it and skip, leaving
-- the three-value list in place.
--
-- NOT VALID so the announcement rows kept above don't block the migration.
-- New rows are gated in full.
ALTER TABLE posts DROP CONSTRAINT IF EXISTS posts_type_check;
ALTER TABLE posts ADD  CONSTRAINT posts_type_check
    CHECK (type IN ('traveler', 'request')) NOT VALID;

-- --------------------------------------------------------------------------
-- 4. The shape constraint, off first — it references corridor_country
-- --------------------------------------------------------------------------
ALTER TABLE posts DROP CONSTRAINT IF EXISTS posts_shape_by_type_check;

-- --------------------------------------------------------------------------
-- 5. Indexes that existed only for announcements
-- --------------------------------------------------------------------------
-- Both are partial on `type = 'announcement'`, so with no such rows being
-- written they can only ever cost write throughput.
DROP INDEX IF EXISTS idx_posts_corridor;
DROP INDEX IF EXISTS idx_posts_user_announcement;

-- idx_posts_type_created served the notes board and ONLY the notes board:
-- `type = 'announcement'` is a single value, so the composite was scanned with
-- created_at already ordered underneath it. The parcel board's
-- `type IN ('traveler','request')` is a ScalarArrayOp scan that orders rows
-- only within each type value, so the planner has always ignored this index and
-- done a full scan plus a top-N sort — 33,333 rows / 12.2 ms against 24 rows /
-- 0.07 ms, measured on 50k synthetic rows in
-- migrations/2026-08-05-posts-created-at-index.sql.
--
-- That migration named the replacement the surviving board actually wants and
-- left it to a follow-up that never landed. This is it: a plain
-- (created_at DESC) index, scanned in order with `type` demoted to a filter.
-- Every list request ends in ORDER BY created_at DESC LIMIT n OFFSET m.
--
-- `expires_at >= CURRENT_DATE` stays a filter rather than a partial-index
-- predicate: CURRENT_DATE is STABLE, not IMMUTABLE, so Postgres rejects it in
-- an index predicate — and an index meaning "not expired as of the day it was
-- built" would quietly stop matching tomorrow.
DROP INDEX IF EXISTS idx_posts_type_created;
CREATE INDEX IF NOT EXISTS idx_posts_created_at ON posts (created_at DESC);

-- --------------------------------------------------------------------------
-- 6. corridor_country
-- --------------------------------------------------------------------------
-- Confirmed unused by the two surviving shapes: posts_shape_by_type_check has
-- always required `corridor_country IS NULL` on traveler/request, and
-- api/posts.ts hard-set it to null on that branch. It was written by the
-- announcement path alone and read by the announcement feed filter alone, both
-- of which are gone.
ALTER TABLE posts DROP CONSTRAINT IF EXISTS posts_corridor_country_check;
ALTER TABLE posts DROP COLUMN IF EXISTS corridor_country;

-- --------------------------------------------------------------------------
-- 7. The shape constraint, back on — one shape now, so no CASE
-- --------------------------------------------------------------------------
-- The parcel arm verbatim, minus the `corridor_country IS NULL` clause the
-- column no longer supports. There is nothing to branch on: posts_type_check
-- above admits only traveler and request, and both carry the same shape.
--
-- Still NOT VALID, and still for the original reason as well as the new one:
-- legacy rows predating the constraint, and the announcement rows kept above.
ALTER TABLE posts ADD CONSTRAINT posts_shape_by_type_check CHECK (
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

-- --------------------------------------------------------------------------
-- 8. public_posts, minus corridor_country and minus announcements
-- --------------------------------------------------------------------------
-- Identical to the previous definition except for the dropped column and the
-- type filter. `headline` stays in the SELECT list: the column still exists and
-- still holds the old announcements' themes, and a view that silently omitted a
-- column would be a second, undocumented difference. The API no longer requests
-- it (PUBLIC_COLUMNS in api/posts.ts), and every readable row has it NULL.
--
-- security_invoker = false is load-bearing twice over — it is what lets anon
-- read these columns without any grant on `posts`, and what lets the LEFT JOIN
-- reach `profiles` past that table's own-row-only RLS. display_name is the only
-- profiles column exposed; adding another publishes it.
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
  -- the deep-link path reads this view too, so hiding them here is what stops
  -- an orphan arriving somewhere that would render it as a parcel post with no
  -- cities and no date.
  AND p.type <> 'announcement';

GRANT SELECT ON public_posts TO anon, authenticated;

-- ===========================================================================
-- Verify (expect: t, t, f, f, f, and 0)
-- ===========================================================================
SELECT
    (NOT EXISTS
       (SELECT 1 FROM information_schema.columns
         WHERE table_name = 'posts' AND column_name = 'corridor_country'))   AS column_gone,
    (NOT EXISTS
       (SELECT 1 FROM information_schema.columns
         WHERE table_name = 'public_posts' AND column_name = 'corridor_country')) AS view_column_gone,
    EXISTS
       (SELECT 1 FROM pg_trigger
         WHERE tgname IN ('one_active_announcement', 'announcement_corridor_default')) AS triggers_left,
    EXISTS
       (SELECT 1 FROM pg_proc
         WHERE proname IN ('enforce_one_active_announcement',
                           'has_active_announcement',
                           'default_announcement_corridor'))                 AS functions_left,
    EXISTS
       (SELECT 1 FROM pg_indexes
         WHERE tablename = 'posts'
           AND indexname IN ('idx_posts_corridor',
                             'idx_posts_user_announcement',
                             'idx_posts_type_created'))                      AS indexes_left,
    (SELECT count(*) FROM public_posts WHERE type = 'announcement')          AS announcements_still_readable;
