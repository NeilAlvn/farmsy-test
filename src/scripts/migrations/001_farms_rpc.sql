-- Run this in the Supabase SQL Editor before using the map page.
-- Creates an RPC function that returns farms with coordinates extracted via PostGIS.

CREATE OR REPLACE FUNCTION public.get_farms_with_coords()
RETURNS TABLE (
  name          text,
  lat           double precision,
  lng           double precision,
  address       text,
  city          text,
  postal_code   text,
  country       text,
  website       text,
  phone         text,
  email         text,
  opening_hours text,
  description   text,
  facebook      text,
  instagram     text,
  organic       text,
  produce       text,
  image         text,
  operator      text,
  osm_id        text
)
LANGUAGE sql
STABLE
SECURITY DEFINER
AS $$
  SELECT
    name,
    ST_Y(location::geometry)  AS lat,
    ST_X(location::geometry)  AS lng,
    address,
    city,
    postal_code,
    country,
    website,
    phone,
    email,
    opening_hours,
    description,
    facebook,
    instagram,
    organic,
    produce,
    image,
    operator,
    osm_id
  FROM public.farms
  WHERE is_published = true
  ORDER BY osm_id;
$$;

-- Allow the anon and authenticated roles to call the function
GRANT EXECUTE ON FUNCTION public.get_farms_with_coords() TO anon, authenticated;
