-- 1. Create helper function to clean and validate the name from providers, falling back to 'Foydalanuvchi'
CREATE OR REPLACE FUNCTION normalize_display_name(raw TEXT)
RETURNS TEXT
LANGUAGE sql IMMUTABLE
AS $$
    SELECT CASE 
        WHEN raw IS NULL THEN 'Foydalanuvchi'
        WHEN char_length(btrim(raw)) BETWEEN 2 AND 40 THEN btrim(raw)
        ELSE 'Foydalanuvchi'
    END;
$$;

-- 2. Drop the UPDATE policy so users can no longer modify their display_name
DROP POLICY IF EXISTS "Users can update own profile" ON profiles;

-- 3. Overwrite all existing names with their provider name, falling back to 'Foydalanuvchi'
UPDATE profiles p
SET display_name = normalize_display_name(
    COALESCE(u.raw_user_meta_data->>'display_name', u.raw_user_meta_data->>'full_name', u.raw_user_meta_data->>'name', u.raw_user_meta_data->>'first_name')
)
FROM auth.users u
WHERE p.id = u.id;
