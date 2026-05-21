-- Adds enrichment_source column to track where business data was enriched from.
-- Run this in the Supabase SQL Editor before deploying the Google attribution UI.

ALTER TABLE public.farms
  ADD COLUMN IF NOT EXISTS enrichment_source text
  CHECK (enrichment_source IN ('google_places'));
