let currentProfile = null;
let classTeacherAssignments = [];

const alertBox = document.getElementById("alertBox");
const classTeacherSelect = document.getElementById("classTeacherSelect");
const yearSelect = document.getElementById("yearSelect");
const termSelect = document.getElementById("termSelect");
const tableBody = document.getElementById("tableBody");

(async () => {
  currentProfile = await requireRole("teacher");
  if (!currentProfile) return;
  document.getElementById("whoAmI").textContent = `${currentProfile.full_name} · Teacher`;
  await load();
})();

document.getElementById("logoutBtn").addEventListener("click", logout);

async function load() {
  const { data: cta, error } = await supabaseClient
    .from("class_teacher_assignments")
    .select("id, class_id, stream_id, academic_year_id, classes(name), streams(name), academic_years(year)")
    .eq("teacher_id", currentProfile.id);

  if (error) {
    alertBox.innerHTML = `<div class="alert error">${escapeHtml(error.message)}</div>`;
    return;
  }

  classTeacherAssignments = cta;
  if (classTeacherAssignments.length === 0) {
    tableBody.innerHTML = `<tr><td colspan="2"><div class="empty-state">You're not set as a class teacher for any class right now.</div></td></tr>`;
    classTeacherSelect.style.display = "none";
    yearSelect.style.display = "none";
    termSelect.style.display = "none";
    return;
  }

  classTeacherSelect.innerHTML = classTeacherAssignments
    .map(
      (a) =>
        `<option value="${a.id}">${escapeHtml(a.classes.name)}${a.streams ? " " + escapeHtml(a.streams.name) : ""} — ${escapeHtml(a.academic_years.year)}</option>`
    )
    .join("");

  await onSelectionChange();
}

async function onSelectionChange() {
  const assignment = classTeacherAssignments.find((a) => a.id === classTeacherSelect.value);
  if (!assignment) return;

  const { data: terms } = await supabaseClient
    .from("terms")
    .select("id, name, is_current")
    .eq("academic_year_id", assignment.academic_year_id)
    .order("name");

  termSelect.innerHTML = (terms || []).map((t) => `<option value="${t.id}">${escapeHtml(t.name)}${t.is_current ? " (current)" : ""}</option>`).join("");
  const currentTerm = (terms || []).find((t) => t.is_current);
  if (currentTerm) termSelect.value = currentTerm.id;

  await loadStudents();
}

classTeacherSelect.addEventListener("change", onSelectionChange);
termSelect.addEventListener("change", loadStudents);

async function loadStudents() {
  const assignment = classTeacherAssignments.find((a) => a.id === classTeacherSelect.value);
  if (!assignment || !termSelect.value) return;

  tableBody.innerHTML = `<tr><td colspan="2" class="page-loading">Loading…</td></tr>`;

  let query = supabaseClient
    .from("students")
    .select("id, full_name")
    .eq("class_id", assignment.class_id)
    .eq("status", "active")
    .order("full_name");
  if (assignment.stream_id) query = query.eq("stream_id", assignment.stream_id);

  const { data: students, error } = await query;
  if (error) {
    tableBody.innerHTML = `<tr><td colspan="2"><div class="empty-state">${escapeHtml(error.message)}</div></td></tr>`;
    return;
  }
  if (students.length === 0) {
    tableBody.innerHTML = `<tr><td colspan="2"><div class="empty-state">No students in this class yet.</div></td></tr>`;
    return;
  }

  tableBody.innerHTML = students
    .map((s) => {
      const params = new URLSearchParams({ student: s.id, year: assignment.academic_year_id, term: termSelect.value });
      return `
      <tr>
        <td>${escapeHtml(s.full_name)}</td>
        <td><a href="../reports/report-card.html?${params.toString()}" target="_blank" class="text-link">Open report card</a></td>
      </tr>`;
    })
    .join("");
}
