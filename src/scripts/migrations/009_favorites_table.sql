-- 009_favorites_table.sql
-- Stores which farms each user has bookmarked.

create table if not exists public.favorites (
  id          uuid        primary key default gen_random_uuid(),
  user_id     uuid        not null references auth.users(id) on delete cascade,
  farm_osm_id text        not null,
  created_at  timestamptz not null default now(),
  unique (user_id, farm_osm_id)
);

alter table public.favorites enable row level security;

-- Users can read, insert, and delete their own rows only
create policy "users: manage own favorites"
  on public.favorites for all
  using  (auth.uid() = user_id)
  with check (auth.uid() = user_id);

-- Fast lookup by user
create index if not exists favorites_user_id_idx on public.favorites (user_id);
