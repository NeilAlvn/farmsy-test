-- 012: reviews table + avg_rating / review_count on farms
--
-- Farmers and visitors can leave a 1-5 star rating with an optional written review.
-- avg_rating and review_count on farms are maintained automatically by trigger.

-- ── reviews ───────────────────────────────────────────────────────────────────
create table if not exists public.reviews (
  id             uuid        primary key default gen_random_uuid(),
  farm_osm_id    text        not null,
  user_id        uuid        not null references auth.users(id) on delete cascade,
  reviewer_name  text        not null,
  rating         smallint    not null check (rating between 1 and 5),
  body           text,
  created_at     timestamptz not null default now(),
  updated_at     timestamptz not null default now(),
  unique (user_id, farm_osm_id)
);

create index if not exists reviews_farm_idx on public.reviews (farm_osm_id);
create index if not exists reviews_user_idx on public.reviews (user_id);

-- ── RLS ───────────────────────────────────────────────────────────────────────
alter table public.reviews enable row level security;

create policy "anyone can read reviews"
  on public.reviews for select using (true);

create policy "authenticated users can insert own review"
  on public.reviews for insert to authenticated
  with check (auth.uid() = user_id);

create policy "users can update own review"
  on public.reviews for update
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);

create policy "users can delete own review"
  on public.reviews for delete
  using (auth.uid() = user_id);

-- ── updated_at trigger ────────────────────────────────────────────────────────
create or replace function public.set_updated_at()
returns trigger language plpgsql as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

create trigger reviews_set_updated_at
  before update on public.reviews
  for each row execute procedure public.set_updated_at();

-- ── avg_rating + review_count on farms ───────────────────────────────────────
alter table public.farms
  add column if not exists avg_rating   float,
  add column if not exists review_count int not null default 0;

create or replace function public.update_farm_review_stats()
returns trigger language plpgsql security definer as $$
declare
  v_osm_id text;
begin
  v_osm_id := coalesce(old.farm_osm_id, new.farm_osm_id);
  update public.farms
  set
    avg_rating   = (select avg(rating::float) from public.reviews where farm_osm_id = v_osm_id),
    review_count = (select count(*)           from public.reviews where farm_osm_id = v_osm_id)
  where osm_id = v_osm_id;
  return coalesce(new, old);
end;
$$;

drop trigger if exists on_review_change on public.reviews;
create trigger on_review_change
  after insert or update or delete on public.reviews
  for each row execute procedure public.update_farm_review_stats();
