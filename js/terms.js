let currentProfile = null;
let allYears = [];
let currentYearId = null;
let currentTerms = [];

const tableBody = document.getElementById("tableBody");
const alertBox = document.getElementById("alertBox");

const yearDialog = document.getElementById("yearDialog");
const yearForm = document.getElementById("yearForm");
const yearAlert = document.getElementById("yearAlert");

const termsDialog = document.getElementById("termsDialog");
const termsBody = document.getElementById("termsBody");
const termsAlert = document.getElementById("termsAlert");
const termForm = document.getElementById("termForm");

(async () => {
  currentProfile = await requireRole("admin");
  if (!currentProfile) return;
  document.getElementById("whoAmI").textContent = `${currentProfile.full_name} · Administrator`;
  await loadYears();
})();

document.getElementById("logoutBtn").addEventListener("click", logout);

async function loadYears() {
  const { data: years, error } = await supabaseClient
    .from("academic_years")
    .select("id, year, is_current")
    .order("year", { ascending: false });

  if (error) {
    alertBox.innerHTML = `<div class="alert error">Couldn't load academic years: ${escapeHtml(error.message)}</div>`;
    return;
  }

  const { data: terms } = await supabaseClient.from("terms").select("id, academic_year_id");

  allYears = years.map((y) => ({
    ...y,
    termCount: (terms || []).filter((t) => t.academic_year_id === y.id).length,
  }));

  renderTable();
}

function renderTable() {
  if (allYears.length === 0) {
    tableBody.innerHTML = `<tr><td colspan="4"><div class="empty-state">No academic years yet. Add one (e.g. 2026) to get started.</div></td></tr>`;
    return;
  }
  tableBody.innerHTML = allYears
    .map(
      (y) => `
    <tr>
      <td>${escapeHtml(y.year)}</td>
      <td>${y.is_current ? '<span class="badge active">Current</span>' : `<button class="text-link" data-set-current="${y.id}">Set as current</button>`}</td>
      <td>${y.termCount} term${y.termCount === 1 ? "" : "s"}</td>
      <td><button class="text-link" data-terms="${y.id}">Manage terms</button></td>
    </tr>`
    )
    .join("");
}

tableBody.addEventListener("click", async (e) => {
  const setCurrentId = e.target.dataset.setCurrent;
  const termsId = e.target.dataset.terms;

  if (setCurrentId) {
    // Only one academic year can be current at a time.
    await supabaseClient.from("academic_years").update({ is_current: false }).eq("school_id", currentProfile.school_id);
    const { error } = await supabaseClient.from("academic_years").update({ is_current: true }).eq("id", setCurrentId);
    if (error) alertBox.innerHTML = `<div class="alert error">${escapeHtml(error.message)}</div>`;
    else await loadYears();
  }

  if (termsId) openTerms(termsId);
});

document.getElementById("addYearBtn").addEventListener("click", () => {
  yearAlert.innerHTML = "";
  yearForm.reset();
  yearDialog.showModal();
});
document.getElementById("cancelYearBtn").addEventListener("click", () => yearDialog.close());

yearForm.addEventListener("submit", async (e) => {
  e.preventDefault();
  yearAlert.innerHTML = "";
  const year = document.getElementById("yearInput").value.trim();
  if (!year) return;

  const { error } = await supabaseClient.from("academic_years").insert({ year, school_id: currentProfile.school_id });
  if (error) {
    yearAlert.innerHTML = `<div class="alert error">${escapeHtml(
      error.code === "23505" ? "That academic year already exists." : error.message
    )}</div>`;
    return;
  }
  yearDialog.close();
  await loadYears();
});

// ---- Terms ----

async function openTerms(yearId) {
  currentYearId = yearId;
  const year = allYears.find((y) => y.id === yearId);
  document.getElementById("termsTitle").textContent = `Terms — ${year.year}`;
  termsAlert.innerHTML = "";
  termForm.reset();
  await loadTerms();
  termsDialog.showModal();
}

async function loadTerms() {
  const { data, error } = await supabaseClient
    .from("terms")
    .select("id, name, is_current")
    .eq("academic_year_id", currentYearId)
    .order("name");

  if (error) {
    termsAlert.innerHTML = `<div class="alert error">${escapeHtml(error.message)}</div>`;
    return;
  }
  currentTerms = data;
  renderTerms();
}

function renderTerms() {
  if (currentTerms.length === 0) {
    termsBody.innerHTML = `<tr><td colspan="3"><div class="empty-state">No terms yet for this year.</div></td></tr>`;
    return;
  }
  termsBody.innerHTML = currentTerms
    .map(
      (t) => `
    <tr>
      <td>${escapeHtml(t.name)}</td>
      <td>${t.is_current ? '<span class="badge active">Current</span>' : `<button class="text-link" data-term-current="${t.id}">Set as current</button>`}</td>
      <td></td>
    </tr>`
    )
    .join("");
}

termsBody.addEventListener("click", async (e) => {
  const id = e.target.dataset.termCurrent;
  if (!id) return;
  await supabaseClient.from("terms").update({ is_current: false }).eq("academic_year_id", currentYearId);
  const { error } = await supabaseClient.from("terms").update({ is_current: true }).eq("id", id);
  if (error) termsAlert.innerHTML = `<div class="alert error">${escapeHtml(error.message)}</div>`;
  else await loadTerms();
});

termForm.addEventListener("submit", async (e) => {
  e.preventDefault();
  termsAlert.innerHTML = "";
  const name = document.getElementById("termName").value.trim();
  if (!name) return;

  const { error } = await supabaseClient.from("terms").insert({
    name,
    academic_year_id: currentYearId,
    school_id: currentProfile.school_id,
  });

  if (error) {
    termsAlert.innerHTML = `<div class="alert error">${escapeHtml(
      error.code === "23505" ? "That term already exists for this year." : error.message
    )}</div>`;
    return;
  }
  termForm.reset();
  await loadTerms();
  await loadYears();
});

document.getElementById("closeTermsBtn").addEventListener("click", async () => {
  termsDialog.close();
  await loadYears();
});
