-- ============================================================
-- Legacy Foundry — full founder profile (run once)
-- Supabase dashboard → SQL Editor → New query → paste → Run
-- Safe to re-run.
-- Adds the founder-profile columns and makes new sign-ups
-- automatically copy their details into the profiles table.
-- ============================================================

-- Make sure the profiles table exists (created earlier). If not, create it.
create table if not exists public.profiles (
  id          uuid primary key references auth.users (id) on delete cascade,
  full_name   text,
  created_at  timestamptz not null default now()
);

-- Add the founder-profile columns (safe to re-run).
alter table public.profiles add column if not exists company    text;
alter table public.profiles add column if not exists role       text;
alter table public.profiles add column if not exists stage      text;
alter table public.profiles add column if not exists region     text;
alter table public.profiles add column if not exists building   text;
alter table public.profiles add column if not exists avatar_url text;
alter table public.profiles add column if not exists updated_at timestamptz;

alter table public.profiles enable row level security;

-- A logged-in user can view / insert / update only their own row.
drop policy if exists "users can view own profile" on public.profiles;
create policy "users can view own profile"
  on public.profiles for select to authenticated using (auth.uid() = id);

drop policy if exists "users can update own profile" on public.profiles;
create policy "users can update own profile"
  on public.profiles for update to authenticated using (auth.uid() = id);

drop policy if exists "users can insert own profile" on public.profiles;
create policy "users can insert own profile"
  on public.profiles for insert to authenticated with check (auth.uid() = id);

-- When a new account is created, copy every profile field that the
-- sign-up form stored in the account metadata into the profiles table.
create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer set search_path = public
as $$
begin
  insert into public.profiles (id, full_name, company, role, stage, region, building, avatar_url)
  values (
    new.id,
    new.raw_user_meta_data ->> 'full_name',
    new.raw_user_meta_data ->> 'company',
    new.raw_user_meta_data ->> 'role',
    new.raw_user_meta_data ->> 'stage',
    new.raw_user_meta_data ->> 'region',
    new.raw_user_meta_data ->> 'building',
    new.raw_user_meta_data ->> 'avatar_url'
  )
  on conflict (id) do update set
    full_name  = excluded.full_name,
    company    = excluded.company,
    role       = excluded.role,
    stage      = excluded.stage,
    region     = excluded.region,
    building   = excluded.building,
    avatar_url = excluded.avatar_url;
  return new;
end;
$$;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();
