-- Run this in the Supabase SQL Editor before deploying the clustering / slim-payload map update.
--
-- Creates get_farms_slim() — a single RPC that replaces the two-query pattern
-- (get_farms_with_coords + farms table select) in map/page.tsx.
-- Drops the heavy fields (description, email, facebook, instagram, organic, produce, operator)
-- so the initial map payload is ~40% smaller. Full details are fetched on-demand
-- via /api/farm/[osmId] when a user opens a farm modal.

CREATE OR REPLACE FUNCTION public.get_farms_slim()
RETURNS TABLE (
  osm_id            text,
  name              text,
  lat               double precision,
  lng               double precision,
  address           text,
  city              text,
  postal_code       text,
  country           text,
  phone             text,
  website           text,
  opening_hours     text,
  image             text,
  primary_tag       text,
  farm_type         text[],
  enrichment_source text,
  source            text,
  avg_rating        double precision,
  review_count      integer
)
LANGUAGE sql
STABLE
SECURITY DEFINER
AS $$
  SELECT
    osm_id,
    name,
    ST_Y(location::geometry)  AS lat,
    ST_X(location::geometry)  AS lng,
    address,
    city,
    postal_code,
    country,
    phone,
    website,
    opening_hours,
    image,
    primary_tag,
    farm_type,
    enrichment_source,
    source,
    avg_rating,
    review_count
  FROM public.farms
  WHERE is_published = true
  ORDER BY osm_id;
$$;

GRANT EXECUTE ON FUNCTION public.get_farms_slim() TO anon, authenticated;
