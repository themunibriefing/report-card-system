let currentProfile = null;
let school = null;

const alertBox = document.getElementById("alertBox");
const form = document.getElementById("settingsForm");

(async () => {
  currentProfile = await requireRole("admin");
  if (!currentProfile) return;
  document.getElementById("whoAmI").textContent = `${currentProfile.full_name} · Administrator`;
  await load();
})();

document.getElementById("logoutBtn").addEventListener("click", logout);

async function load() {
  const { data, error } = await supabaseClient
    .from("schools")
    .select("*")
    .eq("id", currentProfile.school_id)
    .single();

  if (error) {
    alertBox.innerHTML = `<div class="alert error">${escapeHtml(error.message)}</div>`;
    return;
  }

  school = data;
  document.getElementById("schoolName").value = school.name || "";
  document.getElementById("motto").value = school.motto || "";
  document.getElementById("address").value = school.address || "";
  document.getElementById("phone").value = school.phone || "";
  document.getElementById("email").value = school.email || "";
  document.getElementById("headTeacherName").value = school.head_teacher_name || "";

  renderPreview("logoPreviewWrap", school.logo_url, "School logo");
  renderPreview("signaturePreviewWrap", school.signature_url, "Head teacher's signature");
}

function renderPreview(containerId, url, alt) {
  const el = document.getElementById(containerId);
  el.innerHTML = url
    ? `<img src="${escapeHtml(url)}" alt="${escapeHtml(alt)}" style="max-height:80px;max-width:220px;border:1px solid var(--border);border-radius:4px;padding:6px;background:#fff;" />`
    : `<p style="font-size:0.85rem;color:var(--ink-soft);">Not uploaded yet.</p>`;
}

form.addEventListener("submit", async (e) => {
  e.preventDefault();
  alertBox.innerHTML = "";

  const { error } = await supabaseClient
    .from("schools")
    .update({
      name: document.getElementById("schoolName").value.trim(),
      motto: document.getElementById("motto").value.trim() || null,
      address: document.getElementById("address").value.trim() || null,
      phone: document.getElementById("phone").value.trim() || null,
      email: document.getElementById("email").value.trim() || null,
      head_teacher_name: document.getElementById("headTeacherName").value.trim() || null,
    })
    .eq("id", currentProfile.school_id);

  if (error) {
    alertBox.innerHTML = `<div class="alert error">${escapeHtml(error.message)}</div>`;
    return;
  }
  alertBox.innerHTML = `<div class="alert success">School details saved.</div>`;
});

async function uploadAsset(file, kind, statusEl, previewContainerId, columnName) {
  statusEl.textContent = "Uploading…";
  const ext = file.name.split(".").pop();
  const path = `${currentProfile.school_id}/${kind}.${ext}`;

  const { error: uploadError } = await supabaseClient.storage
    .from("school-assets")
    .upload(path, file, { upsert: true, cacheControl: "3600" });

  if (uploadError) {
    statusEl.textContent = `Couldn't upload: ${uploadError.message}`;
    return;
  }

  const { data: pub } = supabaseClient.storage.from("school-assets").getPublicUrl(path);
  // Cache-bust so a re-uploaded file shows immediately, not a stale cached copy.
  const publicUrl = `${pub.publicUrl}?t=${Date.now()}`;

  const { error: updateError } = await supabaseClient
    .from("schools")
    .update({ [columnName]: publicUrl })
    .eq("id", currentProfile.school_id);

  if (updateError) {
    statusEl.textContent = `Uploaded, but couldn't save the link: ${updateError.message}`;
    return;
  }

  statusEl.textContent = "Uploaded.";
  renderPreview(previewContainerId, publicUrl, kind);
}

document.getElementById("logoInput").addEventListener("change", (e) => {
  const file = e.target.files[0];
  if (file) uploadAsset(file, "logo", document.getElementById("logoStatus"), "logoPreviewWrap", "logo_url");
});

document.getElementById("signatureInput").addEventListener("change", (e) => {
  const file = e.target.files[0];
  if (file) uploadAsset(file, "signature", document.getElementById("signatureStatus"), "signaturePreviewWrap", "signature_url");
});
