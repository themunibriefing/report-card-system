-- ============================================================
-- Phase 6 patch: a Storage bucket for the school logo and head
-- teacher's signature, with RLS scoping uploads to an admin's
-- own school. Run after 001, 002, 003.
-- ============================================================

insert into storage.buckets (id, name, public)
values ('school-assets', 'school-assets', true)
on conflict (id) do nothing;

-- Files are stored as "<school_id>/logo.<ext>" and
-- "<school_id>/signature.<ext>" — these policies only let an
-- admin touch files inside their own school's folder.
create policy "admins manage their school's assets"
  on storage.objects for all
  using (
    bucket_id = 'school-assets'
    and (storage.foldername(name))[1] = my_school_id()::text
    and is_admin()
  )
  with check (
    bucket_id = 'school-assets'
    and (storage.foldername(name))[1] = my_school_id()::text
    and is_admin()
  );

-- The bucket is public, so logos/signatures render in report
-- cards and settings pages for anyone with the file's public URL
-- (needed for the printable report card page) — this just lets
-- any signed-in school member read/list them through the SDK too.
create policy "school members view their school's assets"
  on storage.objects for select
  using (
    bucket_id = 'school-assets'
    and (storage.foldername(name))[1] = my_school_id()::text
  );
