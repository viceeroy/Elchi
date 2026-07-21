-- ===========================================================================
-- Elchi — capture email on profiles (fix: Google rows had no address)
-- Run ONCE in Supabase → SQL Editor. Idempotent and safe to re-run.
--
-- The profiles table stored telegram_id/telegram_username but never the user's
-- email, so Google (gmail) signups looked empty. Add an email column, capture
-- it in the signup trigger from auth.users.email, and backfill existing rows.
-- ===========================================================================

-- 1. Add the column.
ALTER TABLE profiles ADD COLUMN IF NOT EXISTS email TEXT;

-- 2. Update the signup trigger to store email for both providers. email comes
--    from auth.users.email — the real gmail for Google, the synthetic
--    telegram_<id>@elchi.local for the Telegram bridge.
CREATE OR REPLACE FUNCTION handle_new_user()
RETURNS TRIGGER AS $$
BEGIN
    INSERT INTO public.profiles (id, email, display_name, avatar_url, auth_provider, telegram_id, telegram_username)
    VALUES (
        NEW.id,
        COALESCE(NEW.email, NEW.raw_user_meta_data->>'email'),
        COALESCE(NEW.raw_user_meta_data->>'display_name', NEW.raw_user_meta_data->>'full_name', NEW.raw_user_meta_data->>'name'),
        COALESCE(NEW.raw_user_meta_data->>'avatar_url', NEW.raw_user_meta_data->>'picture'),
        COALESCE(NEW.raw_user_meta_data->>'provider', NEW.raw_app_meta_data->>'provider'),
        (NEW.raw_user_meta_data->>'telegram_id')::BIGINT,
        NEW.raw_user_meta_data->>'telegram_username'
    );
    RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- 3. Backfill existing profiles from auth.users.
UPDATE profiles p
SET email = u.email
FROM auth.users u
WHERE u.id = p.id AND p.email IS NULL;
