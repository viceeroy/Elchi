-- Fix legacy posts where expires_at was incorrectly set to 1 month after the flight date.
-- api/posts.ts sets expires_at to 1 day after the flight date, which means the post naturally
-- drops out of the feed when the flight date has passed.
UPDATE posts
SET expires_at = date + 1
WHERE date IS NOT NULL AND type = 'traveler' AND expires_at <> (date + 1);
