let currentProfile = null;
let allClasses = [];
let currentStreamClassId = null;
let currentStreams = [];

const tableBody = document.getElementById("tableBody");
const alertBox = document.getElementById("alertBox");
const dialog = document.getElementById("formDialog");
const form = document.getElementById("classForm");
const formAlert = document.getElementById("formAlert");

const streamsDialog = document.getElementById("streamsDialog");
const streamsBody = document.getElementById("streamsBody");
const streamsAlert = document.getElementById("streamsAlert");
const streamForm = document.getElementById("streamForm");

(async () => {
  currentProfile = await requireRole("admin");
  if (!currentProfile) return;
  document.getElementById("whoAmI").textContent = `${currentProfile.full_name} · Administrator`;
  await loadClasses();
})();

document.getElementById("logoutBtn").addEventListener("click", logout);

async function loadClasses() {
  const { data: classes, error } = await supabaseClient
    .from("classes")
    .select("id, name, is_active")
    .order("name");

  if (error) {
    alertBox.innerHTML = `<div class="alert error">Couldn't load classes: ${escapeHtml(error.message)}</div>`;
    return;
  }

  const { data: streams } = await supabaseClient.from("streams").select("id, class_id, is_active");

  allClasses = classes.map((c) => ({
    ...c,
    streamCount: (streams || []).filter((s) => s.class_id === c.id && s.is_active).length,
  }));

  renderTable();
}

function renderTable() {
  if (allClasses.length === 0) {
    tableBody.innerHTML = `<tr><td colspan="4"><div class="empty-state">No classes yet. Add your first class (e.g. S1) to get started.</div></td></tr>`;
    return;
  }
  tableBody.innerHTML = allClasses
    .map(
      (c) => `
    <tr>
      <td>${escapeHtml(c.name)}</td>
      <td>${c.streamCount} stream${c.streamCount === 1 ? "" : "s"}</td>
      <td><span class="badge ${c.is_active ? "active" : "inactive"}">${c.is_active ? "Active" : "Inactive"}</span></td>
      <td>
        <button class="text-link" data-streams="${c.id}">Streams</button>
        <button class="text-link" data-edit="${c.id}">Edit</button>
        <button class="text-link ${c.is_active ? "danger" : ""}" data-toggle="${c.id}">${c.is_active ? "Deactivate" : "Activate"}</button>
      </td>
    </tr>`
    )
    .join("");
}

tableBody.addEventListener("click", async (e) => {
  const editId = e.target.dataset.edit;
  const toggleId = e.target.dataset.toggle;
  const streamsId = e.target.dataset.streams;

  if (editId) openForm(allClasses.find((c) => c.id === editId));

  if (toggleId) {
    const cls = allClasses.find((c) => c.id === toggleId);
    const { error } = await supabaseClient.from("classes").update({ is_active: !cls.is_active }).eq("id", toggleId);
    if (error) alertBox.innerHTML = `<div class="alert error">${escapeHtml(error.message)}</div>`;
    else await loadClasses();
  }

  if (streamsId) openStreams(streamsId);
});

document.getElementById("addBtn").addEventListener("click", () => openForm(null));
document.getElementById("cancelBtn").addEventListener("click", () => dialog.close());

function openForm(cls) {
  formAlert.innerHTML = "";
  form.reset();
  document.getElementById("formTitle").textContent = cls ? "Edit Class" : "Add Class";
  document.getElementById("classId").value = cls ? cls.id : "";
  document.getElementById("name").value = cls ? cls.name : "";
  document.getElementById("activeRow").style.display = cls ? "flex" : "none";
  document.getElementById("isActive").checked = cls ? cls.is_active : true;
  dialog.showModal();
}

form.addEventListener("submit", async (e) => {
  e.preventDefault();
  formAlert.innerHTML = "";
  const id = document.getElementById("classId").value;
  const name = document.getElementById("name").value.trim();
  if (!name) {
    formAlert.innerHTML = `<div class="alert error">Class name is required.</div>`;
    return;
  }

  let error;
  if (id) {
    ({ error } = await supabaseClient
      .from("classes")
      .update({ name, is_active: document.getElementById("isActive").checked })
      .eq("id", id));
  } else {
    ({ error } = await supabaseClient.from("classes").insert({ name, school_id: currentProfile.school_id }));
  }

  if (error) {
    formAlert.innerHTML = `<div class="alert error">${escapeHtml(
      error.code === "23505" ? "A class with that name already exists." : error.message
    )}</div>`;
    return;
  }
  dialog.close();
  await loadClasses();
});

// ---- Streams ----

async function openStreams(classId) {
  currentStreamClassId = classId;
  const cls = allClasses.find((c) => c.id === classId);
  document.getElementById("streamsTitle").textContent = `Streams — ${cls.name}`;
  streamsAlert.innerHTML = "";
  streamForm.reset();
  await loadStreams();
  streamsDialog.showModal();
}

async function loadStreams() {
  const { data, error } = await supabaseClient
    .from("streams")
    .select("id, name, is_active")
    .eq("class_id", currentStreamClassId)
    .order("name");

  if (error) {
    streamsAlert.innerHTML = `<div class="alert error">${escapeHtml(error.message)}</div>`;
    return;
  }
  currentStreams = data;
  renderStreams();
}

function renderStreams() {
  if (currentStreams.length === 0) {
    streamsBody.innerHTML = `<tr><td colspan="3"><div class="empty-state">No streams yet — that's fine, this class can be used without one.</div></td></tr>`;
    return;
  }
  streamsBody.innerHTML = currentStreams
    .map(
      (s) => `
    <tr>
      <td>${escapeHtml(s.name)}</td>
      <td><span class="badge ${s.is_active ? "active" : "inactive"}">${s.is_active ? "Active" : "Inactive"}</span></td>
      <td><button class="text-link ${s.is_active ? "danger" : ""}" data-stream-toggle="${s.id}">${s.is_active ? "Deactivate" : "Activate"}</button></td>
    </tr>`
    )
    .join("");
}

streamsBody.addEventListener("click", async (e) => {
  const toggleId = e.target.dataset.streamToggle;
  if (!toggleId) return;
  const stream = currentStreams.find((s) => s.id === toggleId);
  const { error } = await supabaseClient.from("streams").update({ is_active: !stream.is_active }).eq("id", toggleId);
  if (error) streamsAlert.innerHTML = `<div class="alert error">${escapeHtml(error.message)}</div>`;
  else await loadStreams();
});

streamForm.addEventListener("submit", async (e) => {
  e.preventDefault();
  streamsAlert.innerHTML = "";
  const name = document.getElementById("streamName").value.trim();
  if (!name) return;

  const { error } = await supabaseClient.from("streams").insert({
    name,
    class_id: currentStreamClassId,
    school_id: currentProfile.school_id,
  });

  if (error) {
    streamsAlert.innerHTML = `<div class="alert error">${escapeHtml(
      error.code === "23505" ? "That stream already exists on this class." : error.message
    )}</div>`;
    return;
  }
  streamForm.reset();
  await loadStreams();
  await loadClasses();
});

document.getElementById("closeStreamsBtn").addEventListener("click", async () => {
  streamsDialog.close();
  await loadClasses();
});
