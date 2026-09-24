let currentProfile = null;
let allTeachers = [];

const tableBody = document.getElementById("tableBody");
const alertBox = document.getElementById("alertBox");
const searchInput = document.getElementById("searchInput");

const addDialog = document.getElementById("addDialog");
const addForm = document.getElementById("addForm");
const addAlert = document.getElementById("addAlert");
const addSubmitBtn = document.getElementById("addSubmitBtn");

const passwordDialog = document.getElementById("passwordDialog");

const editDialog = document.getElementById("editDialog");
const editForm = document.getElementById("editForm");
const editAlert = document.getElementById("editAlert");

(async () => {
  currentProfile = await requireRole("admin");
  if (!currentProfile) return;
  document.getElementById("whoAmI").textContent = `${currentProfile.full_name} · Administrator`;
  await loadTeachers();
})();

document.getElementById("logoutBtn").addEventListener("click", logout);

async function loadTeachers() {
  const { data, error } = await supabaseClient
    .from("profiles")
    .select("id, full_name, email, is_active")
    .eq("role", "teacher")
    .order("full_name");

  if (error) {
    alertBox.innerHTML = `<div class="alert error">Couldn't load teachers: ${escapeHtml(error.message)}</div>`;
    return;
  }
  allTeachers = data;
  renderTable();
}

function renderTable() {
  const q = searchInput.value.trim().toLowerCase();
  const rows = allTeachers.filter((t) => !q || t.full_name.toLowerCase().includes(q));

  if (rows.length === 0) {
    tableBody.innerHTML = `<tr><td colspan="4"><div class="empty-state">No teachers yet. Add your first teacher to get started.</div></td></tr>`;
    return;
  }
  tableBody.innerHTML = rows
    .map(
      (t) => `
    <tr>
      <td>${escapeHtml(t.full_name)}</td>
      <td>${escapeHtml(t.email || "—")}</td>
      <td><span class="badge ${t.is_active ? "active" : "inactive"}">${t.is_active ? "Active" : "Inactive"}</span></td>
      <td>
        <button class="text-link" data-edit="${t.id}">Edit</button>
        <button class="text-link ${t.is_active ? "danger" : ""}" data-toggle="${t.id}">${t.is_active ? "Deactivate" : "Activate"}</button>
      </td>
    </tr>`
    )
    .join("");
}

searchInput.addEventListener("input", debounce(renderTable, 150));

tableBody.addEventListener("click", async (e) => {
  const editId = e.target.dataset.edit;
  const toggleId = e.target.dataset.toggle;

  if (editId) {
    const t = allTeachers.find((x) => x.id === editId);
    editAlert.innerHTML = "";
    document.getElementById("editId").value = t.id;
    document.getElementById("editName").value = t.full_name;
    editDialog.showModal();
  }

  if (toggleId) {
    const t = allTeachers.find((x) => x.id === toggleId);
    const { error } = await supabaseClient.from("profiles").update({ is_active: !t.is_active }).eq("id", toggleId);
    if (error) alertBox.innerHTML = `<div class="alert error">${escapeHtml(error.message)}</div>`;
    else await loadTeachers();
  }
});

document.getElementById("addBtn").addEventListener("click", () => {
  addAlert.innerHTML = "";
  addForm.reset();
  addDialog.showModal();
});
document.getElementById("cancelAddBtn").addEventListener("click", () => addDialog.close());
document.getElementById("cancelEditBtn").addEventListener("click", () => editDialog.close());

addForm.addEventListener("submit", async (e) => {
  e.preventDefault();
  addAlert.innerHTML = "";
  addSubmitBtn.disabled = true;
  addSubmitBtn.textContent = "Creating…";

  const full_name = document.getElementById("newName").value.trim();
  const email = document.getElementById("newEmail").value.trim();

  try {
    const {
      data: { session },
    } = await supabaseClient.auth.getSession();

    const res = await fetch(`${SUPABASE_URL}/functions/v1/create-teacher`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${session.access_token}`,
      },
      body: JSON.stringify({ email, full_name }),
    });

    const result = await res.json();

    if (!res.ok) {
      addAlert.innerHTML = `<div class="alert error">${escapeHtml(result.error || "Couldn't create the teacher account.")}</div>`;
      return;
    }

    addDialog.close();
    document.getElementById("pwName").textContent = full_name;
    document.getElementById("pwEmail").value = result.email;
    document.getElementById("pwValue").value = result.temporary_password;
    passwordDialog.showModal();
    await loadTeachers();
  } catch (err) {
    addAlert.innerHTML = `<div class="alert error">Couldn't reach the account service. Is the create-teacher Edge Function deployed?</div>`;
  } finally {
    addSubmitBtn.disabled = false;
    addSubmitBtn.textContent = "Create login";
  }
});

document.getElementById("closePwBtn").addEventListener("click", () => passwordDialog.close());

editForm.addEventListener("submit", async (e) => {
  e.preventDefault();
  editAlert.innerHTML = "";
  const id = document.getElementById("editId").value;
  const full_name = document.getElementById("editName").value.trim();
  if (!full_name) {
    editAlert.innerHTML = `<div class="alert error">Name is required.</div>`;
    return;
  }
  const { error } = await supabaseClient.from("profiles").update({ full_name }).eq("id", id);
  if (error) {
    editAlert.innerHTML = `<div class="alert error">${escapeHtml(error.message)}</div>`;
    return;
  }
  editDialog.close();
  await loadTeachers();
});
