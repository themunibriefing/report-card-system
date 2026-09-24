# Testing & Launch Checklist — Phases 7 & 8

Work through this in order. Where a check involves "as admin" and
"as teacher", the easiest setup is two browsers (e.g. Chrome +
Firefox) or one normal window + one incognito/private window, each
signed in as a different account, side by side.

---

## 1. Login & session

- [ ] Admin logs in with correct email/password → lands on admin dashboard.
- [ ] Teacher logs in with correct email/password → lands on teacher dashboard.
- [ ] Wrong password → "Incorrect email or password", no login.
- [ ] Log out → returns to `login.html`.
- [ ] After logging out, manually visit `admin/dashboard.html` (or any
      admin page) directly by URL → redirected to `login.html`, not
      shown the page.
- [ ] While logged in as a teacher, manually visit an admin page by
      URL (e.g. `admin/students.html`) → redirected to
      `teacher/dashboard.html`, not shown the admin page.
- [ ] Refresh the page while logged in → stays logged in (session
      persists), doesn't bounce to login.

## 2. Students

- [ ] Add a student with only a name and class (gender/DOB optional)
      → saves fine.
- [ ] Edit a student's name → change reflected in the list immediately.
- [ ] Search by a partial name → correct student(s) appear, others don't.
- [ ] Filter by class → only that class's students show.
- [ ] Move a student to a different class (edit → change class/stream)
      → shows under the new class afterward, no orphaned record.
- [ ] Deactivate a student → status badge flips to Inactive; confirm
      they no longer appear in the teacher's mark-entry grid for
      that class.
- [ ] Search the whole app (student forms, tables, CSV if you add
      it later, report card) for anything resembling an admission
      number or student ID — there should be none, anywhere.

## 3. Teachers

- [ ] Add a teacher (Teachers → Add Teacher) → temporary password
      shown once; note it down.
- [ ] Sign in as that teacher with the temporary password → works.
- [ ] Edit the teacher's name as admin → updates.
- [ ] Deactivate a teacher, then try to sign in as them → login
      should be rejected ("This account has been deactivated...").
- [ ] Reactivate them → login works again.

## 4. Assignments & permission boundaries

This is the most important section — it's what makes the system
safe to actually use with real student data.

- [ ] Assign Teacher A to Subject X / Class S2 only. Log in as
      Teacher A → **My Classes** shows only Subject X / S2, nothing
      else, even if other subjects/classes exist.
- [ ] As Teacher A, go to **Enter Marks** → the class/subject
      dropdown only offers S2 / Subject X, not other combinations.
- [ ] Set Teacher B as class teacher for a *different* class than
      Teacher A teaches. Log in as Teacher A, go to **Comments** →
      Teacher A should see no classes there (they're not a class
      teacher for anything).
- [ ] While logged in as Teacher A, open the browser console (F12)
      and try running a query for data outside their assignment, e.g.:
      ```js
      const { data, error } = await supabaseClient
        .from('students')
        .select('*'); // no filter — try to get everyone
      console.log(data, error);
      ```
      Expected result: `data` only contains students in classes
      Teacher A is actually assigned to — RLS filters it at the
      database level, it isn't just hidden by the UI. This is the
      real security test; if this ever returns every student in the
      school, something is wrong with the RLS policies.

## 5. Marks — validation

- [ ] Enter AI = 20, Exam = 80 for a student (assuming default
      20/80 scale) → Total = 100, Grade = A, saves fine.
- [ ] Enter AI = 0, Exam = 0 → Total = 0, Grade = E, saves fine.
- [ ] Try entering AI = 25 (over the max of 20) → rejected, with a
      clear error, nothing saved.
- [ ] Try entering a negative number → rejected.
- [ ] Re-enter marks for the same student/subject/term with
      different numbers → updates the existing record (check in
      Supabase Table Editor that there's still only one row for
      that student+subject+year+term, not a duplicate).
- [ ] If you've set a custom `mark_settings` row for a subject
      (different max than 20/80), confirm both the on-screen note
      and the validation reflect the custom max, not 20/80.

## 6. Report card

Open a report card and check off everything from the original
spec:

- [ ] Correct student name, class, stream (if any), academic year, term
- [ ] Every subject with marks appears, with correct AI/Exam/Total/Grade
- [ ] School name, logo, address, contact info, motto all appear
- [ ] Class teacher's comment appears (once saved)
- [ ] Head teacher's comment appears (once saved)
- [ ] Head teacher's signature image appears
- [ ] No admission number / student ID anywhere on the page
- [ ] **Print / Save as PDF** shows only the report card — no
      sidebar, no toolbar buttons, no browser chrome bleeding in
- [ ] The resulting PDF looks acceptable when opened on its own
      (fonts render, logo isn't cut off, fits on a page reasonably)

## 7. Cross-device sync

This is the core promise of the whole rebuild — prove it actually
works before trusting it with real students.

- [ ] On Device/Browser A (as admin), add a new student.
- [ ] On Device/Browser B (a different computer, or at minimum a
      different browser/profile — not just a second tab, since tabs
      can share a cache), refresh the Students page → the new
      student appears without any manual export/import.
- [ ] On Device A (as a teacher), enter marks for a student and save.
- [ ] On Device B (as admin), open **Results** for that same
      class/subject/term → the marks entered on Device A appear.
- [ ] Ideally, repeat once from an actual phone (open the deployed
      GitHub Pages URL, not Live Server, since a phone can't reach
      your laptop's localhost) to confirm mobile really works too.

## 8. Error handling

- [ ] Turn off your WiFi, try to load a page that fetches data →
      shows a reasonable error rather than a blank page or a raw
      stack trace.
- [ ] Try to add a class with a name that already exists → clear
      "already exists" message, not a raw database error.

---

## 9. Final restrictions check (before calling it done)

Go through the project one more time and confirm:

- [ ] No admission number / student ID / registration number field
      exists anywhere — forms, tables, database schema, CSV,
      search, report card.
- [ ] `js/supabase-config.js` contains only the **anon/public**
      key — never the `service_role` key. (Search the whole
      project folder for the text "service_role" — it should only
      appear as a comment/warning, never as an actual key value.)
- [ ] No `localStorage`/`sessionStorage` is used to store student
      data, marks, or anything else that should live in Supabase —
      this project doesn't use browser storage at all, by design.
- [ ] RLS is enabled on every table (Supabase Table Editor shows a
      small shield/lock icon per table, or check **Database ->
      Tables -> [table] -> RLS enabled**).
- [ ] The existing Flask/Render system is untouched — this has all
      been a separate, parallel project the whole time.

---

## 10. Deploy for real (Phase 8)

If you followed SETUP.md section 6 already, you're likely live.
Confirm:

- [ ] `https://YOUR-USERNAME.github.io/report-card-system/` loads
      `login.html` (or redirects there) with no console errors.
- [ ] `js/supabase-config.js` on the **deployed** site has your
      real project URL/key (easy to forget to push after a local
      edit — check the live page's console, or view source, not
      just your local file).
- [ ] The `create-teacher` Edge Function is deployed (test by
      adding a teacher from the *live* site, not just locally).
- [ ] Do one final full pass of sections 1–7 above against the
      **live GitHub Pages URL**, not localhost — a few things
      (like the Edge Function's CORS) can behave differently once
      deployed.

Once this whole checklist passes, the system is ready for real
use. Nothing in Phases 1–6 needs to change unless something here
turns up a problem — if it does, tell me what you're seeing and
we'll fix it.
