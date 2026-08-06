-- ---------------------------------------------------------------------------
-- Elchi — display_name means "the name the user typed", and nothing else
-- ---------------------------------------------------------------------------
-- Correction to 2026-08-06-profile-display-name.sql, applied the same day.
--
-- That migration kept the signup trigger's habit of seeding display_name from
-- provider metadata (Google's full_name / name, Telegram's first_name). The
-- capture gate in the app tests exactly that column, so a seeded value reads as
-- "already answered" and the gate never opens. In practice this meant:
--
--   * a Telegram login was never asked for a name — the bridge always supplies
--     first_name, so the column was never NULL;
--   * every existing profile had a provider name, so the gate that was supposed
--     to catch them on next login caught nobody;
--   * the profile sheet printed a name the user never chose.
--
-- The column now has one writer: the user, through the capture gate. Provider
-- metadata stays in auth.users.raw_user_meta_data (nothing is lost) and is
-- still the source for avatar_url and telegram_username — it just no longer
-- decides what the board calls someone.
--
-- Apply on top of a live DB. Idempotent — safe to re-run.

-- 1. Stop seeding. display_name is written as NULL at signup, which is what
--    makes the gate fire on the user's first session. Every other column keeps
--    reading provider metadata exactly as before.
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
        -- Deliberately NULL, not the provider's name. See the header.
        NULL,
        COALESCE(NEW.raw_user_meta_data->>'avatar_url', NEW.raw_user_meta_data->>'picture'),
        COALESCE(NEW.raw_user_meta_data->>'provider', NEW.raw_app_meta_data->>'provider'),
        (NEW.raw_user_meta_data->>'telegram_id')::BIGINT,
        NEW.raw_user_meta_data->>'telegram_username'
    );
    RETURN NEW;
END;
$$;

-- 2. Clear the seeded names. Every display_name currently stored arrived from a
--    provider, because the gate — the only other writer — could not fire while
--    the column was non-NULL. So there is no user-entered value to preserve and
--    no need to distinguish one: the whole column goes.
--
--    This is not data loss. The provider names remain in
--    auth.users.raw_user_meta_data, and each owner is asked to choose a name the
--    next time they log in.
UPDATE profiles SET display_name = NULL WHERE display_name IS NOT NULL;

-- 3. normalize_display_name() had exactly one caller — the trigger above, which
--    no longer needs it. Nothing else references it (the CHECK constraint spells
--    its rules out inline), so it comes off rather than sitting as dead code
--    that looks like a shared helper.
DROP FUNCTION IF EXISTS normalize_display_name(TEXT);
