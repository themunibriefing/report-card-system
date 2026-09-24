let currentProfile = null;
let years = [], classes = [], streams = [];

const alertBox = document.getElementById("alertBox");
const yearSelect = document.getElementById("yearSelect");
const termSelect = document.getElementById("termSelect");
const classSelect = document.getElementById("classSelect");
const streamSelect = document.getElementById("streamSelect");
const tableBody = document.getElementById("tableBody");

(async () => {
  currentProfile = await requireRole("admin");
  if (!currentProfile) return;
  document.getElementById("whoAmI").textContent = `${currentProfile.full_name} · Administrator`;
  await loadLookups();
})();

document.getElementById("logoutBtn").addEventListener("click", logout);

async function loadLookups() {
  const [{ data: y }, { data: c }, { data: st }] = await Promise.all([
    supabaseClient.from("academic_years").select("id, year, is_current").order("year", { ascending: false }),
    supabaseClient.from("classes").select("id, name").eq("is_active", true).order("name"),
    supabaseClient.from("streams").select("id, class_id, name").eq("is_active", true).order("name"),
  ]);

  years = y || []; classes = c || []; streams = st || [];

  if (years.length === 0 || classes.length === 0) {
    alertBox.innerHTML = `<div class="alert error">Add an academic year and at least one class before generating report cards.</div>`;
    return;
  }

  yearSelect.innerHTML = years.map((yr) => `<option value="${yr.id}">${escapeHtml(yr.year)}${yr.is_current ? " (current)" : ""}</option>`).join("");
  const currentYear = years.find((yr) => yr.is_current);
  if (currentYear) yearSelect.value = currentYear.id;

  classSelect.innerHTML = classes.map((c) => `<option value="${c.id}">${escapeHtml(c.name)}</option>`).join("");

  updateStreamOptions();
  await loadTerms();
  await loadStudents();
}

function updateStreamOptions() {
  const opts = streams.filter((s) => s.class_id === classSelect.value);
  streamSelect.innerHTML = `<option value="">Whole class</option>` + opts.map((s) => `<option value="${s.id}">${escapeHtml(s.name)}</option>`).join("");
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

yearSelect.addEventListener("change", async () => {
  await loadTerms();
  await loadStudents();
});
termSelect.addEventListener("change", loadStudents);
classSelect.addEventListener("change", () => {
  updateStreamOptions();
  loadStudents();
});
streamSelect.addEventListener("change", loadStudents);

async function loadStudents() {
  alertBox.innerHTML = "";
  if (!yearSelect.value || !termSelect.value || !classSelect.value) return;

  tableBody.innerHTML = `<tr><td colspan="3" class="page-loading">Loading…</td></tr>`;

  let query = supabaseClient
    .from("students")
    .select("id, full_name")
    .eq("class_id", classSelect.value)
    .eq("status", "active")
    .order("full_name");
  if (streamSelect.value) query = query.eq("stream_id", streamSelect.value);

  const { data: students, error } = await query;
  if (error) {
    tableBody.innerHTML = `<tr><td colspan="3"><div class="empty-state">${escapeHtml(error.message)}</div></td></tr>`;
    return;
  }
  if (students.length === 0) {
    tableBody.innerHTML = `<tr><td colspan="3"><div class="empty-state">No students in this class/stream yet.</div></td></tr>`;
    return;
  }

  const { data: marks } = await supabaseClient
    .from("marks")
    .select("student_id")
    .eq("academic_year_id", yearSelect.value)
    .eq("term_id", termSelect.value)
    .in("student_id", students.map((s) => s.id));

  const countByStudent = {};
  (marks || []).forEach((m) => (countByStudent[m.student_id] = (countByStudent[m.student_id] || 0) + 1));

  tableBody.innerHTML = students
    .map((s) => {
      const count = countByStudent[s.id] || 0;
      const params = new URLSearchParams({ student: s.id, year: yearSelect.value, term: termSelect.value });
      return `
      <tr>
        <td>${escapeHtml(s.full_name)}</td>
        <td>${count} subject${count === 1 ? "" : "s"}</td>
        <td><a href="../reports/report-card.html?${params.toString()}" target="_blank" class="text-link">Preview / Print</a></td>
      </tr>`;
    })
    .join("");
}
