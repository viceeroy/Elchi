-- ---------------------------------------------------------------------------
-- Elchi — every auth user gets a profiles row, including the ones that predate
--         the trigger
-- ---------------------------------------------------------------------------
-- `profiles` and its on_auth_user_created trigger arrived on 2026-07-22. The
-- trigger only fires on INSERT into auth.users, and the one backfill ever
-- written (2026-07-22-profiles-email.sql) is an UPDATE — it fills columns on
-- rows that already exist and creates none. So every account created before
-- 2026-07-22 has no profiles row at all, and never would have.
--
-- That is invisible until something writes to the row. The display-name capture
-- gate does, and for those accounts:
--
--   * `UPDATE profiles ... WHERE id = <user>` matches zero rows. PostgREST
--     answers a zero-row PATCH with 204 and an empty body, so the client sees
--     no error and reports a save that never happened;
--   * the profile sheet's own-row SELECT returns nothing, so no name shows;
--   * `public_posts` LEFT JOINs to nothing, so their cards print the fallback.
--
-- One live account is in this state. The client-side half of this fix — making
-- a zero-row write a hard error instead of a silent success — is in
-- src/components/NameGateModal.tsx.
--
-- Apply on top of a live DB. Idempotent — safe to re-run.

-- 1. Harden the provider derivation BEFORE backfilling, so both paths agree.
--
--    auth_provider is NOT NULL CHECK (auth_provider IN ('google','telegram')),
--    but the value the trigger reads from metadata is whatever Supabase wrote:
--    the pre-trigger account carries 'email', and a row with no provider
--    metadata at all yields NULL. Either one violates the constraint, and this
--    trigger runs inside the signup transaction — so an account that hit it
--    would fail to sign up at all, with the profile row it was meant to create
--    being exactly what blocked it.
--
--    The synthetic address the Telegram bridge mints (telegram_<id>@elchi.local,
--    see api/auth-telegram.ts) is the one fact that reliably distinguishes the
--    two providers, so it decides. Everything else is 'google', which is the
--    only other login the app offers.
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
        -- NULL, deliberately, and never the provider's name: display_name is
        -- the user's own answer to the capture gate and nothing else. See
        -- 2026-08-06-display-name-user-entered.sql.
        NULL,
        COALESCE(NEW.raw_user_meta_data->>'avatar_url', NEW.raw_user_meta_data->>'picture'),
        CASE
            WHEN COALESCE(NEW.email, '') LIKE 'telegram\_%@elchi.local' THEN 'telegram'
            WHEN NEW.raw_user_meta_data->>'telegram_id' IS NOT NULL THEN 'telegram'
            ELSE 'google'
        END,
        (NEW.raw_user_meta_data->>'telegram_id')::BIGINT,
        NEW.raw_user_meta_data->>'telegram_username'
    );
    RETURN NEW;
END;
$$;

-- 2. Create the missing rows, with the same derivation the trigger now uses.
--
--    display_name stays NULL: these users have never answered the gate, and the
--    whole point is that they will be asked once, and that their answer will
--    land somewhere.
--
--    ON CONFLICT DO NOTHING rather than a NOT EXISTS filter alone, so a
--    concurrent signup during the migration cannot turn this into a PK error.
INSERT INTO profiles (id, email, display_name, avatar_url, auth_provider, telegram_id, telegram_username)
SELECT
    u.id,
    COALESCE(u.email, u.raw_user_meta_data->>'email'),
    NULL,
    COALESCE(u.raw_user_meta_data->>'avatar_url', u.raw_user_meta_data->>'picture'),
    CASE
        WHEN COALESCE(u.email, '') LIKE 'telegram\_%@elchi.local' THEN 'telegram'
        WHEN u.raw_user_meta_data->>'telegram_id' IS NOT NULL THEN 'telegram'
        ELSE 'google'
    END,
    (u.raw_user_meta_data->>'telegram_id')::BIGINT,
    u.raw_user_meta_data->>'telegram_username'
FROM auth.users u
LEFT JOIN profiles p ON p.id = u.id
WHERE p.id IS NULL
ON CONFLICT (id) DO NOTHING;
