-- ===========================================================================
-- Elchi — a parcel post must carry both of its route countries
-- Run ONCE in Supabase → SQL Editor. Idempotent and safe to re-run.
-- Depends on 2026-08-01-note-headline-optional.sql.
--
-- `from_country` / `to_country` are the direction of a parcel post — not just
-- its filter key. Until now nothing in the database required them:
-- posts_shape_by_type_check held the parcel branch to cities and weight and
-- said nothing about countries, so a row with both country columns NULL was a
-- legal parcel post.
--
-- api/posts.ts rejects that shape, but the API is not the only writer:
-- `authenticated` can INSERT into `posts` directly through PostgREST with the
-- anon key shipped in the browser bundle, and the RLS insert policy only
-- asserts user_id = auth.uid(). The same reasoning as the one-announcement
-- trigger in 2026-08-01-announcements.sql — anything enforced solely in the
-- API is a suggestion, not a boundary.
--
-- Two things go wrong with such a row, and neither of them looks like an
-- error:
--
--   * The feed card falls back to COUNTRIES[0] (KR) for a missing origin and
--     "the other country" for a missing destination, so a Uzbekistan → Korea
--     post renders as "Koreya ✈ O'zbekiston" — backwards, with no visible
--     defect.
--   * The corridor filter matches on the country pair, so the row is invisible
--     in every filtered feed.
--
-- `from_country <> to_country` is included for the same reason: KR → KR is not
-- a corridor this board serves, the API already refuses it, and the card would
-- render an arrow between a country and itself.
--
-- The 2026-07-23 backfill means no deployed row is in this state today; this
-- keeps a new one from being written.
-- ===========================================================================

-- Same constraint as 2026-08-01-note-headline-optional.sql, with three clauses
-- added to the parcel branch. The announcement branch is unchanged: it still
-- requires from_country and still forbids to_country, because an announcement
-- sits in one country rather than travelling between two.
--
-- NOT VALID so the migration cannot fail on a pre-existing row; it still
-- enforces on every INSERT and UPDATE from here on, which is the point.
ALTER TABLE posts DROP CONSTRAINT IF EXISTS posts_shape_by_type_check;
ALTER TABLE posts ADD  CONSTRAINT posts_shape_by_type_check CHECK (
    CASE type
      WHEN 'announcement' THEN
              note     IS NOT NULL AND btrim(note)     <> ''
          AND date IS NULL
          AND from_city IS NULL AND to_city IS NULL
          AND weight = ''
          AND weight_kg = 0 AND luggage_count = 0
          AND categories = '{}'::TEXT[] AND category_other IS NULL
          AND from_country IS NOT NULL
          AND to_country IS NULL
      ELSE
              headline IS NULL
          AND from_city IS NOT NULL AND btrim(from_city) <> ''
          AND to_city   IS NOT NULL AND btrim(to_city)   <> ''
          AND btrim(weight) <> ''
          -- The direction of the post, and the only thing the corridor filter
          -- can match on.
          AND from_country IS NOT NULL
          AND to_country   IS NOT NULL
          AND from_country <> to_country
    END
) NOT VALID;

-- Self-check: every column should read true.
SELECT
    (SELECT count(*) = 1 FROM pg_constraint
       WHERE conrelid = 'posts'::regclass
         AND conname = 'posts_shape_by_type_check')          AS shape_check_present,
    -- No deployed row should violate the new clauses. If this reads false the
    -- constraint is still enforcing on new writes (it is NOT VALID, so the old
    -- rows were let through) — those rows need their route backfilled before
    -- the constraint can be VALIDATEd.
    (SELECT NOT EXISTS (
       SELECT 1 FROM posts
       WHERE type <> 'announcement'
         AND (from_country IS NULL
              OR to_country IS NULL
              OR from_country = to_country)))                AS every_parcel_has_a_route;
