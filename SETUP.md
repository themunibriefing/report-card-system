# Phase 1 setup — GitHub Pages + Supabase

This gets you: a working Supabase backend, a login page, logout,
role detection, and a bare admin/teacher dashboard shell. No
students, teachers, marks, or report cards yet — that's Phases 2
onward.

## 1. Create the Supabase project

1. Go to https://supabase.com and sign in (or create a free account).
2. Click **New project**. Name it e.g. `canaan-report-cards`, pick a
   database password (save it somewhere safe), pick a region close
   to Uganda (e.g. Frankfurt/eu-central), click **Create new project**.
3. Wait ~2 minutes for it to finish provisioning.

## 2. Run the database schema

1. In the Supabase dashboard, open **SQL Editor** in the left sidebar.
2. Click **New query**.
3. Open `sql/001_phase1_schema.sql` from this project, copy its
   contents (everything above the commented-out "Seed" block at the
   bottom), paste into the SQL editor, and click **Run**.
4. Expected result: "Success. No rows returned" and two new tables,
   `schools` and `profiles`, visible under **Table Editor**.

## 3. Create your own login (yourself as admin)

1. In Supabase, go to **Authentication -> Users -> Add user ->
   Create new user**. Enter your email and a password. Leave
   "Auto Confirm User" checked. Click **Create user**.
2. Click on the user you just created and copy their **User UID**
   (a long uuid like `1a2b3c4d-...`).
3. Back in **SQL Editor -> New query**, uncomment and fill in the
   two `insert` statements at the bottom of
   `sql/001_phase1_schema.sql`:
   - The first creates your school row — run it first, then copy
     the `id` it returns.
   - The second creates your profile with `role = 'admin'` — paste
     in your auth user UUID from step 2, and the school id you just
     copied. Run it.
4. Expected result: one row in `schools`, one row in `profiles`
   with your name and `role = admin`, visible in **Table Editor**.

## 4. Connect the frontend to your project

1. In Supabase, go to **Project Settings -> Data API** (or **API**
   on older projects). Copy the **Project URL**.
2. Go to **Project Settings -> API Keys**. Copy the **anon /
   public** key (NOT the `service_role` key — that one must never
   go in this project).
3. Open `js/supabase-config.js` in this project and replace:
   - `SUPABASE_URL` with your Project URL
   - `SUPABASE_ANON_KEY` with your anon public key

## 5. Test it locally before deploying

You can't just double-click `login.html` — browsers block some
things on `file://` pages. Serve it locally instead:

- If you have Python installed: open a terminal in this project
  folder and run `python -m http.server 8000`, then visit
  `http://localhost:8000/login.html` in your browser.
- If you use VS Code: install the "Live Server" extension, right
  click `login.html`, choose "Open with Live Server".

Log in with the email/password you created in step 3. Expected
result: you land on `admin/dashboard.html`, and the top-right
shows your name and "Administrator". Click **Log out** — you
should be sent back to the login page, and refreshing
`admin/dashboard.html` directly should redirect you to login
(not let you back in).

## 6. Deploy to GitHub Pages

1. Create a new GitHub repository, e.g. `report-card-system`.
2. Push this whole folder to it (from a terminal inside this
   project folder):
   ```
   git init
   git add .
   git commit -m "Phase 1: auth and role detection"
   git branch -M main
   git remote add origin https://github.com/YOUR-USERNAME/report-card-system.git
   git push -u origin main
   ```
3. On GitHub, go to the repo's **Settings -> Pages**. Under
   "Build and deployment", set **Source** to "Deploy from a
   branch", branch `main`, folder `/ (root)`. Save.
4. Wait a minute, then visit
   `https://YOUR-USERNAME.github.io/report-card-system/`.
   Expected result: same behavior as step 5, now live on the
   internet and reachable from any device.

## 7. Phase 2 — the rest of the database

Once steps 1–6 are working:

1. In **SQL Editor -> New query**, paste the contents of
   `sql/002_phase2_schema.sql` and click **Run**.
2. Expected result: "Success. No rows returned", and new tables
   `academic_years`, `terms`, `classes`, `streams`, `subjects`,
   `students`, `teacher_assignments`, `class_teacher_assignments`,
   `mark_settings`, `marks`, `comments` all visible under
   **Table Editor**.
3. This phase is database-only — there's no new UI yet, so nothing
   changes in the app until Phase 3 (admin screens) is built.

A few things worth knowing about how this schema works, before we
build the screens on top of it:

- **Streams are optional.** A class like "S2" can have streams
  "A" / "B", or none at all — students and assignments work either
  way (`stream_id` is nullable throughout).
- **Total and grade are calculated by the database itself** (as
  generated columns on `marks`), so they can never drift out of
  sync with the AI/exam scores, no matter which device or screen
  wrote them.
- **The AI (out of 20) and Exam (out of 80) maximums are
  enforced by a database trigger**, checked against the
  `mark_settings` table for that subject/class/term (falling back
  to the standard 20/80 if no custom row exists). This means even
  if two teachers on two different devices try to enter marks at
  once, invalid scores are rejected at the database level, not just
  in the browser.
- **A teacher only sees/edits students and marks for classes and
  subjects an admin has explicitly assigned them to**, via
  `teacher_assignments`; a class teacher's access to a student's
  comment record works the same way, via `class_teacher_assignments`.

## 8. Phase 3 — admin screens

New pages: `admin/students.html`, `admin/teachers.html`,
`admin/classes.html`, `admin/subjects.html`, `admin/terms.html`,
`admin/assignments.html`. These just need the files present (git
push / Live Server reload) — but two of them need a bit of one-time
Supabase setup first.

### 8a. Run the Phase 3 SQL patch

1. **SQL Editor -> New query**, paste `sql/003_phase3_patch.sql`,
   **Run**.
2. This lets an admin edit a teacher's name/active status (Phase 1
   only allowed editing your own profile), and adds an `email`
   column to `profiles` so the Teachers page has something to show.

### 8b. Deploy the create-teacher Edge Function

Adding a teacher means creating them a login — and that can only be
done with Supabase's `service_role` key, which must never be placed
in the frontend. So that one operation runs as a small Supabase Edge
Function (`supabase/functions/create-teacher`) instead — this still
requires no server of your own, GitHub Pages just calls it over
HTTPS.

1. Install the Supabase CLI (one-time): see
   https://supabase.com/docs/guides/cli/getting-started for your OS.
   On Windows PowerShell with Scoop: `scoop install supabase`.
2. In a terminal, inside this project folder, log in and link the
   project:
   ```
   supabase login
   supabase link --project-ref YOUR-PROJECT-REF
   ```
   (`YOUR-PROJECT-REF` is the part of your Project URL before
   `.supabase.co`.)
3. Deploy the function:
   ```
   supabase functions deploy create-teacher
   ```
4. Expected result: the CLI prints a deployed function URL. You
   don't need to copy it anywhere — the frontend already calls it at
   `${SUPABASE_URL}/functions/v1/create-teacher` using the value
   already in `js/supabase-config.js`.
5. Test it: sign in as admin, go to **Teachers -> Add Teacher**,
   fill in a name and a real email you can check, save. Expected
   result: a "Teacher account created" dialog shows a temporary
   password — share that and the email with the teacher so they can
   sign in at `login.html`.

### 8c. Using the new pages

Suggested order for a fresh school: **Classes** (add S1–S6, and
streams like A/B if you use them) → **Subjects** → **Terms** (add
an academic year, mark it current, add Term I/II/III, mark one
current) → **Teachers** (add logins) → **Students** (add, search by
name, filter by class) → **Assignments** (assign each teacher to
their subject+class combinations, and set each class's class
teacher).

## 9. Phase 4 — teacher portal

New pages: `teacher/classes.html`, `teacher/marks.html`,
`teacher/results.html`, and the teacher dashboard now shows real
numbers. No new SQL — Phase 2's RLS already scopes everything a
teacher sees to what they've been assigned.

To try it end-to-end:

1. As admin, make sure at least one academic year and term are
   marked **current** (Terms page), and you've assigned yourself
   or a test teacher to a subject+class on the **Assignments** page.
2. Log in as that teacher (or use the temporary password from when
   you created them).
3. **My Classes** should list that subject+class assignment.
4. **Enter Marks** — pick the class/subject, confirm the year/term
   default to the current ones, enter AI and Exam scores for a
   couple of students (Total and Grade fill in live as you type),
   click **Save all marks**.
5. Expected result: a "Saved N students' marks" message. Reload the
   page — the scores you entered should still be there (this
   proves they went to Supabase, not just the browser).
6. **Results** should now show those same marks, read-only.
7. Back on the teacher dashboard, **Pending Mark Entry** should
   have dropped by however many students you just entered.

A couple of things worth knowing:

- **AI/Exam maximums** shown above the mark-entry grid come from
  `mark_settings` for that exact subject/class/term (falling back
  to 20/80) — same values the database trigger enforces, so what
  the teacher sees matches what will actually be accepted.
- **Saving is an upsert**: entering a mark for a student who
  already has one for that subject/term updates it in place, it
  doesn't create a duplicate.
- A teacher only ever sees classes/subjects an admin assigned them
  to — this is enforced by RLS at the database level, not just
  hidden in the UI, so it holds even if someone edits the page's
  JavaScript in their browser.

## 10. Phase 5 — results dashboard & student history

New pages: `admin/results.html` (filter by academic year, term,
class, stream, subject, and student name) and
`admin/student-record.html` (a single student's full academic
history — every year, every term, every subject, with grades and
class/head teacher comments where they exist). No new SQL.

- On **Students**, each row now has a **History** link that opens
  that student's record.
- On **Results**, pick a year and term (defaults to whichever are
  marked current) — you should see every mark entered so far,
  filterable further by class/stream/subject, searchable by name.

## 11. Phase 6 — report cards, settings, comments

New pages: `admin/settings.html` (school info + logo/signature
upload), `admin/reports.html` (pick year/term/class → list of
students), `reports/report-card.html` (the actual printable report
card), and `teacher/comments.html` (lets a class teacher find their
students and open the report card to write a comment).

### 11a. Run the Phase 6 SQL patch

**SQL Editor -> New query**, paste `sql/004_phase6_patch.sql`,
**Run**. This creates a Storage bucket called `school-assets` (for
the logo and signature images) and the policies that let an admin
upload to their own school's folder in it.

### 11b. Fill in school settings

Go to **Settings** as admin. Fill in the school name, motto,
address, phone, email, and head teacher's name, **Save details**.
Then upload a logo image and a signature image under the two
upload fields below — each uploads immediately and shows a
preview once done.

### 11c. Generate a report card

1. Go to **Report Cards**. Pick a year, term, and class (and
   stream, if used) — you'll see every active student in that
   class/stream with how many subjects have marks recorded.
2. Click **Preview / Print** next to any student. Expected result:
   a new tab opens with a formatted report card — school logo and
   name at the top, the student's results table, comment sections,
   and the head teacher's signature at the bottom.
3. As admin, the Head Teacher's Comment box is editable directly
   on this page — write one and click **Save comments**.
4. Click **Print / Save as PDF** — your browser's print dialog
   opens with only the report card visible (no sidebar, no
   buttons). Choose "Save as PDF" as the destination to get a PDF
   file, or print directly.

### 11d. Class teacher comments

1. As admin, make sure someone is set as the class teacher for a
   class on the **Assignments** page.
2. Log in as that teacher, go to **Comments**. Pick the class and
   term, and you'll see every student in that class.
3. Click **Open report card** next to a student — the Class
   Teacher's Comment box is editable for them (Head Teacher's
   Comment is read-only from their side), **Save comments**.
4. Expected result: when the admin previews that same student's
   report card afterward, the class teacher's comment is there
   too, sitting next to the admin's head teacher comment on the
   same record.

## What's next

That's all 6 build phases from the original brief. What's left is
mostly polishing and hardening: Phase 7 (security/cross-device
testing) and Phase 8 (final GitHub Pages deployment checklist) —
tell me when you want to go through those, or flag anything from
Phases 1–6 you'd like changed first.
