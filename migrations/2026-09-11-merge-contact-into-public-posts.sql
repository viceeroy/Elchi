-- 2026-09-11: Merge contact details directly into public_posts read view
--
-- Exposes contact and contact2 directly in the public feed view so the frontend
-- can display them immediately without a secondary on-demand fetch.
-- Drops the retired get_post_contact() function.

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
    p.headline,
    p.note,
    p.contact,
    p.contact_type,
    p.contact2,
    p.contact2_type,
    (p.contact2 IS NOT NULL) AS has_contact2,
    pr.display_name,
    p.created_at,
    p.expires_at
FROM posts p
LEFT JOIN profiles pr ON pr.id = p.user_id
WHERE p.expires_at >= CURRENT_DATE
  AND p.type <> 'announcement';

GRANT SELECT ON public_posts TO anon, authenticated;

DROP FUNCTION IF EXISTS get_post_contact(UUID);
