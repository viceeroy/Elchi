-- 2026-09-11: Support up to 3 contacts (2 phone numbers + 1 Telegram)
--
-- Adds contact3 and contact3_type to posts table, and updates public_posts
-- view to include them.

ALTER TABLE posts ADD COLUMN IF NOT EXISTS contact3 VARCHAR(100);
ALTER TABLE posts ADD COLUMN IF NOT EXISTS contact3_type VARCHAR(10) CHECK (contact3_type IN ('telegram', 'phone'));

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
    p.contact3,
    p.contact3_type,
    (p.contact2 IS NOT NULL) AS has_contact2,
    (p.contact3 IS NOT NULL) AS has_contact3,
    pr.display_name,
    p.created_at,
    p.expires_at
FROM posts p
LEFT JOIN profiles pr ON pr.id = p.user_id
WHERE p.expires_at >= CURRENT_DATE
  AND p.type <> 'announcement';

GRANT SELECT ON public_posts TO anon, authenticated;
