let currentProfile = null;
let assignments = [];
let years = [];

const alertBox = document.getElementById("alertBox");
const assignmentSelect = document.getElementById("assignmentSelect");
const yearSelect = document.getElementById("yearSelect");
const termSelect = document.getElementById("termSelect");
const resultsBody = document.getElementById("resultsBody");

(async () => {
  currentProfile = await requireRole("teacher");
  if (!currentProfile) return;
  document.getElementById("whoAmI").textContent = `${currentProfile.full_name} · Teacher`;
  await load();
})();

document.getElementById("logoutBtn").addEventListener("click", logout);

async function load() {
  const { data: sa, error } = await supabaseClient
    .from("teacher_assignments")
    .select("id, subject_id, class_id, stream_id, subjects(name), classes(name), streams(name)")
    .eq("teacher_id", currentProfile.id);

  if (error) {
    alertBox.innerHTML = `<div class="alert error">${escapeHtml(error.message)}</div>`;
    return;
  }

  assignments = sa;
  if (assignments.length === 0) {
    resultsBody.innerHTML = `<tr><td colspan="5"><div class="empty-state">No subjects assigned yet.</div></td></tr>`;
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
  await loadResults();
}

async function loadTerms() {
  const { data: t } = await supabaseClient
    .from("terms")
    .select("id, name, is_current")
    .eq("academic_year_id", yearSelect.value)
    .order("name");
  termSelect.innerHTML = (t || []).map((tm) => `<option value="${tm.id}">${escapeHtml(tm.name)}${tm.is_current ? " (current)" : ""}</option>`).join("");
  const currentTerm = (t || []).find((tm) => tm.is_current);
  if (currentTerm) termSelect.value = currentTerm.id;
}

assignmentSelect.addEventListener("change", loadResults);
yearSelect.addEventListener("change", async () => {
  await loadTerms();
  await loadResults();
});
termSelect.addEventListener("change", loadResults);

async function loadResults() {
  alertBox.innerHTML = "";
  if (!assignmentSelect.value || !termSelect.value) return;

  const assignment = assignments.find((a) => a.id === assignmentSelect.value);
  resultsBody.innerHTML = `<tr><td colspan="5" class="page-loading">Loading…</td></tr>`;

  const { data, error } = await supabaseClient
    .from("marks")
    .select("ai_score, exam_score, total, grade, students(full_name)")
    .eq("subject_id", assignment.subject_id)
    .eq("class_id", assignment.class_id)
    .eq("academic_year_id", yearSelect.value)
    .eq("term_id", termSelect.value)
    .order("students(full_name)");

  if (error) {
    resultsBody.innerHTML = `<tr><td colspan="5"><div class="empty-state">${escapeHtml(error.message)}</div></td></tr>`;
    return;
  }

  if (data.length === 0) {
    resultsBody.innerHTML = `<tr><td colspan="5"><div class="empty-state">No marks entered yet for this class/subject/term.</div></td></tr>`;
    return;
  }

  resultsBody.innerHTML = data
    .map(
      (m) => `
    <tr>
      <td>${escapeHtml(m.students ? m.students.full_name : "—")}</td>
      <td>${m.ai_score}</td>
      <td>${m.exam_score}</td>
      <td>${m.total}</td>
      <td>${escapeHtml(m.grade)}</td>
    </tr>`
    )
    .join("");
}
