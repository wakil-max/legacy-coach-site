-- ============================================================
-- Legacy Coach — Supabase database setup
-- Run this once in your Supabase project:
--   Supabase dashboard -> SQL Editor -> New query -> paste -> Run
-- Safe to re-run (uses IF NOT EXISTS / idempotent policies).
-- ============================================================

-- ---------- 1. Beta signups (from the "Claim my spot" box) ----------
create table if not exists public.signups (
  id          uuid primary key default gen_random_uuid(),
  email       text not null,
  source      text,                       -- e.g. 'beta_page'
  created_at  timestamptz not null default now()
);
-- prevent the same email being added twice
create unique index if not exists signups_email_key on public.signups (lower(email));

alter table public.signups enable row level security;

-- Anyone (anonymous visitor) may submit a signup, but nobody can read them
-- back from the public site. You read them in the Supabase Table Editor.
drop policy if exists "anyone can insert a signup" on public.signups;
create policy "anyone can insert a signup"
  on public.signups for insert
  to anon, authenticated
  with check (true);

-- ---------- 2. Contact / inquiry messages ----------
create table if not exists public.contacts (
  id          uuid primary key default gen_random_uuid(),
  name        text not null,
  email       text not null,
  message     text not null,
  created_at  timestamptz not null default now()
);

alter table public.contacts enable row level security;

drop policy if exists "anyone can send a contact message" on public.contacts;
create policy "anyone can send a contact message"
  on public.contacts for insert
  to anon, authenticated
  with check (true);

-- ---------- 3. User profiles (linked to Supabase Auth accounts) ----------
create table if not exists public.profiles (
  id          uuid primary key references auth.users (id) on delete cascade,
  full_name   text,
  created_at  timestamptz not null default now()
);

alter table public.profiles enable row level security;

-- A logged-in user can see and edit only their own profile row.
drop policy if exists "users can view own profile" on public.profiles;
create policy "users can view own profile"
  on public.profiles for select
  to authenticated
  using (auth.uid() = id);

drop policy if exists "users can update own profile" on public.profiles;
create policy "users can update own profile"
  on public.profiles for update
  to authenticated
  using (auth.uid() = id);

drop policy if exists "users can insert own profile" on public.profiles;
create policy "users can insert own profile"
  on public.profiles for insert
  to authenticated
  with check (auth.uid() = id);

-- Automatically create a profile row whenever a new account signs up.
create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer set search_path = public
as $$
begin
  insert into public.profiles (id, full_name)
  values (new.id, new.raw_user_meta_data ->> 'full_name')
  on conflict (id) do nothing;
  return new;
end;
$$;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();
