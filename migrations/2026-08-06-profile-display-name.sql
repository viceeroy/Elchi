-- ---------------------------------------------------------------------------
-- Elchi — mandatory profile display name, printed on feed cards
-- ---------------------------------------------------------------------------
-- Until now the name in a card footer was a hard-coded placeholder (see
-- src/lib/placeholderAuthor.ts, which described this migration before it
-- existed). This is the reversal it warned about: a post now carries the
-- author's chosen name, so the board is no longer anonymous at the feed level.
-- The correlation it opens is name → posts. user_id is still absent from the
-- view, and contact values still are too, so a scraped feed yields names but
-- no handles and no account ids.
--
-- Apply on top of a live DB. Idempotent — safe to re-run.

-- 1. The column. `profiles.display_name` already exists (it has been populated
--    from auth.users metadata since the auth migration), so this is a no-op on
--    any DB that ran 2026-07-22-auth-and-structured-posts.sql. Kept so the file
--    stands alone.
ALTER TABLE profiles ADD COLUMN IF NOT EXISTS display_name TEXT;

-- 2. Normalizer, shared by the signup trigger below and mirrored on the client
--    by normalizeDisplayName() in lib/profileName.ts. Returns NULL for anything
--    the CHECK in step 4 would reject.
CREATE OR REPLACE FUNCTION normalize_display_name(raw TEXT)
RETURNS TEXT
LANGUAGE sql
IMMUTABLE
AS $$
    SELECT CASE
        WHEN raw IS NULL THEN NULL
        WHEN char_length(btrim(regexp_replace(raw, '\s+', ' ', 'g'))) BETWEEN 2 AND 40
            THEN btrim(regexp_replace(raw, '\s+', ' ', 'g'))
        ELSE NULL
    END;
$$;

-- 3. Clean what is already stored, BEFORE the constraint goes on — display_name
--    has been populated from provider metadata since signup, and a Google
--    account named with a trailing space or a single initial would make step 4
--    fail on existing data. Anything unusable becomes NULL, which is exactly
--    what the capture gate asks the owner to fill in on their next login.
UPDATE profiles
SET display_name = normalize_display_name(display_name)
WHERE display_name IS DISTINCT FROM normalize_display_name(display_name);

-- 4. Shape check. Nullable stays nullable: every existing row predates the
--    capture gate, and the gate's whole job is to fill those in on next login.
--    What the check forbids is a *present* name that is blank or absurd.
--
--    This is the security boundary, not the client copy in lib/profileName.ts:
--    the gate writes through PostgREST with the bundled anon key under the
--    own-row UPDATE policy, so the API is not in the write path at all.
--    Bounds mirror DISPLAY_NAME_MIN / DISPLAY_NAME_MAX.
DO $$
BEGIN
    IF EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'profiles_display_name_check') THEN
        ALTER TABLE profiles DROP CONSTRAINT profiles_display_name_check;
    END IF;
    ALTER TABLE profiles ADD CONSTRAINT profiles_display_name_check
        CHECK (
            display_name IS NULL
            OR (
                char_length(btrim(display_name)) BETWEEN 2 AND 40
                AND btrim(display_name) = display_name
            )
        );
END $$;

-- 5. The signup trigger must not write a name the constraint rejects — it runs
--    inside the auth.users insert, so a violation fails the login itself.
--    Identical to the copy in supabase-schema.sql apart from this framing.
CREATE OR REPLACE FUNCTION handle_new_user()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
BEGIN
    INSERT INTO public.profiles (id, email, display_name, avatar_url, auth_provider, telegram_id, telegram_username)
    VALUES (
        NEW.id,
        COALESCE(NEW.email, NEW.raw_user_meta_data->>'email'),
        normalize_display_name(
            COALESCE(NEW.raw_user_meta_data->>'display_name', NEW.raw_user_meta_data->>'full_name', NEW.raw_user_meta_data->>'name')
        ),
        COALESCE(NEW.raw_user_meta_data->>'avatar_url', NEW.raw_user_meta_data->>'picture'),
        COALESCE(NEW.raw_user_meta_data->>'provider', NEW.raw_app_meta_data->>'provider'),
        (NEW.raw_user_meta_data->>'telegram_id')::BIGINT,
        NEW.raw_user_meta_data->>'telegram_username'
    );
    RETURN NEW;
END;
$$;

-- 6. The read model gains the name.
--
--    LEFT JOIN, not JOIN: posts written before user_id existed carry none, and
--    an inner join would silently drop them out of the feed.
--
--    The view stays security_invoker = false, which is what makes this legal —
--    it reads `profiles` as its owner, so the own-row-only RLS policy on that
--    table does not apply and anon can still read the board. That also means
--    every column listed here is world-readable: display_name is the ONLY
--    profiles column added. Do not extend this join with email, telegram_id or
--    avatar_url without deciding, deliberately, to publish them.
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
    pr.display_name,
    p.created_at,
    p.expires_at
FROM posts p
LEFT JOIN profiles pr ON pr.id = p.user_id
WHERE p.expires_at >= CURRENT_DATE;

GRANT SELECT ON public_posts TO anon, authenticated;
