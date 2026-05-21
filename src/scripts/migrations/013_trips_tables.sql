-- 013_trips_tables.sql
-- Farm Visit Planner: trips and trip_farms tables

create table if not exists public.trips (
  id         uuid        primary key default gen_random_uuid(),
  user_id    uuid        not null references auth.users(id) on delete cascade,
  name       text        not null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

alter table public.trips enable row level security;

-- Anyone can read a trip by ID (share links use the opaque UUID)
create policy "public: read trips"
  on public.trips for select
  using (true);

create policy "users: insert own trips"
  on public.trips for insert
  with check (auth.uid() = user_id);

create policy "users: update own trips"
  on public.trips for update
  using  (auth.uid() = user_id)
  with check (auth.uid() = user_id);

create policy "users: delete own trips"
  on public.trips for delete
  using (auth.uid() = user_id);

-- ── trip_farms ────────────────────────────────────────────────────────────────
-- Coordinates and display data cached here so share links work independently
-- of any future farm-data changes.

create table if not exists public.trip_farms (
  id          uuid             primary key default gen_random_uuid(),
  trip_id     uuid             not null references public.trips(id) on delete cascade,
  farm_osm_id text             not null,
  farm_name   text             not null,
  farm_lat    double precision not null,
  farm_lng    double precision not null,
  farm_city   text,
  farm_image  text,
  sort_order  integer          not null default 0,
  created_at  timestamptz      not null default now(),
  unique (trip_id, farm_osm_id)
);

alter table public.trip_farms enable row level security;

-- Anyone can read trip_farms (needed for public share links)
create policy "public: read trip_farms"
  on public.trip_farms for select
  using (true);

-- Trip owners can manage their trip_farms via the parent trip
create policy "users: manage own trip_farms"
  on public.trip_farms for all
  using (
    exists (select 1 from public.trips t where t.id = trip_id and t.user_id = auth.uid())
  )
  with check (
    exists (select 1 from public.trips t where t.id = trip_id and t.user_id = auth.uid())
  );

-- ── Auto-update trips.updated_at ──────────────────────────────────────────────

create or replace function public.trips_set_updated_at()
returns trigger language plpgsql as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

drop trigger if exists trips_updated_at on public.trips;
create trigger trips_updated_at
  before update on public.trips
  for each row execute function public.trips_set_updated_at();

-- ── Indexes ───────────────────────────────────────────────────────────────────

create index if not exists trips_user_id_idx        on public.trips      (user_id);
create index if not exists trip_farms_trip_id_idx   on public.trip_farms (trip_id);
create index if not exists trip_farms_order_idx     on public.trip_farms (trip_id, sort_order);
