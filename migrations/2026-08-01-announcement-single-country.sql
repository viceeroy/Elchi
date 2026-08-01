-- ===========================================================================
-- Elchi — announcements carry one country, not a route
-- Run ONCE in Supabase → SQL Editor. Idempotent and safe to re-run.
-- Depends on 2026-08-01-announcements.sql.
--
-- An announcement is a standing service that sits somewhere — a cargo firm in
-- Korea, an agency in Tashkent. It is not a delivery in a direction, so a
-- from → to pair overstated what the author was actually saying and made the
-- form ask a question with no honest answer.
--
-- The country now lives in `from_country` alone and `to_country` is NULL.
-- from_country is reused rather than given a new `country` column because it
-- already carries the feed's country filter and the index behind it
-- (idx_posts_route); a parallel column would mean every query choosing between
-- two spellings of the same idea.
-- ===========================================================================

-- Any announcement written under the previous shape keeps its origin country
-- and drops the invented destination. (Expected to affect zero rows — the
-- feature had no live authors yet — but the migration must not depend on that.)
UPDATE posts
SET to_country = NULL
WHERE type = 'announcement' AND to_country IS NOT NULL;

-- Same constraint as before, with one clause flipped: an announcement now
-- requires from_country and forbids to_country. The parcel branch is unchanged
-- and still holds cities and weight to their old requirements.
ALTER TABLE posts DROP CONSTRAINT IF EXISTS posts_shape_by_type_check;
ALTER TABLE posts ADD  CONSTRAINT posts_shape_by_type_check CHECK (
    CASE type
      WHEN 'announcement' THEN
              headline IS NOT NULL AND btrim(headline) <> ''
          AND note     IS NOT NULL AND btrim(note)     <> ''
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
    END
) NOT VALID;

-- Self-check: every column should read true.
SELECT
    (SELECT count(*) = 0 FROM posts
       WHERE type = 'announcement' AND to_country IS NOT NULL)  AS no_announcement_has_destination,
    (SELECT count(*) = 1 FROM pg_constraint
       WHERE conrelid = 'posts'::regclass
         AND conname = 'posts_shape_by_type_check')             AS shape_check_present;
