-- ============================================================
-- Phase 3 patch: admins need to be able to edit a teacher's
-- name and activate/deactivate them. Phase 1 only let a user
-- edit their own profile — this adds an admin-scoped policy.
-- Run after 001 and 002.
-- ============================================================

create policy "admins update profiles in their school"
  on profiles for update
  using (school_id = my_school_id() and is_admin())
  with check (school_id = my_school_id() and is_admin());

-- profiles.email is a convenience copy of the auth.users email
-- (which client code can't read directly), set once when the
-- create-teacher Edge Function creates the account, so the admin
-- can see who a teacher login belongs to on the Teachers page.
alter table profiles add column if not exists email text;
