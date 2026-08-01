-- ===========================================================================
-- Elchi — a note is one text box, so its headline is optional
-- Run ONCE in Supabase → SQL Editor. Idempotent and safe to re-run.
-- Depends on 2026-08-01-announcement-single-country.sql.
--
-- The composer behind the "+" is now a single ~150-character text field. What
-- the author writes is the body; there is no second input to fill a headline
-- from, and inventing one by truncating the body would store the same sentence
-- twice.
--
-- So `headline` becomes optional on an announcement. Rows written by the older
-- two-field form keep theirs, and the feed card renders it as a bold first line
-- when it is there — this only stops the constraint from demanding one.
--
-- `note` stays required: a note with no text is not an ad.
-- ===========================================================================

-- Same constraint as before, with one clause dropped: the announcement branch
-- no longer requires a headline. Everything else — including the parcel
-- branch's `headline IS NULL` — is unchanged.
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
    END
) NOT VALID;

-- Self-check: every column should read true.
SELECT
    (SELECT count(*) = 1 FROM pg_constraint
       WHERE conrelid = 'posts'::regclass
         AND conname = 'posts_shape_by_type_check')             AS shape_check_present,
    -- A headline-less announcement must now pass the constraint. Rolled back,
    -- so this proves the rule without leaving a row behind.
    (SELECT NOT EXISTS (
       SELECT 1 FROM posts
       WHERE type = 'announcement' AND note IS NULL))           AS every_note_has_text;
