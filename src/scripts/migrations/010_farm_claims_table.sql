-- 010: farm_claims table + is_claimed column on farms
-- farm_claims: stores ownership claim requests submitted via ClaimModal
-- is_claimed: set to true on farms when a claim is approved by admin

-- ── farm_claims ───────────────────────────────────────────────────────────────
create table if not exists public.farm_claims (
  id                  uuid        primary key default gen_random_uuid(),
  farm_osm_id         text        not null,
  user_id             uuid        references auth.users(id) on delete set null,
  full_name           text        not null,
  email               text        not null,
  phone               text        not null,
  verification_method text        not null check (verification_method in ('email', 'kvk')),
  kvk_number          text,
  message             text,
  status              text        not null default 'pending'
                                  check (status in ('pending', 'approved', 'rejected')),
  created_at          timestamptz not null default now(),
  reviewed_at         timestamptz,
  reviewed_by         text,
  rejection_reason    text
);

-- Index for admin queries filtering by status
create index if not exists farm_claims_status_idx on public.farm_claims (status);
-- Index for looking up claims by farm
create index if not exists farm_claims_farm_idx  on public.farm_claims (farm_osm_id);

-- ── RLS ───────────────────────────────────────────────────────────────────────
alter table public.farm_claims enable row level security;

-- Anyone (including anonymous visitors) can submit a claim
create policy "anyone can insert claims"
  on public.farm_claims for insert
  with check (true);

-- Authenticated users can view their own claims (optional / future use)
create policy "users can view own claims"
  on public.farm_claims for select
  using (auth.uid() = user_id);

-- Admin reads/updates via service_role key (bypasses RLS) — no extra policy needed

-- ── is_claimed on farms ───────────────────────────────────────────────────────
alter table public.farms
  add column if not exists is_claimed boolean not null default false;
