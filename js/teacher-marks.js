let currentProfile = null;
let assignments = [];
let years = [];
let terms = [];
let markSettings = { ai_max: 20, exam_max: 80 };
let rows = []; // { student_id, full_name, ai_score, exam_score, existingMarkId }

const alertBox = document.getElementById("alertBox");
const assignmentSelect = document.getElementById("assignmentSelect");
const yearSelect = document.getElementById("yearSelect");
const termSelect = document.getElementById("termSelect");
const scaleNote = document.getElementById("scaleNote");
const marksBody = document.getElementById("marksBody");
const saveAllBtn = document.getElementById("saveAllBtn");

(async () => {
  currentProfile = await requireRole("teacher");
  if (!currentProfile) return;
  document.getElementById("whoAmI").textContent = `${currentProfile.full_name} · Teacher`;
  await loadAssignmentsAndYears();
})();

document.getElementById("logoutBtn").addEventListener("click", logout);

function gradeFor(total) {
  if (total >= 85) return "A";
  if (total >= 75) return "B";
  if (total >= 60) return "C";
  if (total >= 50) return "D";
  return "E";
}

async function loadAssignmentsAndYears() {
  const { data: sa, error } = await supabaseClient
    .from("teacher_assignments")
    .select("id, subject_id, class_id, stream_id, academic_year_id, subjects(name), classes(name), streams(name)")
    .eq("teacher_id", currentProfile.id);

  if (error) {
    alertBox.innerHTML = `<div class="alert error">${escapeHtml(error.message)}</div>`;
    return;
  }

  assignments = sa;
  if (assignments.length === 0) {
    marksBody.innerHTML = `<tr><td colspan="5"><div class="empty-state">No subjects assigned yet — ask your administrator to assign you.</div></td></tr>`;
    assignmentSelect.style.display = "none";
    yearSelect.style.display = "none";
    termSelect.style.display = "none";
    saveAllBtn.style.display = "none";
    return;
  }

  assignmentSelect.innerHTML = assignments
    .map(
      (a) =>
        `<option value="${a.id}">${escapeHtml(a.subjects.name)} — ${escapeHtml(a.classes.name)}${a.streams ? " " + escapeHtml(a.streams.name) : ""}</option>`
    )
    .join("");

  const { data: y } = await supabaseClient.from("academic_years").select("id, year, is_current").order("year", { ascending: false });
  years = y || [];
  yearSelect.innerHTML = years.map((yr) => `<option value="${yr.id}">${escapeHtml(yr.year)}${yr.is_current ? " (current)" : ""}</option>`).join("");
  const currentYear = years.find((yr) => yr.is_current);
  if (currentYear) yearSelect.value = currentYear.id;

  await loadTerms();
  await loadMarksGrid();
}

async function loadTerms() {
  const { data: t } = await supabaseClient
    .from("terms")
    .select("id, name, is_current")
    .eq("academic_year_id", yearSelect.value)
    .order("name");
  terms = t || [];
  termSelect.innerHTML = terms.map((tm) => `<option value="${tm.id}">${escapeHtml(tm.name)}${tm.is_current ? " (current)" : ""}</option>`).join("");
  const currentTerm = terms.find((tm) => tm.is_current);
  if (currentTerm) termSelect.value = currentTerm.id;
}

assignmentSelect.addEventListener("change", loadMarksGrid);
yearSelect.addEventListener("change", async () => {
  await loadTerms();
  await loadMarksGrid();
});
termSelect.addEventListener("change", loadMarksGrid);

async function loadMarksGrid() {
  alertBox.innerHTML = "";
  if (!assignmentSelect.value || !termSelect.value) return;

  const assignment = assignments.find((a) => a.id === assignmentSelect.value);
  marksBody.innerHTML = `<tr><td colspan="5" class="page-loading">Loading…</td></tr>`;

  // Max marks for this subject/class/term (falls back to 20/80).
  const { data: ms } = await supabaseClient
    .from("mark_settings")
    .select("ai_max, exam_max")
    .eq("subject_id", assignment.subject_id)
    .eq("class_id", assignment.class_id)
    .eq("academic_year_id", yearSelect.value)
    .eq("term_id", termSelect.value)
    .maybeSingle();

  markSettings = ms || { ai_max: 20, exam_max: 80 };
  scaleNote.textContent = `Activity of Integration out of ${markSettings.ai_max} · Final Examination out of ${markSettings.exam_max}`;

  // Students in this class/stream.
  let studentQuery = supabaseClient
    .from("students")
    .select("id, full_name")
    .eq("class_id", assignment.class_id)
    .eq("status", "active")
    .order("full_name");
  if (assignment.stream_id) studentQuery = studentQuery.eq("stream_id", assignment.stream_id);

  const { data: students, error: studErr } = await studentQuery;
  if (studErr) {
    marksBody.innerHTML = `<tr><td colspan="5"><div class="empty-state">${escapeHtml(studErr.message)}</div></td></tr>`;
    return;
  }

  if (students.length === 0) {
    marksBody.innerHTML = `<tr><td colspan="5"><div class="empty-state">No students in this class yet.</div></td></tr>`;
    rows = [];
    return;
  }

  // Existing marks for these students, this subject/year/term.
  const { data: existing } = await supabaseClient
    .from("marks")
    .select("id, student_id, ai_score, exam_score")
    .eq("subject_id", assignment.subject_id)
    .eq("academic_year_id", yearSelect.value)
    .eq("term_id", termSelect.value)
    .in("student_id", students.map((s) => s.id));

  const existingByStudent = {};
  (existing || []).forEach((m) => (existingByStudent[m.student_id] = m));

  rows = students.map((s) => {
    const m = existingByStudent[s.id];
    return {
      student_id: s.id,
      full_name: s.full_name,
      ai_score: m ? m.ai_score : "",
      exam_score: m ? m.exam_score : "",
      existingMarkId: m ? m.id : null,
    };
  });

  renderGrid();
}

function renderGrid() {
  marksBody.innerHTML = rows
    .map((r, i) => {
      const total = (Number(r.ai_score) || 0) + (Number(r.exam_score) || 0);
      const grade = r.ai_score !== "" && r.exam_score !== "" ? gradeFor(total) : "—";
      return `
    <tr data-row="${i}">
      <td>${escapeHtml(r.full_name)}</td>
      <td><input type="number" min="0" max="${markSettings.ai_max}" step="0.5" value="${r.ai_score}" data-field="ai" style="width:70px;padding:6px 8px;border:1px solid var(--border);border-radius:4px;" /></td>
      <td><input type="number" min="0" max="${markSettings.exam_max}" step="0.5" value="${r.exam_score}" data-field="exam" style="width:70px;padding:6px 8px;border:1px solid var(--border);border-radius:4px;" /></td>
      <td class="row-total">${r.ai_score !== "" && r.exam_score !== "" ? total : "—"}</td>
      <td class="row-grade">${grade}</td>
    </tr>`;
    })
    .join("");
}

marksBody.addEventListener("input", (e) => {
  const tr = e.target.closest("tr");
  if (!tr) return;
  const i = Number(tr.dataset.row);
  const field = e.target.dataset.field;
  if (!field) return;

  rows[i][field === "ai" ? "ai_score" : "exam_score"] = e.target.value;

  const total = (Number(rows[i].ai_score) || 0) + (Number(rows[i].exam_score) || 0);
  const hasBoth = rows[i].ai_score !== "" && rows[i].exam_score !== "";
  tr.querySelector(".row-total").textContent = hasBoth ? total : "—";
  tr.querySelector(".row-grade").textContent = hasBoth ? gradeFor(total) : "—";
});

saveAllBtn.addEventListener("click", async () => {
  alertBox.innerHTML = "";
  const assignment = assignments.find((a) => a.id === assignmentSelect.value);

  const toSave = rows.filter((r) => r.ai_score !== "" && r.exam_score !== "");
  if (toSave.length === 0) {
    alertBox.innerHTML = `<div class="alert error">Enter at least one student's AI and Exam scores first.</div>`;
    return;
  }

  for (const r of toSave) {
    if (Number(r.ai_score) > markSettings.ai_max || Number(r.exam_score) > markSettings.exam_max || Number(r.ai_score) < 0 || Number(r.exam_score) < 0) {
      alertBox.innerHTML = `<div class="alert error">${escapeHtml(r.full_name)}'s scores are out of range (AI: 0–${markSettings.ai_max}, Exam: 0–${markSettings.exam_max}).</div>`;
      return;
    }
  }

  saveAllBtn.disabled = true;
  saveAllBtn.textContent = "Saving…";

  const payload = toSave.map((r) => ({
    school_id: currentProfile.school_id,
    student_id: r.student_id,
    subject_id: assignment.subject_id,
    class_id: assignment.class_id,
    academic_year_id: yearSelect.value,
    term_id: termSelect.value,
    ai_score: Number(r.ai_score),
    exam_score: Number(r.exam_score),
    entered_by: currentProfile.id,
    updated_at: new Date().toISOString(),
  }));

  const { error } = await supabaseClient
    .from("marks")
    .upsert(payload, { onConflict: "student_id,subject_id,academic_year_id,term_id" });

  saveAllBtn.disabled = false;
  saveAllBtn.textContent = "Save all marks";

  if (error) {
    alertBox.innerHTML = `<div class="alert error">${escapeHtml(error.message)}</div>`;
    return;
  }

  alertBox.innerHTML = `<div class="alert success">Saved ${toSave.length} student${toSave.length === 1 ? "" : "s"}' marks.</div>`;
  await loadMarksGrid();
});
