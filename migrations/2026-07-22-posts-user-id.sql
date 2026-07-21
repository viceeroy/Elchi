-- ===========================================================================
-- Elchi — add user_id to posts (for the profile "my posts" count)
-- Run ONCE in Supabase → SQL Editor BEFORE deploying the profile-sheet change.
-- Idempotent and safe to re-run. Posts stay readable anonymously; user_id is
-- optional and only set when a logged-in user creates a post.
-- ===========================================================================

ALTER TABLE posts ADD COLUMN IF NOT EXISTS user_id UUID REFERENCES auth.users(id) ON DELETE SET NULL;

CREATE INDEX IF NOT EXISTS idx_posts_user_id ON posts(user_id);

-- Let a logged-in user read their OWN posts even after they expire, so the
-- profile count reflects all posts they've made (not just currently-active).
-- Public still only sees active posts via the existing SELECT policy.
DROP POLICY IF EXISTS "Users can read own posts" ON posts;
CREATE POLICY "Users can read own posts"
ON posts FOR SELECT
USING (auth.uid() = user_id);
