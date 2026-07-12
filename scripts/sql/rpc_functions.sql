-- ============================================================
-- RPC FUNCTIONS for Supabase PostgREST
-- These functions handle complex queries that PostgREST
-- cannot express through its standard REST API.
-- ============================================================

-- 1. FTS Search (exact mode)
-- Used by: src/app/api/games/route.ts
CREATE OR REPLACE FUNCTION search_games_exact(
  search_query TEXT,
  result_limit INT DEFAULT 100
)
RETURNS TABLE(id TEXT)
LANGUAGE plpgsql
AS $$
BEGIN
  RETURN QUERY
  SELECT g.id FROM "Game" g
  WHERE to_tsvector('english', unaccent(g.title) || ' ' || COALESCE(unaccent(g.summary), '')) @@ plainto_tsquery('english', unaccent(search_query))
     OR similarity(g.title, search_query) > 0.18
     OR similarity(COALESCE(g."developerNames", ''), search_query) > 0.2
     OR similarity(COALESCE(g."genreNames", ''), search_query) > 0.2
     OR similarity(COALESCE(g."platformNames", ''), search_query) > 0.2
     OR regexp_replace(lower(unaccent(g.title)), '[^a-z0-9]', '', 'g') = regexp_replace(lower(unaccent(search_query)), '[^a-z0-9]', '', 'g')
     OR similarity(regexp_replace(lower(unaccent(g.title)), '[^a-z0-9]', '', 'g'), regexp_replace(lower(unaccent(search_query)), '[^a-z0-9]', '', 'g')) > 0.18
  ORDER BY GREATEST(
    CASE WHEN regexp_replace(lower(unaccent(g.title)), '[^a-z0-9]', '', 'g') = regexp_replace(lower(unaccent(search_query)), '[^a-z0-9]', '', 'g') THEN 1.0 ELSE 0.0 END,
    similarity(g.title, search_query),
    similarity(regexp_replace(lower(unaccent(g.title)), '[^a-z0-9]', '', 'g'), regexp_replace(lower(unaccent(search_query)), '[^a-z0-9]', '', 'g')),
    similarity(COALESCE(g."developerNames", ''), search_query)
  ) DESC
  LIMIT result_limit;
END;
$$;

-- 2. FTS Search (semantic mode with expanded query)
-- Used by: src/app/api/games/route.ts
CREATE OR REPLACE FUNCTION search_games_semantic(
  cleaned_query TEXT,
  expanded_query TEXT,
  result_limit INT DEFAULT 100
)
RETURNS TABLE(id TEXT)
LANGUAGE plpgsql
AS $$
BEGIN
  RETURN QUERY
  SELECT g.id FROM "Game" g
  WHERE to_tsvector('english', unaccent(g.title) || ' ' || COALESCE(unaccent(g.summary), '')) @@ plainto_tsquery('english', unaccent(expanded_query))
     OR similarity(g.title, cleaned_query) > 0.18
     OR regexp_replace(lower(unaccent(g.title)), '[^a-z0-9]', '', 'g') = regexp_replace(lower(unaccent(cleaned_query)), '[^a-z0-9]', '', 'g')
     OR similarity(regexp_replace(lower(unaccent(g.title)), '[^a-z0-9]', '', 'g'), regexp_replace(lower(unaccent(cleaned_query)), '[^a-z0-9]', '', 'g')) > 0.18
  ORDER BY GREATEST(
    CASE WHEN regexp_replace(lower(unaccent(g.title)), '[^a-z0-9]', '', 'g') = regexp_replace(lower(unaccent(cleaned_query)), '[^a-z0-9]', '', 'g') THEN 1.0 ELSE 0.0 END,
    similarity(g.title, cleaned_query),
    similarity(regexp_replace(lower(unaccent(g.title)), '[^a-z0-9]', '', 'g'), regexp_replace(lower(unaccent(cleaned_query)), '[^a-z0-9]', '', 'g'))
  ) DESC
  LIMIT result_limit;
END;
$$;

-- 3. Random games with optional tag filtering
-- Used by: src/app/api/games/route.ts (random sort)
CREATE OR REPLACE FUNCTION random_games(
  tag_slugs TEXT[] DEFAULT NULL,
  result_limit INT DEFAULT 20
)
RETURNS TABLE(id TEXT)
LANGUAGE plpgsql
AS $$
BEGIN
  IF tag_slugs IS NULL OR array_length(tag_slugs, 1) IS NULL THEN
    RETURN QUERY
    SELECT g.id FROM "Game" g
    ORDER BY random()
    LIMIT result_limit;
  ELSE
    RETURN QUERY
    SELECT g.id FROM "Game" g
    JOIN "_GameToTag" gt ON g.id = gt."A"
    JOIN "Tag" t ON gt."B" = t.id
    WHERE t.slug = ANY(tag_slugs)
    GROUP BY g.id
    HAVING COUNT(DISTINCT t.slug) = array_length(tag_slugs, 1)
    ORDER BY random()
    LIMIT result_limit;
  END IF;
END;
$$;

-- 4. Price snapshots with ROW_NUMBER window function
-- Used by: src/app/api/games/route.ts, src/app/page.tsx
CREATE OR REPLACE FUNCTION get_cheapest_snapshots(game_ids TEXT[])
RETURNS TABLE(
  "gameId" TEXT,
  "storeName" TEXT,
  "dealPrice" DOUBLE PRECISION,
  "retailPrice" DOUBLE PRECISION,
  "discountPercent" DOUBLE PRECISION,
  "dealUrl" TEXT,
  "currency" TEXT,
  "country" TEXT
)
LANGUAGE sql
AS $$
  SELECT sub."gameId", sub."storeName", sub."dealPrice", sub."retailPrice",
         sub."discountPercent", sub."dealUrl", sub."currency", sub."country"
  FROM (
    SELECT *,
      ROW_NUMBER() OVER (PARTITION BY "gameId" ORDER BY "dealPrice" ASC)::int as rn
    FROM "PriceSnapshot"
    WHERE "gameId" = ANY(game_ids)
  ) sub
  WHERE sub.rn <= 3
  ORDER BY sub."gameId", sub.rn;
$$;

-- 5. Database stats
-- Used by: src/app/api/stats/route.ts, src/app/page.tsx
CREATE OR REPLACE FUNCTION get_db_stats()
RETURNS TABLE(
  games BIGINT,
  developers BIGINT,
  publishers BIGINT,
  tags BIGINT,
  screenshots BIGINT,
  waitlist BIGINT
)
LANGUAGE sql
AS $$
  SELECT
    (SELECT COUNT(*) FROM "Game"),
    (SELECT COUNT(*) FROM "Developer"),
    (SELECT COUNT(*) FROM "Publisher"),
    (SELECT COUNT(*) FROM "Tag"),
    (SELECT COALESCE(SUM(cardinality(screenshots))::bigint, 0) FROM "Game"),
    (SELECT COUNT(*) FROM "Waitlist");
$$;

-- 6. Random game for redirect
-- Used by: src/app/random/route.ts
CREATE OR REPLACE FUNCTION random_game_slug()
RETURNS TEXT
LANGUAGE plpgsql
AS $$
DECLARE
  total_count INT;
  random_offset INT;
  result_slug TEXT;
BEGIN
  SELECT COUNT(*) INTO total_count FROM "Game";
  IF total_count = 0 THEN
    RETURN NULL;
  END IF;
  random_offset := floor(random() * total_count);
  SELECT slug INTO result_slug FROM "Game" OFFSET random_offset LIMIT 1;
  RETURN result_slug;
END;
$$;

-- 7. Health check
-- Used by: src/app/api/status/route.ts
CREATE OR REPLACE FUNCTION health_check()
RETURNS BOOLEAN
LANGUAGE sql
AS $$
  SELECT true;
$$;

-- 8. Check if user limit reached and user exists
-- Used by: src/app/api/user/sync/route.ts, src/app/auth/callback/route.ts
CREATE OR REPLACE FUNCTION upsert_user_safe(
  user_id TEXT,
  user_email TEXT,
  max_users INT DEFAULT 10000
)
RETURNS JSON
LANGUAGE plpgsql
AS $$
DECLARE
  current_count BIGINT;
  existing_user RECORD;
BEGIN
  SELECT COUNT(*) INTO current_count FROM "User";
  IF current_count >= max_users THEN
    SELECT * INTO existing_user FROM "User" WHERE id = user_id;
    IF existing_user IS NULL THEN
      RETURN json_build_object('success', false, 'error', 'Registration limit reached');
    END IF;
  END IF;

  INSERT INTO "User" (id, email, "createdAt")
  VALUES (user_id, user_email, NOW())
  ON CONFLICT (id) DO UPDATE SET email = EXCLUDED.email;

  RETURN json_build_object('success', true);
END;
$$;
