-- ===========================================================================
-- Elchi — an announcement names the corridor it belongs to
-- Run ONCE in Supabase → SQL Editor. Idempotent and safe to re-run.
-- Depends on 2026-08-01-parcel-route-required.sql.
--
-- An announcement sits in ONE country (`from_country`), which is the right
-- description of a standing service but is not enough to place it on the board.
-- The board is not a list of countries, it is a list of CORRIDORS, and every
-- corridor has Uzbekistan on one side. So a note posted from Tashkent belongs
-- to a corridor that its own country cannot identify: UZ is on the near side of
-- all of them.
--
-- The feed papered over that by matching announcements with
-- `from_country IN (<corridor>, 'UZ')` — "an Uzbek note belongs to whichever
-- corridor you are looking at". With Korea as the only live corridor the rule
-- is invisible; the moment Kazakhstan opens, every Tashkent note ever written
-- appears under KZ↔UZ as well as KR↔UZ, on a board where the author never
-- posted and to readers it was not written for.
--
-- `corridor_country` records the answer instead of guessing it: the far country
-- of the corridor the author was looking at when they posted. `from_country`
-- keeps its own meaning — where the service physically sits — and the two are
-- allowed to differ, which is exactly the Tashkent-agency-on-the-Korea-board
-- case.
--
-- Parcel posts do not get one: their corridor is already stated by the
-- from/to pair, and a second spelling of the same fact is a second thing to
-- keep in sync. The parcel branch of the shape check therefore requires
-- corridor_country to stay NULL, and no parcel query changes.
-- ===========================================================================

-- ---------------------------------------------------------------------------
-- 1. The column.
-- ---------------------------------------------------------------------------
ALTER TABLE posts ADD COLUMN IF NOT EXISTS corridor_country VARCHAR(2);

DO $$
BEGIN
    -- Shape only, not a fixed country list: opening a corridor is an API change
    -- (ALLOWED_COUNTRIES in api/posts.ts), never a migration. Matches the
    -- existing posts_from_country_check / posts_to_country_check.
    IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'posts_corridor_country_check') THEN
        ALTER TABLE posts ADD CONSTRAINT posts_corridor_country_check
            CHECK (corridor_country IS NULL OR corridor_country ~ '^[A-Z]{2}$');
    END IF;
END $$;

-- The announcement feed filters on this column alone, so it gets its own
-- partial index rather than riding on idx_posts_route (from_country,
-- to_country), which a corridor lookup cannot use.
CREATE INDEX IF NOT EXISTS idx_posts_corridor
    ON posts (corridor_country) WHERE type = 'announcement';

-- ---------------------------------------------------------------------------
-- 2. Backfill.
-- ---------------------------------------------------------------------------
-- Korea is the only corridor the board has ever served, so every existing
-- announcement belongs to it — including the Uzbek-side ones, which is the
-- whole point: they were written for the Korea board and must not follow the
-- next corridor that opens.
--
-- A note that sits in the far country states its own corridor (KR → KR); one
-- that sits at home cannot, and falls back to the only live corridor. 'KR' is
-- hardcoded because this is a statement about history, not a rule: it is what
-- the rows already on disk meant when they were written.
UPDATE posts
SET corridor_country = COALESCE(NULLIF(from_country, 'UZ'), 'KR')
WHERE type = 'announcement' AND corridor_country IS NULL;

-- ---------------------------------------------------------------------------
-- 3. Require it, on announcements only.
-- ---------------------------------------------------------------------------
-- Same constraint as 2026-08-01-parcel-route-required.sql with the corridor
-- clauses added. As with the one-announcement trigger and the parcel route,
-- this lives in the database because api/posts.ts is not the only writer:
-- `authenticated` can INSERT through PostgREST with the anon key that ships in
-- the browser bundle. A corridor-less announcement would not be visible in any
-- filtered feed, which looks like a lost post rather than an error.
--
-- 'UZ' appears literally for the same reason it does in api/posts.ts
-- (HOME_COUNTRY): every corridor this board serves has Uzbekistan on one side,
-- so the home country is never a corridor of its own, and an announcement can
-- only sit either in the corridor's far country or at home.
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
          -- Where it is shown: the far country of one corridor.
          AND corridor_country IS NOT NULL
          AND corridor_country <> 'UZ'
          -- Where it sits: that same country, or home.
          AND from_country IN (corridor_country, 'UZ')
      ELSE
              headline IS NULL
          AND from_city IS NOT NULL AND btrim(from_city) <> ''
          AND to_city   IS NOT NULL AND btrim(to_city)   <> ''
          AND btrim(weight) <> ''
          AND from_country IS NOT NULL
          AND to_country   IS NOT NULL
          AND from_country <> to_country
          -- A parcel post's corridor is its route. One fact, one column.
          AND corridor_country IS NULL
    END
) NOT VALID;

-- ---------------------------------------------------------------------------
-- 4. Rebuild the public projection with the new column.
-- ---------------------------------------------------------------------------
-- Same shape as 2026-08-01-announcements.sql: a SECURITY DEFINER view
-- (security_invoker = false) so it bypasses the `posts` RLS and lets anon read
-- the non-sensitive columns, with the expires_at filter reproduced here so it
-- cannot leak expired rows. DROP VIEW takes the grants with it, so they are
-- re-issued below.
DROP VIEW IF EXISTS public_posts;
CREATE VIEW public_posts
WITH (security_invoker = false) AS
SELECT
    p.id,
    p.type,
    p.direction,
    p.from_country,
    p.to_country,
    p.corridor_country,
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
-- 5. Self-check: every column should read true.
-- ---------------------------------------------------------------------------
SELECT
    (SELECT count(*) = 1 FROM information_schema.columns
       WHERE table_name = 'posts' AND column_name = 'corridor_country')        AS table_has_corridor,
    (SELECT count(*) = 1 FROM information_schema.columns
       WHERE table_name = 'public_posts' AND column_name = 'corridor_country') AS view_has_corridor,
    (SELECT count(*) = 1 FROM pg_constraint
       WHERE conrelid = 'posts'::regclass
         AND conname = 'posts_shape_by_type_check')                            AS shape_check_present,
    -- No announcement left without a corridor, and none pointing at home.
    (SELECT NOT EXISTS (
       SELECT 1 FROM posts
       WHERE type = 'announcement'
         AND (corridor_country IS NULL OR corridor_country = 'UZ')))           AS every_note_has_a_corridor,
    -- Nothing was silently reinterpreted: a note that sits in the far country
    -- kept that country as its corridor.
    (SELECT NOT EXISTS (
       SELECT 1 FROM posts
       WHERE type = 'announcement'
         AND from_country NOT IN (corridor_country, 'UZ')))                    AS every_note_sits_on_its_corridor;
