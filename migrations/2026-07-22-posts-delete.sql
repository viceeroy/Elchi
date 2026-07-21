-- ===========================================================================
-- Elchi — allow a logged-in user to delete their OWN posts.
-- Run ONCE in Supabase → SQL Editor BEFORE deploying the delete-post change.
-- Idempotent and safe to re-run. Without this policy RLS blocks all deletes,
-- so the delete endpoint would silently affect 0 rows.
-- ===========================================================================

DROP POLICY IF EXISTS "Users can delete own posts" ON posts;
CREATE POLICY "Users can delete own posts"
ON posts FOR DELETE
USING (auth.uid() = user_id);
