let currentProfile = null;
let allStudents = [];
let allClasses = [];
let allStreams = [];

const tableBody = document.getElementById("tableBody");
const alertBox = document.getElementById("alertBox");
const dialog = document.getElementById("formDialog");
const form = document.getElementById("studentForm");
const formAlert = document.getElementById("formAlert");
const classSelect = document.getElementById("classSelect");
const streamSelect = document.getElementById("streamSelect");
const classFilter = document.getElementById("classFilter");
const statusFilter = document.getElementById("statusFilter");
const searchInput = document.getElementById("searchInput");

(async () => {
  currentProfile = await requireRole("admin");
  if (!currentProfile) return;
  document.getElementById("whoAmI").textContent = `${currentProfile.full_name} · Administrator`;
  await loadLookups();
  await loadStudents();
})();

document.getElementById("logoutBtn").addEventListener("click", logout);

async function loadLookups() {
  const { data: classes } = await supabaseClient
    .from("classes")
    .select("id, name")
    .eq("is_active", true)
    .order("name");
  const { data: streams } = await supabaseClient
    .from("streams")
    .select("id, class_id, name")
    .eq("is_active", true)
    .order("name");

  allClasses = classes || [];
  allStreams = streams || [];

  classFilter.innerHTML =
    `<option value="">All classes</option>` +
    allClasses.map((c) => `<option value="${c.id}">${escapeHtml(c.name)}</option>`).join("");

  classSelect.innerHTML = allClasses.map((c) => `<option value="${c.id}">${escapeHtml(c.name)}</option>`).join("");
}

function streamsForClass(classId) {
  return allStreams.filter((s) => s.class_id === classId);
}

classSelect.addEventListener("change", () => {
  const streams = streamsForClass(classSelect.value);
  streamSelect.innerHTML =
    `<option value="">None</option>` +
    streams.map((s) => `<option value="${s.id}">${escapeHtml(s.name)}</option>`).join("");
});

async function loadStudents() {
  const { data, error } = await supabaseClient
    .from("students")
    .select("id, full_name, gender, date_of_birth, status, class_id, stream_id, classes(name), streams(name)")
    .order("full_name");

  if (error) {
    alertBox.innerHTML = `<div class="alert error">Couldn't load students: ${escapeHtml(error.message)}</div>`;
    return;
  }
  allStudents = data;
  renderTable();
}

function applyFilters() {
  const q = searchInput.value.trim().toLowerCase();
  const classId = classFilter.value;
  const status = statusFilter.value;

  return allStudents.filter((s) => {
    if (q && !s.full_name.toLowerCase().includes(q)) return false;
    if (classId && s.class_id !== classId) return false;
    if (status && s.status !== status) return false;
    return true;
  });
}

function renderTable() {
  const rows = applyFilters();
  if (rows.length === 0) {
    tableBody.innerHTML = `<tr><td colspan="6"><div class="empty-state">No students match. Add a student or adjust your filters.</div></td></tr>`;
    return;
  }
  tableBody.innerHTML = rows
    .map((s) => {
      const className = s.classes ? s.classes.name : "—";
      const streamName = s.streams ? s.streams.name : "";
      return `
    <tr>
      <td>${escapeHtml(s.full_name)}</td>
      <td>${escapeHtml(s.gender || "—")}</td>
      <td>${formatDate(s.date_of_birth)}</td>
      <td>${escapeHtml(className)}${streamName ? " " + escapeHtml(streamName) : ""}</td>
      <td><span class="badge ${s.status === "active" ? "active" : "inactive"}">${s.status === "active" ? "Active" : "Inactive"}</span></td>
      <td>
        <button class="text-link" data-history="${s.id}">History</button>
        <button class="text-link" data-edit="${s.id}">Edit</button>
        <button class="text-link ${s.status === "active" ? "danger" : ""}" data-toggle="${s.id}">${s.status === "active" ? "Deactivate" : "Activate"}</button>
      </td>
    </tr>`;
    })
    .join("");
}

searchInput.addEventListener("input", debounce(renderTable, 150));
classFilter.addEventListener("change", renderTable);
statusFilter.addEventListener("change", renderTable);

tableBody.addEventListener("click", async (e) => {
  const editId = e.target.dataset.edit;
  const toggleId = e.target.dataset.toggle;
  const historyId = e.target.dataset.history;

  if (historyId) {
    window.location.href = `student-record.html?id=${historyId}`;
    return;
  }

  if (editId) openForm(allStudents.find((s) => s.id === editId));

  if (toggleId) {
    const student = allStudents.find((s) => s.id === toggleId);
    const newStatus = student.status === "active" ? "inactive" : "active";
    const { error } = await supabaseClient.from("students").update({ status: newStatus }).eq("id", toggleId);
    if (error) alertBox.innerHTML = `<div class="alert error">${escapeHtml(error.message)}</div>`;
    else await loadStudents();
  }
});

document.getElementById("addBtn").addEventListener("click", () => openForm(null));
document.getElementById("cancelBtn").addEventListener("click", () => dialog.close());

function openForm(student) {
  formAlert.innerHTML = "";
  form.reset();
  document.getElementById("formTitle").textContent = student ? "Edit Student" : "Add Student";
  document.getElementById("studentId").value = student ? student.id : "";
  document.getElementById("fullName").value = student ? student.full_name : "";
  document.getElementById("gender").value = student ? student.gender || "" : "";
  document.getElementById("dob").value = student ? student.date_of_birth || "" : "";

  if (allClasses.length > 0) {
    classSelect.value = student ? student.class_id : allClasses[0].id;
  }
  const streams = streamsForClass(classSelect.value);
  streamSelect.innerHTML =
    `<option value="">None</option>` +
    streams.map((s) => `<option value="${s.id}">${escapeHtml(s.name)}</option>`).join("");
  streamSelect.value = student && student.stream_id ? student.stream_id : "";

  document.getElementById("statusRow").style.display = student ? "flex" : "none";
  document.getElementById("isActive").checked = student ? student.status === "active" : true;

  dialog.showModal();
}

form.addEventListener("submit", async (e) => {
  e.preventDefault();
  formAlert.innerHTML = "";

  if (allClasses.length === 0) {
    formAlert.innerHTML = `<div class="alert error">Add at least one class before adding students.</div>`;
    return;
  }

  const id = document.getElementById("studentId").value;
  const payload = {
    full_name: document.getElementById("fullName").value.trim(),
    gender: document.getElementById("gender").value || null,
    date_of_birth: document.getElementById("dob").value || null,
    class_id: classSelect.value,
    stream_id: streamSelect.value || null,
  };

  if (!payload.full_name) {
    formAlert.innerHTML = `<div class="alert error">Full name is required.</div>`;
    return;
  }

  let error;
  if (id) {
    payload.status = document.getElementById("isActive").checked ? "active" : "inactive";
    ({ error } = await supabaseClient.from("students").update(payload).eq("id", id));
  } else {
    payload.school_id = currentProfile.school_id;
    ({ error } = await supabaseClient.from("students").insert(payload));
  }

  if (error) {
    formAlert.innerHTML = `<div class="alert error">${escapeHtml(error.message)}</div>`;
    return;
  }
  dialog.close();
  await loadStudents();
});
