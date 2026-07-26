-- ===========================================================================
-- Elchi — Phase 1 security fixes: stop bulk harvesting of contact details
-- Run ONCE in Supabase → SQL Editor BEFORE deploying this branch.
-- Idempotent and safe to re-run.
--
-- Problem this fixes: the old SELECT policy on `posts` was
--   USING (expires_at >= CURRENT_DATE)
-- with no role restriction, and the anon key is bundled into the browser app.
-- Anyone could therefore query PostgREST directly and download every active
-- post's phone number and Telegram handle in a single request. No amount of
-- validation in api/posts.ts could prevent that, because the API was never in
-- the request path.
--
-- Shape of the fix:
--   1. `public_posts` view — everything the board needs to render, minus the
--      contact values and minus user_id. Readable by anon.
--   2. Direct SELECT on `posts` is revoked. `authenticated` keeps a
--      column-level grant on (id, user_id) only, which is what the delete
--      filter and the profile post-count need — never the contact columns.
--   3. `get_post_contact(uuid)` — the only way to obtain a contact value. One
--      post per call, logged-in callers only, so harvesting requires an
--      account and is rate-limitable per user (see lib/rate-limit.ts).
--
-- Requires PostgreSQL 15+ for the `security_invoker` view option (Supabase
-- projects created in recent years are 15 or newer).
-- ===========================================================================

-- ---------------------------------------------------------------------------
-- 1. Public projection of posts, without the contact values.
-- ---------------------------------------------------------------------------
-- Deliberately a SECURITY DEFINER view (security_invoker = false): it runs as
-- its owner and so bypasses the `posts` RLS below, which is exactly what lets
-- anon read the non-sensitive columns while having no access to the table
-- itself. The `expires_at` filter that used to live in the RLS policy is
-- reproduced here so the view cannot leak expired rows.
--
-- contact_type / contact2_type are exposed (telegram vs phone) but the handles
-- are not, so the UI can render the right icon before the viewer logs in.
DROP VIEW IF EXISTS public_posts;
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
-- 2. Lock down direct table access.
-- ---------------------------------------------------------------------------
-- The SELECT policy stays defined (scoped to authenticated) so that if a grant
-- is ever restored by hand, the table does not silently become world-readable
-- again. With the grants below it governs only the (id, user_id) columns.
DROP POLICY IF EXISTS "Allow public read access to active posts" ON posts;
DROP POLICY IF EXISTS "Authenticated users read active posts" ON posts;
CREATE POLICY "Authenticated users read active posts"
ON posts FOR SELECT
TO authenticated
USING (expires_at >= CURRENT_DATE);

REVOKE SELECT ON posts FROM anon;
REVOKE SELECT ON posts FROM authenticated;

-- Column-level grant: enough for `DELETE ... WHERE id = ? AND user_id = ?`
-- (Postgres requires SELECT on every column a statement references), for the
-- `.select('id')` that follows an insert, and for the profile post count.
-- Not enough to read a single contact value.
GRANT SELECT (id, user_id) ON posts TO authenticated;

-- ---------------------------------------------------------------------------
-- 3. The only route to a contact value.
-- ---------------------------------------------------------------------------
-- One post per call, authenticated callers only. SECURITY DEFINER so it can
-- read the columns the caller's own grants exclude; search_path is pinned so
-- the definer context cannot be hijacked by a shadowing schema.
CREATE OR REPLACE FUNCTION get_post_contact(p_id UUID)
RETURNS TABLE (
    contact       TEXT,
    contact_type  TEXT,
    contact2      TEXT,
    contact2_type TEXT
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
BEGIN
    IF auth.uid() IS NULL THEN
        RAISE EXCEPTION 'authentication required' USING ERRCODE = '42501';
    END IF;

    RETURN QUERY
    SELECT p.contact::TEXT, p.contact_type::TEXT, p.contact2::TEXT, p.contact2_type::TEXT
    FROM posts p
    WHERE p.id = p_id AND p.expires_at >= CURRENT_DATE;
END;
$$;

REVOKE ALL ON FUNCTION get_post_contact(UUID) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION get_post_contact(UUID) TO authenticated, service_role;
