let currentProfile = null;
let allSubjects = [];

const tableBody = document.getElementById("tableBody");
const alertBox = document.getElementById("alertBox");
const dialog = document.getElementById("formDialog");
const form = document.getElementById("subjectForm");
const formAlert = document.getElementById("formAlert");

(async () => {
  currentProfile = await requireRole("admin");
  if (!currentProfile) return;
  document.getElementById("whoAmI").textContent = `${currentProfile.full_name} · Administrator`;
  await loadSubjects();
})();

document.getElementById("logoutBtn").addEventListener("click", logout);

async function loadSubjects() {
  const { data, error } = await supabaseClient
    .from("subjects")
    .select("id, name, is_active")
    .order("name");

  if (error) {
    alertBox.innerHTML = `<div class="alert error">Couldn't load subjects: ${escapeHtml(error.message)}</div>`;
    return;
  }
  allSubjects = data;
  renderTable(allSubjects);
}

function renderTable(rows) {
  if (rows.length === 0) {
    tableBody.innerHTML = `<tr><td colspan="3"><div class="empty-state">No subjects yet. Add your first subject to get started.</div></td></tr>`;
    return;
  }
  tableBody.innerHTML = rows
    .map(
      (s) => `
    <tr>
      <td>${escapeHtml(s.name)}</td>
      <td><span class="badge ${s.is_active ? "active" : "inactive"}">${s.is_active ? "Active" : "Inactive"}</span></td>
      <td>
        <button class="text-link" data-edit="${s.id}">Edit</button>
        <button class="text-link ${s.is_active ? "danger" : ""}" data-toggle="${s.id}">${s.is_active ? "Deactivate" : "Activate"}</button>
      </td>
    </tr>`
    )
    .join("");
}

document.getElementById("searchInput").addEventListener(
  "input",
  debounce((e) => {
    const q = e.target.value.trim().toLowerCase();
    renderTable(allSubjects.filter((s) => s.name.toLowerCase().includes(q)));
  }, 150)
);

tableBody.addEventListener("click", async (e) => {
  const editId = e.target.dataset.edit;
  const toggleId = e.target.dataset.toggle;

  if (editId) {
    const subject = allSubjects.find((s) => s.id === editId);
    openForm(subject);
  }

  if (toggleId) {
    const subject = allSubjects.find((s) => s.id === toggleId);
    const { error } = await supabaseClient
      .from("subjects")
      .update({ is_active: !subject.is_active })
      .eq("id", toggleId);
    if (error) {
      alertBox.innerHTML = `<div class="alert error">${escapeHtml(error.message)}</div>`;
    } else {
      await loadSubjects();
    }
  }
});

document.getElementById("addBtn").addEventListener("click", () => openForm(null));
document.getElementById("cancelBtn").addEventListener("click", () => dialog.close());

function openForm(subject) {
  formAlert.innerHTML = "";
  form.reset();
  document.getElementById("formTitle").textContent = subject ? "Edit Subject" : "Add Subject";
  document.getElementById("subjectId").value = subject ? subject.id : "";
  document.getElementById("name").value = subject ? subject.name : "";
  document.getElementById("activeRow").style.display = subject ? "flex" : "none";
  document.getElementById("isActive").checked = subject ? subject.is_active : true;
  dialog.showModal();
}

form.addEventListener("submit", async (e) => {
  e.preventDefault();
  formAlert.innerHTML = "";

  const id = document.getElementById("subjectId").value;
  const name = document.getElementById("name").value.trim();

  if (!name) {
    formAlert.innerHTML = `<div class="alert error">Subject name is required.</div>`;
    return;
  }

  let error;
  if (id) {
    ({ error } = await supabaseClient
      .from("subjects")
      .update({ name, is_active: document.getElementById("isActive").checked })
      .eq("id", id));
  } else {
    ({ error } = await supabaseClient
      .from("subjects")
      .insert({ name, school_id: currentProfile.school_id }));
  }

  if (error) {
    formAlert.innerHTML = `<div class="alert error">${escapeHtml(
      error.code === "23505" ? "A subject with that name already exists." : error.message
    )}</div>`;
    return;
  }

  dialog.close();
  await loadSubjects();
});
