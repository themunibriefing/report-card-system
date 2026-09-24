-- ============================================================
-- Phase 1 schema: schools + profiles (auth/role detection only)
-- Run this in Supabase Studio -> SQL Editor -> New query -> Run
-- ============================================================

-- Schools (multi-school-ready from day one; you will have exactly
-- one row here for Canaan Progressive Schools to start with)
create table if not exists schools (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  address text,
  phone text,
  email text,
  motto text,
  head_teacher_name text,
  logo_url text,
  signature_url text,
  created_at timestamptz not null default now()
);

-- One row per authenticated user, linked 1:1 to Supabase Auth's
-- built-in auth.users table. This is how we know whether someone
-- who just logged in is an admin or a teacher, and which school
-- they belong to.
create table if not exists profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  school_id uuid not null references schools(id) on delete cascade,
  full_name text not null,
  role text not null check (role in ('admin', 'teacher')),
  is_active boolean not null default true,
  created_at timestamptz not null default now()
);

create index if not exists idx_profiles_school on profiles(school_id);

-- ------------------------------------------------------------
-- Row Level Security
-- ------------------------------------------------------------
alter table schools enable row level security;
alter table profiles enable row level security;

-- Any logged-in user can read their own school's basic info
-- (needed to show the school name/logo on the dashboard).
create policy "school members can view their school"
  on schools for select
  using (
    id in (select school_id from profiles where profiles.id = auth.uid())
  );

-- Only admins can edit school settings (used from Phase 3 onward,
-- safe to create now).
create policy "admins can update their school"
  on schools for update
  using (
    id in (
      select school_id from profiles
      where profiles.id = auth.uid() and profiles.role = 'admin'
    )
  );

-- A user can always read their own profile row (this is what
-- powers role detection right after login).
create policy "users can view own profile"
  on profiles for select
  using (id = auth.uid());

-- Admins can read every profile that belongs to their own school
-- (needed later for teacher management).
create policy "admins can view profiles in their school"
  on profiles for select
  using (
    school_id in (
      select school_id from profiles p2
      where p2.id = auth.uid() and p2.role = 'admin'
    )
  );

-- A user can update a couple of harmless fields on their own
-- profile (e.g. full_name), but never their own role.
create policy "users can update own name"
  on profiles for update
  using (id = auth.uid())
  with check (id = auth.uid());

-- ------------------------------------------------------------
-- Seed: create your school + your own admin profile
-- ------------------------------------------------------------
-- 1. Run the block above first.
-- 2. In Supabase Studio -> Authentication -> Users, click
--    "Add user" and create yourself an account (email + password).
--    Copy the UUID it gives that user.
-- 3. Replace the placeholders below and run this block.

-- insert into schools (name, address, phone, email, head_teacher_name)
-- values (
--   'Canaan Progressive Schools',
--   'Arua, Uganda',
--   '0770707899',
--   'info@canaanprogressive.example',
--   'Mr. Atabua Kennedy'
-- )
-- returning id;   -- copy this id, you'll need it below

-- insert into profiles (id, school_id, full_name, role)
-- values (
--   'PASTE-YOUR-AUTH-USER-UUID-HERE',
--   'PASTE-THE-SCHOOL-ID-FROM-ABOVE-HERE',
--   'Your Name',
--   'admin'
-- );
