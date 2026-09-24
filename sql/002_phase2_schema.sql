-- ============================================================
-- Phase 2 schema: academic structure, students, teacher
-- assignments, marks, and comments — with full RLS.
--
-- Run this AFTER 001_phase1_schema.sql, in Supabase Studio ->
-- SQL Editor -> New query -> Run.
--
-- Notes on a couple of naming choices vs. the original spec:
-- - "teachers" isn't a separate table: every user (admin or
--   teacher) already gets exactly one row in `profiles`
--   (id = auth.users.id, role = 'teacher' or 'admin'), so that
--   IS the teachers table. Assignments below reference
--   profiles.id directly.
-- - "school_settings" isn't a separate table: the `schools`
--   table from Phase 1 already holds name/address/logo/
--   signature/motto etc, so that serves the same purpose.
-- ============================================================

-- ------------------------------------------------------------
-- Helper functions, so every policy below doesn't repeat the
-- same subquery. STABLE = safe to reuse within one query.
-- ------------------------------------------------------------
create or replace function my_school_id()
returns uuid
language sql stable
as $$
  select school_id from profiles where id = auth.uid();
$$;

create or replace function is_admin()
returns boolean
language sql stable
as $$
  select exists(
    select 1 from profiles where id = auth.uid() and role = 'admin'
  );
$$;

-- ------------------------------------------------------------
-- Academic structure
-- ------------------------------------------------------------
create table if not exists academic_years (
  id uuid primary key default gen_random_uuid(),
  school_id uuid not null references schools(id) on delete cascade,
  year text not null,                 -- e.g. '2026'
  is_current boolean not null default false,
  created_at timestamptz not null default now(),
  unique (school_id, year)
);

create table if not exists terms (
  id uuid primary key default gen_random_uuid(),
  school_id uuid not null references schools(id) on delete cascade,
  academic_year_id uuid not null references academic_years(id) on delete cascade,
  name text not null,                 -- e.g. 'Term I'
  is_current boolean not null default false,
  created_at timestamptz not null default now(),
  unique (academic_year_id, name)
);

create table if not exists classes (
  id uuid primary key default gen_random_uuid(),
  school_id uuid not null references schools(id) on delete cascade,
  name text not null,                 -- e.g. 'S2'
  is_active boolean not null default true,
  created_at timestamptz not null default now(),
  unique (school_id, name)
);

create table if not exists streams (
  id uuid primary key default gen_random_uuid(),
  school_id uuid not null references schools(id) on delete cascade,
  class_id uuid not null references classes(id) on delete cascade,
  name text not null,                 -- e.g. 'A' -> "S2A"
  is_active boolean not null default true,
  created_at timestamptz not null default now(),
  unique (class_id, name)
);

create table if not exists subjects (
  id uuid primary key default gen_random_uuid(),
  school_id uuid not null references schools(id) on delete cascade,
  name text not null,                 -- e.g. 'Biology'
  is_active boolean not null default true,
  created_at timestamptz not null default now(),
  unique (school_id, name)
);

-- ------------------------------------------------------------
-- Students — name + class only, deliberately no admission
-- number / student ID of any kind.
-- ------------------------------------------------------------
create table if not exists students (
  id uuid primary key default gen_random_uuid(),
  school_id uuid not null references schools(id) on delete cascade,
  full_name text not null,
  gender text,
  date_of_birth date,
  class_id uuid not null references classes(id),
  stream_id uuid references streams(id),
  status text not null default 'active' check (status in ('active', 'inactive')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists idx_students_school on students(school_id);
create index if not exists idx_students_class on students(class_id);
create index if not exists idx_students_name on students using gin (to_tsvector('simple', full_name));

-- ------------------------------------------------------------
-- Who teaches what, to whom
-- ------------------------------------------------------------
create table if not exists teacher_assignments (
  id uuid primary key default gen_random_uuid(),
  school_id uuid not null references schools(id) on delete cascade,
  teacher_id uuid not null references profiles(id) on delete cascade,
  subject_id uuid not null references subjects(id) on delete cascade,
  class_id uuid not null references classes(id) on delete cascade,
  stream_id uuid references streams(id),
  academic_year_id uuid not null references academic_years(id) on delete cascade,
  created_at timestamptz not null default now(),
  unique (teacher_id, subject_id, class_id, stream_id, academic_year_id)
);

create table if not exists class_teacher_assignments (
  id uuid primary key default gen_random_uuid(),
  school_id uuid not null references schools(id) on delete cascade,
  teacher_id uuid not null references profiles(id) on delete cascade,
  class_id uuid not null references classes(id) on delete cascade,
  stream_id uuid references streams(id),
  academic_year_id uuid not null references academic_years(id) on delete cascade,
  created_at timestamptz not null default now(),
  unique (class_id, stream_id, academic_year_id)  -- one class teacher per class/stream/year
);

create index if not exists idx_teacher_assign_teacher on teacher_assignments(teacher_id);
create index if not exists idx_class_teacher_assign_teacher on class_teacher_assignments(teacher_id);

-- ------------------------------------------------------------
-- "Marked out of" per subject/class/term (defaults to the
-- standard 20 / 80, but a school can change it once and it
-- applies to every student without re-entering it each time).
-- ------------------------------------------------------------
create table if not exists mark_settings (
  id uuid primary key default gen_random_uuid(),
  school_id uuid not null references schools(id) on delete cascade,
  subject_id uuid not null references subjects(id) on delete cascade,
  class_id uuid not null references classes(id) on delete cascade,
  academic_year_id uuid not null references academic_years(id) on delete cascade,
  term_id uuid not null references terms(id) on delete cascade,
  ai_max numeric not null default 20 check (ai_max > 0),
  exam_max numeric not null default 80 check (exam_max > 0),
  unique (subject_id, class_id, academic_year_id, term_id)
);

-- ------------------------------------------------------------
-- Marks: total and grade are always calculated, never typed in.
-- ------------------------------------------------------------
create table if not exists marks (
  id uuid primary key default gen_random_uuid(),
  school_id uuid not null references schools(id) on delete cascade,
  student_id uuid not null references students(id) on delete cascade,
  subject_id uuid not null references subjects(id) on delete cascade,
  class_id uuid not null references classes(id) on delete cascade,
  academic_year_id uuid not null references academic_years(id) on delete cascade,
  term_id uuid not null references terms(id) on delete cascade,
  ai_score numeric not null check (ai_score >= 0),
  exam_score numeric not null check (exam_score >= 0),
  total numeric generated always as (ai_score + exam_score) stored,
  grade text generated always as (
    case
      when (ai_score + exam_score) >= 85 then 'A'
      when (ai_score + exam_score) >= 75 then 'B'
      when (ai_score + exam_score) >= 60 then 'C'
      when (ai_score + exam_score) >= 50 then 'D'
      else 'E'
    end
  ) stored,
  entered_by uuid references profiles(id),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (student_id, subject_id, academic_year_id, term_id)
);

create index if not exists idx_marks_student on marks(student_id);
create index if not exists idx_marks_lookup on marks(class_id, subject_id, academic_year_id, term_id);

-- Enforce ai_score/exam_score against that subject/class/term's
-- mark_settings (falls back to the 20/80 default if no custom
-- setting row exists yet).
create or replace function check_mark_bounds()
returns trigger
language plpgsql
as $$
declare
  v_ai_max numeric := 20;
  v_exam_max numeric := 80;
begin
  select ai_max, exam_max into v_ai_max, v_exam_max
  from mark_settings
  where subject_id = new.subject_id
    and class_id = new.class_id
    and academic_year_id = new.academic_year_id
    and term_id = new.term_id;

  if new.ai_score > coalesce(v_ai_max, 20) then
    raise exception 'Activity of Integration score (%) exceeds the maximum of %', new.ai_score, coalesce(v_ai_max, 20);
  end if;

  if new.exam_score > coalesce(v_exam_max, 80) then
    raise exception 'Final Examination score (%) exceeds the maximum of %', new.exam_score, coalesce(v_exam_max, 80);
  end if;

  return new;
end;
$$;

drop trigger if exists trg_check_mark_bounds on marks;
create trigger trg_check_mark_bounds
  before insert or update on marks
  for each row execute function check_mark_bounds();

-- ------------------------------------------------------------
-- Comments: one row per student per term. class_teacher_comment
-- is written by that class's class teacher; head_teacher_comment
-- by an admin. Both fields live on one row for simplicity; who
-- may write which field is enforced in the app layer in Phase 6.
-- ------------------------------------------------------------
create table if not exists comments (
  id uuid primary key default gen_random_uuid(),
  school_id uuid not null references schools(id) on delete cascade,
  student_id uuid not null references students(id) on delete cascade,
  academic_year_id uuid not null references academic_years(id) on delete cascade,
  term_id uuid not null references terms(id) on delete cascade,
  class_teacher_comment text,
  head_teacher_comment text,
  updated_by uuid references profiles(id),
  updated_at timestamptz not null default now(),
  unique (student_id, academic_year_id, term_id)
);

-- ============================================================
-- Row Level Security
-- ============================================================
alter table academic_years enable row level security;
alter table terms enable row level security;
alter table classes enable row level security;
alter table streams enable row level security;
alter table subjects enable row level security;
alter table students enable row level security;
alter table teacher_assignments enable row level security;
alter table class_teacher_assignments enable row level security;
alter table mark_settings enable row level security;
alter table marks enable row level security;
alter table comments enable row level security;

-- ---- Reference data: everyone in the school can read it,
-- ---- only admins can write it (teachers need it for dropdowns
-- ---- when entering marks, they just can't edit it). ----
create policy "school members read academic_years" on academic_years for select using (school_id = my_school_id());
create policy "admins write academic_years" on academic_years for all using (school_id = my_school_id() and is_admin()) with check (school_id = my_school_id() and is_admin());

create policy "school members read terms" on terms for select using (school_id = my_school_id());
create policy "admins write terms" on terms for all using (school_id = my_school_id() and is_admin()) with check (school_id = my_school_id() and is_admin());

create policy "school members read classes" on classes for select using (school_id = my_school_id());
create policy "admins write classes" on classes for all using (school_id = my_school_id() and is_admin()) with check (school_id = my_school_id() and is_admin());

create policy "school members read streams" on streams for select using (school_id = my_school_id());
create policy "admins write streams" on streams for all using (school_id = my_school_id() and is_admin()) with check (school_id = my_school_id() and is_admin());

create policy "school members read subjects" on subjects for select using (school_id = my_school_id());
create policy "admins write subjects" on subjects for all using (school_id = my_school_id() and is_admin()) with check (school_id = my_school_id() and is_admin());

create policy "school members read mark_settings" on mark_settings for select using (school_id = my_school_id());
create policy "admins write mark_settings" on mark_settings for all using (school_id = my_school_id() and is_admin()) with check (school_id = my_school_id() and is_admin());

-- ---- Students: admins see/manage everyone in their school;
-- ---- teachers only see students in a class they're assigned
-- ---- to teach. ----
create policy "admins manage students" on students for all
  using (school_id = my_school_id() and is_admin())
  with check (school_id = my_school_id() and is_admin());

create policy "teachers view assigned students" on students for select
  using (
    school_id = my_school_id()
    and exists (
      select 1 from teacher_assignments ta
      where ta.teacher_id = auth.uid()
        and ta.class_id = students.class_id
        and (ta.stream_id is null or ta.stream_id = students.stream_id)
    )
  );

-- ---- Assignments: admins manage; a teacher can see their own. ----
create policy "admins manage teacher_assignments" on teacher_assignments for all
  using (school_id = my_school_id() and is_admin())
  with check (school_id = my_school_id() and is_admin());

create policy "teachers view own assignments" on teacher_assignments for select
  using (teacher_id = auth.uid());

create policy "admins manage class_teacher_assignments" on class_teacher_assignments for all
  using (school_id = my_school_id() and is_admin())
  with check (school_id = my_school_id() and is_admin());

create policy "teachers view own class_teacher_assignments" on class_teacher_assignments for select
  using (teacher_id = auth.uid());

-- ---- Marks: admins see/manage every mark in their school;
-- ---- teachers may read/write only marks for a subject+class
-- ---- combination they are assigned to. ----
create policy "admins manage marks" on marks for all
  using (school_id = my_school_id() and is_admin())
  with check (school_id = my_school_id() and is_admin());

create policy "teachers manage assigned marks" on marks for all
  using (
    school_id = my_school_id()
    and exists (
      select 1 from teacher_assignments ta
      where ta.teacher_id = auth.uid()
        and ta.subject_id = marks.subject_id
        and ta.class_id = marks.class_id
        and ta.academic_year_id = marks.academic_year_id
    )
  )
  with check (
    school_id = my_school_id()
    and exists (
      select 1 from teacher_assignments ta
      where ta.teacher_id = auth.uid()
        and ta.subject_id = marks.subject_id
        and ta.class_id = marks.class_id
        and ta.academic_year_id = marks.academic_year_id
    )
  );

-- ---- Comments: admins manage every field; a class teacher can
-- ---- read/write the comment row for students in a class they
-- ---- are the class teacher for (field-level restriction to
-- ---- their own comment column is enforced in the app in
-- ---- Phase 6). ----
create policy "admins manage comments" on comments for all
  using (school_id = my_school_id() and is_admin())
  with check (school_id = my_school_id() and is_admin());

create policy "class teachers manage their class comments" on comments for all
  using (
    school_id = my_school_id()
    and exists (
      select 1
      from class_teacher_assignments cta
      join students s on s.id = comments.student_id
      where cta.teacher_id = auth.uid()
        and cta.class_id = s.class_id
        and (cta.stream_id is null or cta.stream_id = s.stream_id)
        and cta.academic_year_id = comments.academic_year_id
    )
  )
  with check (
    school_id = my_school_id()
    and exists (
      select 1
      from class_teacher_assignments cta
      join students s on s.id = comments.student_id
      where cta.teacher_id = auth.uid()
        and cta.class_id = s.class_id
        and (cta.stream_id is null or cta.stream_id = s.stream_id)
        and cta.academic_year_id = comments.academic_year_id
    )
  );
