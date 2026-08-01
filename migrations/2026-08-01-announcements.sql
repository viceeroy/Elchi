-- ===========================================================================
-- Elchi — announcements: a third `posts.type` for standing ads
-- Run ONCE in Supabase → SQL Editor BEFORE deploying this branch.
-- Idempotent and safe to re-run.
--
-- Run it as `postgres`. The two functions below are SECURITY DEFINER, so the
-- role that creates them becomes the role they execute as; creating them as
-- anything else changes what they are allowed to read.
--
-- What an announcement is: a plain ad with a headline, a body, a route and a
-- contact — a cargo service, an agency, a shop. No travel date, no cargo, no
-- cities, because these are standing offers rather than one trip.
--
-- Why it lives in `posts` rather than its own table: paging, the country
-- filter, the contact-privacy split (public_posts + get_post_contact),
-- ownership marking and delete are all already built here. A second table
-- would mean a second copy of every one of them.
--
-- Column reuse: the body is stored in `note` — it is the same idea (the
-- free-text body of an ad) and is already carried by the view, the API's
-- column list and the client type. Only `headline` has no analogue, so only
-- `headline` is new.
-- ===========================================================================

-- ---------------------------------------------------------------------------
-- 0. Drop the view up front.
-- ---------------------------------------------------------------------------
-- It is rebuilt at the bottom of this file with the new column. Dropping it
-- first also means none of the ALTERs below can trip over a dependency.
DROP VIEW IF EXISTS public_posts;

-- ---------------------------------------------------------------------------
-- 1. Widen the type CHECK.
-- ---------------------------------------------------------------------------
-- NOT wrapped in the `IF NOT EXISTS (SELECT 1 FROM pg_constraint ...)` guard
-- used elsewhere in this repo. That guard is for constraints being introduced
-- for the first time; this one was declared inline on the column in the
-- original CREATE TABLE, so Postgres already named it `posts_type_check` in
-- every deployed database. The guard would find it present, skip its body and
-- silently leave the two-value list in place — and every announcement insert
-- would then fail a check violation that surfaces as a 500.
--
-- Drop-then-add is still idempotent: re-running lands on the same definition.
ALTER TABLE posts DROP CONSTRAINT IF EXISTS posts_type_check;
ALTER TABLE posts ADD  CONSTRAINT posts_type_check
    CHECK (type IN ('traveler', 'request', 'announcement'));

-- ---------------------------------------------------------------------------
-- 2. The one new column.
-- ---------------------------------------------------------------------------
-- 120 rather than the API's 80-character cap, so tightening or loosening the
-- cap later is an API change rather than a migration — the same relationship
-- `contact VARCHAR(100)` has with its own 100-character cap.
ALTER TABLE posts ADD COLUMN IF NOT EXISTS headline VARCHAR(120);

-- ---------------------------------------------------------------------------
-- 3. Relax exactly three NOT NULLs.
-- ---------------------------------------------------------------------------
-- An announcement has no cities and no date. `date` additionally fixes a live
-- bug: the post form sends the literal string "flexible" when a requester has
-- no fixed date, and api/posts.ts detected it for the expiry calculation but
-- then inserted it raw into a DATE column — so every negotiable-date request
-- failed with a 500. Those now store NULL, which is what "no fixed date"
-- actually means.
--
-- `weight` and `contact` deliberately stay NOT NULL; see the shape check below.
ALTER TABLE posts ALTER COLUMN from_city DROP NOT NULL;
ALTER TABLE posts ALTER COLUMN to_city   DROP NOT NULL;
ALTER TABLE posts ALTER COLUMN date      DROP NOT NULL;

-- ---------------------------------------------------------------------------
-- 4. Per-type shape check.
-- ---------------------------------------------------------------------------
-- Relaxing the NOT NULLs above would otherwise let a parcel post be created
-- with no city — the API checks for that, but the API is not the only writer
-- (see section 5). This moves the guarantee into the database.
--
-- `weight = ''` rather than NULL for announcements: the feed card calls
-- post.weight.match(...) without a guard, so a NULL there is a TypeError that
-- blanks the feed for anyone who deep-links an announcement while holding an
-- older bundle. An empty string renders as "nothing" through the same path.
--
-- The parcel branch deliberately says nothing about `date`: a parcel may now
-- legitimately have date IS NULL (the flexible case restored above).
--
-- NOT VALID so the migration cannot fail on a pre-existing row; it still
-- enforces on every INSERT and UPDATE from here on, which is the point.
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
          AND from_country IS NOT NULL AND to_country IS NOT NULL
      ELSE
              headline IS NULL
          AND from_city IS NOT NULL AND btrim(from_city) <> ''
          AND to_city   IS NOT NULL AND btrim(to_city)   <> ''
          AND btrim(weight) <> ''
    END
) NOT VALID;

-- ---------------------------------------------------------------------------
-- 5. One active announcement per author.
-- ---------------------------------------------------------------------------
-- Parcel ads are one-off; a standing service ad is not, so without a cap one
-- agency can paper the board with the same offer.
--
-- Why not a partial unique index:
--
--   CREATE UNIQUE INDEX ... ON posts (user_id)
--   WHERE type = 'announcement' AND expires_at >= CURRENT_DATE;
--
-- Postgres rejects that with 42P17, "functions in index predicate must be
-- marked IMMUTABLE". CURRENT_DATE is STABLE, not IMMUTABLE: an index files
-- each row away once at write time and never revisits it, so a predicate that
-- changes meaning tomorrow would leave the index asserting a uniqueness that
-- is no longer true. Dropping the expires_at term makes the predicate legal
-- but changes the rule to "one announcement ever", which is not the rule.
--
-- Why not a check in api/posts.ts: `authenticated` can INSERT into `posts`
-- directly through PostgREST using the anon key shipped in the browser bundle,
-- and the RLS insert policy only asserts user_id = auth.uid(). Anything
-- enforced solely in the API is a suggestion, not a boundary.
--
-- A BEFORE INSERT trigger has neither problem: it runs at write time, so
-- CURRENT_DATE means what it says, and it is in the path of every writer.

-- Not granted to `authenticated`: it takes an arbitrary user id, so exposing
-- it would let any logged-in caller probe whether a given user has an active
-- announcement. The trigger calls it as the definer and needs no grant.
CREATE OR REPLACE FUNCTION has_active_announcement(p_user UUID)
RETURNS BOOLEAN
LANGUAGE sql
SECURITY DEFINER
SET search_path = public, pg_temp
STABLE
AS $$
    SELECT EXISTS (
        SELECT 1 FROM posts p
        WHERE p.user_id = p_user
          AND p.type = 'announcement'
          AND p.expires_at >= CURRENT_DATE
    );
$$;

REVOKE ALL ON FUNCTION has_active_announcement(UUID) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION has_active_announcement(UUID) TO service_role;

-- SECURITY DEFINER here is mandatory, not stylistic. A trigger function runs
-- with the privileges of whoever fired it — `authenticated`, which holds only
-- GRANT SELECT (id, user_id) ON posts. Postgres requires SELECT on every
-- column a statement references, so an invoker-rights version reading `type`
-- and `expires_at` would fail with "permission denied for table posts" and
-- turn every announcement insert into a 500.
--
-- ERRCODE 23505 (unique_violation) so supabase-js surfaces error.code and the
-- API can answer 409 instead of 500. `posts` has no unique constraint besides
-- the primary key, so the code is unambiguous.
CREATE OR REPLACE FUNCTION enforce_one_active_announcement()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
BEGIN
    IF NEW.type = 'announcement'
       AND NEW.user_id IS NOT NULL
       AND has_active_announcement(NEW.user_id)
    THEN
        RAISE EXCEPTION 'user already has an active announcement'
            USING ERRCODE = '23505';
    END IF;
    RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS one_active_announcement ON posts;
CREATE TRIGGER one_active_announcement
    BEFORE INSERT ON posts
    FOR EACH ROW EXECUTE FUNCTION enforce_one_active_announcement();

-- Supports the lookup the trigger performs on every announcement insert. This
-- predicate has no CURRENT_DATE in it, so unlike the unique index above it is
-- immutable and therefore legal.
CREATE INDEX IF NOT EXISTS idx_posts_user_announcement
    ON posts (user_id) WHERE type = 'announcement';

-- ---------------------------------------------------------------------------
-- 6. Rebuild the public projection with the new column.
-- ---------------------------------------------------------------------------
-- Same shape as 2026-07-26-contact-privacy.sql: a SECURITY DEFINER view
-- (security_invoker = false) so it bypasses the `posts` RLS and lets anon read
-- the non-sensitive columns, with the expires_at filter reproduced here so it
-- cannot leak expired rows. DROP VIEW took the grants with it, so they have to
-- be re-issued.
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
    p.created_at,
    p.expires_at
FROM posts p
WHERE p.expires_at >= CURRENT_DATE;

GRANT SELECT ON public_posts TO anon, authenticated;

-- ---------------------------------------------------------------------------
-- 7. Self-check.
-- ---------------------------------------------------------------------------
-- Reads back what the statements above were supposed to create, so a partial
-- run reports itself instead of surfacing later as a 500 from the feed. Every
-- column should read `true` / three types listed.
SELECT
    (SELECT count(*) = 1 FROM information_schema.columns
       WHERE table_name = 'posts' AND column_name = 'headline')        AS table_has_headline,
    (SELECT count(*) = 1 FROM information_schema.columns
       WHERE table_name = 'public_posts' AND column_name = 'headline') AS view_has_headline,
    (SELECT count(*) = 1 FROM pg_trigger
       WHERE tgname = 'one_active_announcement')                       AS trigger_exists,
    (SELECT is_nullable = 'YES' FROM information_schema.columns
       WHERE table_name = 'posts' AND column_name = 'date')            AS date_is_nullable,
    (SELECT pg_get_constraintdef(oid) FROM pg_constraint
       WHERE conrelid = 'posts'::regclass AND conname = 'posts_type_check') AS type_check;
