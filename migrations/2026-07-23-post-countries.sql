-- Store the route as structured country codes instead of inferring it from
-- free-text city names. Cities stay free text; countries are the filterable
-- data. New countries need no schema change — just new ISO codes in the app's
-- COUNTRIES registry and the API's ALLOWED_COUNTRIES set.

ALTER TABLE posts ADD COLUMN IF NOT EXISTS from_country VARCHAR(2);
ALTER TABLE posts ADD COLUMN IF NOT EXISTS to_country   VARCHAR(2);

-- Shape check only (uppercase ISO alpha-2) — deliberately NOT a fixed country
-- list, so adding a country never needs a migration.
DO $$
BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'posts_from_country_check') THEN
        ALTER TABLE posts ADD CONSTRAINT posts_from_country_check
            CHECK (from_country IS NULL OR from_country ~ '^[A-Z]{2}$');
    END IF;
    IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'posts_to_country_check') THEN
        ALTER TABLE posts ADD CONSTRAINT posts_to_country_check
            CHECK (to_country IS NULL OR to_country ~ '^[A-Z]{2}$');
    END IF;
END $$;

-- Route lookups filter on the pair.
CREATE INDEX IF NOT EXISTS idx_posts_route ON posts(from_country, to_country);

-- Backfill existing posts from the legacy direction column
-- (k2u = Korea → Uzbekistan, u2k = Uzbekistan → Korea).
UPDATE posts SET from_country = 'KR', to_country = 'UZ'
WHERE from_country IS NULL AND direction = 'k2u';

UPDATE posts SET from_country = 'UZ', to_country = 'KR'
WHERE from_country IS NULL AND direction = 'u2k';

-- Any stragglers without a direction: infer from whether the origin city is a
-- known Korean city (the old client-side heuristic), else assume UZ → KR.
UPDATE posts SET from_country = 'KR', to_country = 'UZ'
WHERE from_country IS NULL AND lower(from_city) IN (
  'seoul','busan','daegu','incheon','gwangju','daejeon','ulsan','sejong',
  'suwon','seongnam','uijeongbu','anyang','bucheon','gwangmyeong','pyeongtaek',
  'dongducheon','ansan','goyang','gwacheon','guri','namyangju','osan','siheung',
  'gunpo','uiwang','hanam','yongin','paju','icheon','anseong','gimpo','hwaseong',
  'yangju','pocheon','yeoju','gwangju (gyeonggi)',
  'chuncheon','wonju','gangneung','donghae','taebaek','sokcho','samcheok',
  'cheongju','chungju','jecheon',
  'cheonan','gongju','boryeong','asan','seosan','nonsan','gyeryong','dangjin',
  'jeonju','gunsan','iksan','jeongeup','namwon','gimje',
  'mokpo','yeosu','suncheon','naju','gwangyang',
  'pohang','gyeongju','gimcheon','andong','gumi','yeongju','yeongcheon',
  'sangju','mungyeong','gyeongsan',
  'changwon','jinju','tongyeong','sacheon','gimhae','miryang','geoje','yangsan',
  'jeju city','seogwipo'
);

UPDATE posts SET from_country = 'UZ', to_country = 'KR'
WHERE from_country IS NULL;
