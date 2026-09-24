let currentProfile = null;

const subjectsBody = document.getElementById("subjectsBody");
const classTeacherBody = document.getElementById("classTeacherBody");
const alertBox = document.getElementById("alertBox");

(async () => {
  currentProfile = await requireRole("teacher");
  if (!currentProfile) return;
  document.getElementById("whoAmI").textContent = `${currentProfile.full_name} · Teacher`;
  await load();
})();

document.getElementById("logoutBtn").addEventListener("click", logout);

async function load() {
  const { data: sa, error: saErr } = await supabaseClient
    .from("teacher_assignments")
    .select("id, subjects(name), classes(name), streams(name), academic_years(year)")
    .eq("teacher_id", currentProfile.id)
    .order("created_at");

  if (saErr) {
    alertBox.innerHTML = `<div class="alert error">${escapeHtml(saErr.message)}</div>`;
  } else if (sa.length === 0) {
    subjectsBody.innerHTML = `<tr><td colspan="4"><div class="empty-state">No subjects assigned yet — ask your administrator to assign you.</div></td></tr>`;
  } else {
    subjectsBody.innerHTML = sa
      .map(
        (a) => `
      <tr>
        <td>${escapeHtml(a.subjects ? a.subjects.name : "—")}</td>
        <td>${escapeHtml(a.classes ? a.classes.name : "—")}</td>
        <td>${escapeHtml(a.streams ? a.streams.name : "Whole class")}</td>
        <td>${escapeHtml(a.academic_years ? a.academic_years.year : "—")}</td>
      </tr>`
      )
      .join("");
  }

  const { data: cta, error: ctaErr } = await supabaseClient
    .from("class_teacher_assignments")
    .select("id, classes(name), streams(name), academic_years(year)")
    .eq("teacher_id", currentProfile.id)
    .order("created_at");

  if (ctaErr) {
    classTeacherBody.innerHTML = `<tr><td colspan="3"><div class="empty-state">${escapeHtml(ctaErr.message)}</div></td></tr>`;
  } else if (cta.length === 0) {
    classTeacherBody.innerHTML = `<tr><td colspan="3"><div class="empty-state">You are not a class teacher for any class right now.</div></td></tr>`;
  } else {
    classTeacherBody.innerHTML = cta
      .map(
        (a) => `
      <tr>
        <td>${escapeHtml(a.classes ? a.classes.name : "—")}</td>
        <td>${escapeHtml(a.streams ? a.streams.name : "Whole class")}</td>
        <td>${escapeHtml(a.academic_years ? a.academic_years.year : "—")}</td>
      </tr>`
      )
      .join("");
  }
}
