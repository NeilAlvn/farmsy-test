-- Run this in the Supabase SQL Editor before importing Overture Maps data.
-- Expands the source check constraint to allow 'overture'.

ALTER TABLE public.farms DROP CONSTRAINT IF EXISTS farms_source_check;

ALTER TABLE public.farms
  ADD CONSTRAINT farms_source_check
  CHECK (source IN ('osm', 'jecuisinelocal', 'fish_import', 'boerengids', 'lucas', 'traces', 'foursquare', 'overture'));
