-- 011: Supabase Storage bucket for farm photos
--
-- Run this SQL in the Supabase SQL Editor, then also create the storage bucket
-- via the Supabase Dashboard > Storage > New bucket:
--   Name: farm-images
--   Public: true
--
-- Alternatively, create it via the Management API or the dashboard UI.
-- The SQL below sets the RLS policies assuming the bucket already exists.

-- Allow anyone to read (view) farm images (bucket must be public)
-- This is configured on the bucket itself in the Supabase dashboard (Public bucket = true).

-- Allow service_role (used by dashboard server actions) to upload images.
-- Service_role bypasses RLS, so no policy is needed for writes via the server action.

-- No SQL migration is required for the bucket itself — create it in the Supabase
-- dashboard under Storage > New bucket > Name: "farm-images", toggle Public ON.
