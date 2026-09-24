let currentProfile = null;
let years = [], teachers = [], subjects = [], classes = [], streams = [];
let subjectAssignments = [], classTeacherAssignments = [];

const alertBox = document.getElementById("alertBox");
const yearSelect = document.getElementById("yearSelect");

const saTeacher = document.getElementById("saTeacher");
const saSubject = document.getElementById("saSubject");
const saClass = document.getElementById("saClass");
const saStream = document.getElementById("saStream");
const subjectAssignBody = document.getElementById("subjectAssignBody");

const ctTeacher = document.getElementById("ctTeacher");
const ctClass = document.getElementById("ctClass");
const ctStream = document.getElementById("ctStream");
const classTeacherBody = document.getElementById("classTeacherBody");

(async () => {
  currentProfile = await requireRole("admin");
  if (!currentProfile) return;
  document.getElementById("whoAmI").textContent = `${currentProfile.full_name} · Administrator`;
  await loadLookups();
  if (years.length === 0) {
    alertBox.innerHTML = `<div class="alert error">Add an academic year on the Terms page before creating assignments.</div>`;
    return;
  }
  await loadAssignments();
})();

document.getElementById("logoutBtn").addEventListener("click", logout);

async function loadLookups() {
  const [{ data: y }, { data: t }, { data: s }, { data: c }, { data: st }] = await Promise.all([
    supabaseClient.from("academic_years").select("id, year, is_current").order("year", { ascending: false }),
    supabaseClient.from("profiles").select("id, full_name").eq("role", "teacher").eq("is_active", true).order("full_name"),
    supabaseClient.from("subjects").select("id, name").eq("is_active", true).order("name"),
    supabaseClient.from("classes").select("id, name").eq("is_active", true).order("name"),
    supabaseClient.from("streams").select("id, class_id, name").eq("is_active", true).order("name"),
  ]);

  years = y || []; teachers = t || []; subjects = s || []; classes = c || []; streams = st || [];

  yearSelect.innerHTML = years.map((yr) => `<option value="${yr.id}">${escapeHtml(yr.year)}${yr.is_current ? " (current)" : ""}</option>`).join("");
  const current = years.find((yr) => yr.is_current);
  if (current) yearSelect.value = current.id;

  const teacherOpts = teachers.map((t) => `<option value="${t.id}">${escapeHtml(t.full_name)}</option>`).join("");
  saTeacher.innerHTML = teacherOpts;
  ctTeacher.innerHTML = teacherOpts;

  saSubject.innerHTML = subjects.map((s) => `<option value="${s.id}">${escapeHtml(s.name)}</option>`).join("");

  const classOpts = classes.map((c) => `<option value="${c.id}">${escapeHtml(c.name)}</option>`).join("");
  saClass.innerHTML = classOpts;
  ctClass.innerHTML = classOpts;

  updateStreamOptions(saClass, saStream);
  updateStreamOptions(ctClass, ctStream);
}

function updateStreamOptions(classSel, streamSel) {
  const opts = streams.filter((s) => s.class_id === classSel.value);
  streamSel.innerHTML = `<option value="">Whole class</option>` + opts.map((s) => `<option value="${s.id}">${escapeHtml(s.name)}</option>`).join("");
}
saClass.addEventListener("change", () => updateStreamOptions(saClass, saStream));
ctClass.addEventListener("change", () => updateStreamOptions(ctClass, ctStream));

yearSelect.addEventListener("change", loadAssignments);

function classAndStreamName(classId, streamId) {
  const c = classes.find((x) => x.id === classId);
  const s = streams.find((x) => x.id === streamId);
  return { className: c ? c.name : "—", streamName: s ? s.name : "" };
}

async function loadAssignments() {
  const yearId = yearSelect.value;

  const { data: sa, error: saErr } = await supabaseClient
    .from("teacher_assignments")
    .select("id, teacher_id, subject_id, class_id, stream_id, profiles(full_name), subjects(name)")
    .eq("academic_year_id", yearId);

  if (saErr) {
    subjectAssignBody.innerHTML = `<tr><td colspan="5"><div class="empty-state">${escapeHtml(saErr.message)}</div></td></tr>`;
  } else {
    subjectAssignments = sa;
    renderSubjectAssignments();
  }

  const { data: cta, error: ctaErr } = await supabaseClient
    .from("class_teacher_assignments")
    .select("id, teacher_id, class_id, stream_id, profiles(full_name)")
    .eq("academic_year_id", yearId);

  if (ctaErr) {
    classTeacherBody.innerHTML = `<tr><td colspan="4"><div class="empty-state">${escapeHtml(ctaErr.message)}</div></td></tr>`;
  } else {
    classTeacherAssignments = cta;
    renderClassTeacherAssignments();
  }
}

function renderSubjectAssignments() {
  if (subjectAssignments.length === 0) {
    subjectAssignBody.innerHTML = `<tr><td colspan="5"><div class="empty-state">No subject assignments yet for this year.</div></td></tr>`;
    return;
  }
  subjectAssignBody.innerHTML = subjectAssignments
    .map((a) => {
      const { className, streamName } = classAndStreamName(a.class_id, a.stream_id);
      return `
      <tr>
        <td>${escapeHtml(a.profiles ? a.profiles.full_name : "—")}</td>
        <td>${escapeHtml(a.subjects ? a.subjects.name : "—")}</td>
        <td>${escapeHtml(className)}</td>
        <td>${escapeHtml(streamName || "Whole class")}</td>
        <td><button class="text-link danger" data-remove-sa="${a.id}">Remove</button></td>
      </tr>`;
    })
    .join("");
}

function renderClassTeacherAssignments() {
  if (classTeacherAssignments.length === 0) {
    classTeacherBody.innerHTML = `<tr><td colspan="4"><div class="empty-state">No class teacher assignments yet for this year.</div></td></tr>`;
    return;
  }
  classTeacherBody.innerHTML = classTeacherAssignments
    .map((a) => {
      const { className, streamName } = classAndStreamName(a.class_id, a.stream_id);
      return `
      <tr>
        <td>${escapeHtml(a.profiles ? a.profiles.full_name : "—")}</td>
        <td>${escapeHtml(className)}</td>
        <td>${escapeHtml(streamName || "Whole class")}</td>
        <td><button class="text-link danger" data-remove-cta="${a.id}">Remove</button></td>
      </tr>`;
    })
    .join("");
}

subjectAssignBody.addEventListener("click", async (e) => {
  const id = e.target.dataset.removeSa;
  if (!id) return;
  const { error } = await supabaseClient.from("teacher_assignments").delete().eq("id", id);
  if (error) alertBox.innerHTML = `<div class="alert error">${escapeHtml(error.message)}</div>`;
  else await loadAssignments();
});

classTeacherBody.addEventListener("click", async (e) => {
  const id = e.target.dataset.removeCta;
  if (!id) return;
  const { error } = await supabaseClient.from("class_teacher_assignments").delete().eq("id", id);
  if (error) alertBox.innerHTML = `<div class="alert error">${escapeHtml(error.message)}</div>`;
  else await loadAssignments();
});

document.getElementById("subjectAssignForm").addEventListener("submit", async (e) => {
  e.preventDefault();
  alertBox.innerHTML = "";
  const { error } = await supabaseClient.from("teacher_assignments").insert({
    school_id: currentProfile.school_id,
    teacher_id: saTeacher.value,
    subject_id: saSubject.value,
    class_id: saClass.value,
    stream_id: saStream.value || null,
    academic_year_id: yearSelect.value,
  });
  if (error) {
    alertBox.innerHTML = `<div class="alert error">${escapeHtml(
      error.code === "23505" ? "That teacher is already assigned to this subject/class." : error.message
    )}</div>`;
    return;
  }
  await loadAssignments();
});

document.getElementById("classTeacherForm").addEventListener("submit", async (e) => {
  e.preventDefault();
  alertBox.innerHTML = "";
  const { error } = await supabaseClient.from("class_teacher_assignments").insert({
    school_id: currentProfile.school_id,
    teacher_id: ctTeacher.value,
    class_id: ctClass.value,
    stream_id: ctStream.value || null,
    academic_year_id: yearSelect.value,
  });
  if (error) {
    alertBox.innerHTML = `<div class="alert error">${escapeHtml(
      error.code === "23505" ? "This class already has a class teacher for this year." : error.message
    )}</div>`;
    return;
  }
  await loadAssignments();
});
