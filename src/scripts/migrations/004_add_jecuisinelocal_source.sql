-- Run this in the Supabase SQL Editor before importing JeCuisineLocal data.
-- Expands the source check constraint to allow 'jecuisinelocal' in addition to 'osm'.

ALTER TABLE public.farms DROP CONSTRAINT IF EXISTS farms_source_check;

ALTER TABLE public.farms
  ADD CONSTRAINT farms_source_check
  CHECK (source IN ('osm', 'jecuisinelocal'));
