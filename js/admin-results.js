let currentProfile = null;
let years = [], classes = [], subjects = [], streams = [];
let allResults = [];

const alertBox = document.getElementById("alertBox");
const yearSelect = document.getElementById("yearSelect");
const termSelect = document.getElementById("termSelect");
const classFilter = document.getElementById("classFilter");
const streamFilter = document.getElementById("streamFilter");
const subjectFilter = document.getElementById("subjectFilter");
const searchInput = document.getElementById("searchInput");
const resultsBody = document.getElementById("resultsBody");
const resultCount = document.getElementById("resultCount");

(async () => {
  currentProfile = await requireRole("admin");
  if (!currentProfile) return;
  document.getElementById("whoAmI").textContent = `${currentProfile.full_name} · Administrator`;
  await loadLookups();
  await loadResults();
})();

document.getElementById("logoutBtn").addEventListener("click", logout);

async function loadLookups() {
  const [{ data: y }, { data: c }, { data: s }, { data: st }] = await Promise.all([
    supabaseClient.from("academic_years").select("id, year, is_current").order("year", { ascending: false }),
    supabaseClient.from("classes").select("id, name").order("name"),
    supabaseClient.from("subjects").select("id, name").order("name"),
    supabaseClient.from("streams").select("id, class_id, name").order("name"),
  ]);

  years = y || []; classes = c || []; subjects = s || []; streams = st || [];

  if (years.length === 0) {
    alertBox.innerHTML = `<div class="alert error">Add an academic year on the Terms page first.</div>`;
    return;
  }

  yearSelect.innerHTML = years.map((yr) => `<option value="${yr.id}">${escapeHtml(yr.year)}${yr.is_current ? " (current)" : ""}</option>`).join("");
  const currentYear = years.find((yr) => yr.is_current);
  if (currentYear) yearSelect.value = currentYear.id;

  classFilter.innerHTML += classes.map((c) => `<option value="${c.id}">${escapeHtml(c.name)}</option>`).join("");
  subjectFilter.innerHTML += subjects.map((s) => `<option value="${s.id}">${escapeHtml(s.name)}</option>`).join("");

  await loadTerms();
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

function updateStreamFilter() {
  const opts = streams.filter((s) => !classFilter.value || s.class_id === classFilter.value);
  streamFilter.innerHTML = `<option value="">All streams</option>` + opts.map((s) => `<option value="${s.id}">${escapeHtml(s.name)}</option>`).join("");
}

yearSelect.addEventListener("change", async () => {
  await loadTerms();
  await loadResults();
});
termSelect.addEventListener("change", loadResults);
classFilter.addEventListener("change", () => {
  updateStreamFilter();
  loadResults();
});
streamFilter.addEventListener("change", loadResults);
subjectFilter.addEventListener("change", loadResults);
searchInput.addEventListener("input", debounce(renderTable, 150));

updateStreamFilter();

async function loadResults() {
  alertBox.innerHTML = "";
  if (!yearSelect.value || !termSelect.value) {
    resultsBody.innerHTML = `<tr><td colspan="7"><div class="empty-state">Add a term for this academic year first.</div></td></tr>`;
    return;
  }
  resultsBody.innerHTML = `<tr><td colspan="7" class="page-loading">Loading…</td></tr>`;

  let query = supabaseClient
    .from("marks")
    .select("ai_score, exam_score, total, grade, students(full_name, class_id, stream_id), subjects(id, name), classes(name)")
    .eq("academic_year_id", yearSelect.value)
    .eq("term_id", termSelect.value);

  if (classFilter.value) query = query.eq("class_id", classFilter.value);
  if (subjectFilter.value) query = query.eq("subject_id", subjectFilter.value);

  const { data, error } = await query;

  if (error) {
    resultsBody.innerHTML = `<tr><td colspan="7"><div class="empty-state">${escapeHtml(error.message)}</div></td></tr>`;
    return;
  }

  allResults = streamFilter.value ? data.filter((m) => m.students && m.students.stream_id === streamFilter.value) : data;
  renderTable();
}

function renderTable() {
  const q = searchInput.value.trim().toLowerCase();
  const rows = allResults
    .filter((m) => !q || (m.students && m.students.full_name.toLowerCase().includes(q)))
    .sort((a, b) => (a.students?.full_name || "").localeCompare(b.students?.full_name || ""));

  resultCount.textContent = `${rows.length} result${rows.length === 1 ? "" : "s"}`;

  if (rows.length === 0) {
    resultsBody.innerHTML = `<tr><td colspan="7"><div class="empty-state">No results match these filters.</div></td></tr>`;
    return;
  }

  resultsBody.innerHTML = rows
    .map(
      (m) => `
    <tr>
      <td>${escapeHtml(m.students ? m.students.full_name : "—")}</td>
      <td>${escapeHtml(m.classes ? m.classes.name : "—")}</td>
      <td>${escapeHtml(m.subjects ? m.subjects.name : "—")}</td>
      <td>${m.ai_score}</td>
      <td>${m.exam_score}</td>
      <td>${m.total}</td>
      <td>${escapeHtml(m.grade)}</td>
    </tr>`
    )
    .join("");
}
