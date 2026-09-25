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

// ============================================================
// INITIALISE
// ============================================================

(async () => {
  currentProfile = await requireRole("admin");

  if (!currentProfile) return;

  const whoAmI = document.getElementById("whoAmI");

  if (whoAmI) {
    whoAmI.textContent =
      `${currentProfile.full_name} · Administrator`;
  }

  await loadLookups();
  await loadStudents();
})();

// ============================================================
// LOGOUT
// ============================================================

const logoutBtn = document.getElementById("logoutBtn");

if (logoutBtn) {
  logoutBtn.addEventListener("click", logout);
}

// ============================================================
// LOAD CLASSES AND STREAMS
// ============================================================

async function loadLookups() {
  const { data: classes, error: classesError } =
    await supabaseClient
      .from("classes")
      .select("id, name")
      .eq("is_active", true)
      .order("name");

  if (classesError) {
    console.error("Classes error:", classesError);
  }

  const { data: streams, error: streamsError } =
    await supabaseClient
      .from("streams")
      .select("id, class_id, name")
      .eq("is_active", true)
      .order("name");

  if (streamsError) {
    console.error("Streams error:", streamsError);
  }

  allClasses = classes || [];
  allStreams = streams || [];

  // ----------------------------------------------------------
  // CLASS FILTER
  // ----------------------------------------------------------

  if (classFilter) {
    classFilter.innerHTML =
      `<option value="">All classes</option>` +
      allClasses
        .map(
          (c) =>
            `<option value="${c.id}">${escapeHtml(c.name)}</option>`
        )
        .join("");
  }

  // ----------------------------------------------------------
  // CLASS SELECT IN FORM
  // ----------------------------------------------------------

  if (classSelect) {
    classSelect.innerHTML = allClasses
      .map(
        (c) =>
          `<option value="${c.id}">${escapeHtml(c.name)}</option>`
      )
      .join("");
  }
}

// ============================================================
// GET STREAMS FOR CLASS
// ============================================================

function streamsForClass(classId) {
  return allStreams.filter(
    (s) => s.class_id === classId
  );
}

// ============================================================
// CLASS CHANGE
// ============================================================

if (classSelect) {
  classSelect.addEventListener("change", () => {
    const streams = streamsForClass(classSelect.value);

    if (!streamSelect) return;

    streamSelect.innerHTML =
      `<option value="">None</option>` +
      streams
        .map(
          (s) =>
            `<option value="${s.id}">${escapeHtml(s.name)}</option>`
        )
        .join("");
  });
}

// ============================================================
// LOAD STUDENTS
// ============================================================

async function loadStudents() {
  const { data, error } = await supabaseClient
    .from("students")
    .select(`
      id,
      full_name,
      gender,
      section,
      date_of_birth,
      status,
      class_id,
      stream_id,
      classes(name),
      streams(name)
    `)
    .order("full_name");

  if (error) {
    console.error("Students error:", error);

    if (alertBox) {
      alertBox.innerHTML = `
        <div class="alert error">
          Couldn't load students:
          ${escapeHtml(error.message)}
        </div>
      `;
    }

    return;
  }

  allStudents = data || [];

  renderTable();
}

// ============================================================
// APPLY FILTERS
// ============================================================

function applyFilters() {
  const q = searchInput
    ? searchInput.value.trim().toLowerCase()
    : "";

  const classId = classFilter
    ? classFilter.value
    : "";

  const status = statusFilter
    ? statusFilter.value
    : "";

  return allStudents.filter((s) => {

    // Search by full name
    if (
      q &&
      !(s.full_name || "")
        .toLowerCase()
        .includes(q)
    ) {
      return false;
    }

    // Filter by class
    if (
      classId &&
      s.class_id !== classId
    ) {
      return false;
    }

    // Filter by status
    if (
      status &&
      s.status !== status
    ) {
      return false;
    }

    return true;
  });
}

// ============================================================
// RENDER STUDENT TABLE
// ============================================================

function renderTable() {
  if (!tableBody) return;

  const rows = applyFilters();

  if (rows.length === 0) {
    tableBody.innerHTML = `
      <tr>
        <td colspan="7">
          <div class="empty-state">
            No students match. Add a student or adjust your filters.
          </div>
        </td>
      </tr>
    `;

    return;
  }

  tableBody.innerHTML = rows
    .map((s) => {

      const className =
        s.classes && s.classes.name
          ? s.classes.name
          : "—";

      const streamName =
        s.streams && s.streams.name
          ? s.streams.name
          : "";

      const fullName =
        s.full_name || "—";

      const gender =
        s.gender || "—";

      const section =
        s.section || "—";

      const dateOfBirth =
        formatDate(s.date_of_birth);

      const status =
        s.status === "active"
          ? "Active"
          : "Inactive";

      return `
        <tr>

          <!-- FULL NAME -->
          <td>
            ${escapeHtml(fullName)}
          </td>

          <!-- GENDER -->
          <td>
            ${escapeHtml(gender)}
          </td>

          <!-- SECTION -->
          <td>
            ${escapeHtml(section)}
          </td>

          <!-- DATE OF BIRTH -->
          <td>
            ${dateOfBirth}
          </td>

          <!-- CLASS -->
          <td>
            ${escapeHtml(className)}
            ${streamName ? " " + escapeHtml(streamName) : ""}
          </td>

          <!-- STATUS -->
          <td>
            <span
              class="badge ${
                s.status === "active"
                  ? "active"
                  : "inactive"
              }"
            >
              ${status}
            </span>
          </td>

          <!-- ACTIONS -->
          <td>

            <button
              class="text-link"
              data-history="${s.id}"
            >
              History
            </button>

            <button
              class="text-link"
              data-edit="${s.id}"
            >
              Edit
            </button>

            <button
              class="text-link ${
                s.status === "active"
                  ? "danger"
                  : ""
              }"
              data-toggle="${s.id}"
            >
              ${
                s.status === "active"
                  ? "Deactivate"
                  : "Activate"
              }
            </button>

          </td>

        </tr>
      `;
    })
    .join("");
}

// ============================================================
// FILTER EVENTS
// ============================================================

if (searchInput) {
  searchInput.addEventListener(
    "input",
    debounce(renderTable, 150)
  );
}

if (classFilter) {
  classFilter.addEventListener(
    "change",
    renderTable
  );
}

if (statusFilter) {
  statusFilter.addEventListener(
    "change",
    renderTable
  );
}

// ============================================================
// TABLE ACTIONS
// ============================================================

if (tableBody) {

  tableBody.addEventListener(
    "click",
    async (e) => {

      const editId =
        e.target.dataset.edit;

      const toggleId =
        e.target.dataset.toggle;

      const historyId =
        e.target.dataset.history;

      // ------------------------------------------------------
      // HISTORY
      // ------------------------------------------------------

      if (historyId) {
        window.location.href =
          `student-record.html?id=${historyId}`;

        return;
      }

      // ------------------------------------------------------
      // EDIT
      // ------------------------------------------------------

      if (editId) {

        const student =
          allStudents.find(
            (s) => s.id === editId
          );

        if (student) {
          openForm(student);
        }

        return;
      }

      // ------------------------------------------------------
      // ACTIVATE / DEACTIVATE
      // ------------------------------------------------------

      if (toggleId) {

        const student =
          allStudents.find(
            (s) => s.id === toggleId
          );

        if (!student) return;

        const newStatus =
          student.status === "active"
            ? "inactive"
            : "active";

        const { error } =
          await supabaseClient
            .from("students")
            .update({
              status: newStatus
            })
            .eq("id", toggleId);

        if (error) {

          if (alertBox) {
            alertBox.innerHTML = `
              <div class="alert error">
                ${escapeHtml(error.message)}
              </div>
            `;
          }

          return;
        }

        await loadStudents();
      }
    }
  );
}

// ============================================================
// ADD STUDENT
// ============================================================

const addBtn =
  document.getElementById("addBtn");

if (addBtn) {
  addBtn.addEventListener(
    "click",
    () => openForm(null)
  );
}

// ============================================================
// CANCEL FORM
// ============================================================

const cancelBtn =
  document.getElementById("cancelBtn");

if (cancelBtn) {
  cancelBtn.addEventListener(
    "click",
    () => dialog.close()
  );
}

// ============================================================
// OPEN STUDENT FORM
// ============================================================

function openForm(student) {

  if (!form || !dialog) return;

  if (formAlert) {
    formAlert.innerHTML = "";
  }

  form.reset();

  const formTitle =
    document.getElementById("formTitle");

  const studentId =
    document.getElementById("studentId");

  const fullName =
    document.getElementById("fullName");

  const gender =
    document.getElementById("gender");

  const section =
    document.getElementById("section");

  const dob =
    document.getElementById("dob");

  const statusRow =
    document.getElementById("statusRow");

  const isActive =
    document.getElementById("isActive");

  // ----------------------------------------------------------
  // FORM TITLE
  // ----------------------------------------------------------

  if (formTitle) {
    formTitle.textContent =
      student
        ? "Edit Student"
        : "Add Student";
  }

  // ----------------------------------------------------------
  // STUDENT ID
  // ----------------------------------------------------------

  if (studentId) {
    studentId.value =
      student
        ? student.id
        : "";
  }

  // ----------------------------------------------------------
  // FULL NAME
  // ----------------------------------------------------------

  if (fullName) {
    fullName.value =
      student
        ? student.full_name || ""
        : "";
  }

  // ----------------------------------------------------------
  // GENDER
  // ----------------------------------------------------------

  if (gender) {
    gender.value =
      student
        ? student.gender || ""
        : "";
  }

  // ----------------------------------------------------------
  // SECTION
  // ----------------------------------------------------------

  if (section) {
    section.value =
      student
        ? student.section || ""
        : "";
  }

  // ----------------------------------------------------------
  // DATE OF BIRTH
  // ----------------------------------------------------------

  if (dob) {
    dob.value =
      student
        ? student.date_of_birth || ""
        : "";
  }

  // ----------------------------------------------------------
  // CLASS
  // ----------------------------------------------------------

  if (
    allClasses.length > 0 &&
    classSelect
  ) {

    classSelect.value =
      student && student.class_id
        ? student.class_id
        : allClasses[0].id;
  }

  // ----------------------------------------------------------
  // STREAM
  // ----------------------------------------------------------

  const streams =
    streamsForClass(
      classSelect
        ? classSelect.value
        : ""
    );

  if (streamSelect) {

    streamSelect.innerHTML =
      `<option value="">None</option>` +
      streams
        .map(
          (s) =>
            `<option value="${s.id}">
              ${escapeHtml(s.name)}
            </option>`
        )
        .join("");

    streamSelect.value =
      student && student.stream_id
        ? student.stream_id
        : "";
  }

  // ----------------------------------------------------------
  // STATUS
  // ----------------------------------------------------------

  if (statusRow) {
    statusRow.style.display =
      student
        ? "flex"
        : "none";
  }

  if (isActive) {
    isActive.checked =
      student
        ? student.status === "active"
        : true;
  }

  // ----------------------------------------------------------
  // SHOW FORM
  // ----------------------------------------------------------

  dialog.showModal();
}

// ============================================================
// SAVE STUDENT
// ============================================================

if (form) {

  form.addEventListener(
    "submit",
    async (e) => {

      e.preventDefault();

      if (formAlert) {
        formAlert.innerHTML = "";
      }

      // ------------------------------------------------------
      // REQUIRE CLASS
      // ------------------------------------------------------

      if (allClasses.length === 0) {

        if (formAlert) {
          formAlert.innerHTML = `
            <div class="alert error">
              Add at least one class before adding students.
            </div>
          `;
        }

        return;
      }

      // ------------------------------------------------------
      // FORM VALUES
      // ------------------------------------------------------

      const id =
        document.getElementById("studentId").value;

      const fullName =
        document
          .getElementById("fullName")
          .value
          .trim();

      const gender =
        document.getElementById("gender").value;

      const section =
        document.getElementById("section").value;

      const dateOfBirth =
        document.getElementById("dob").value;

      // ------------------------------------------------------
      // VALIDATE FULL NAME
      // ------------------------------------------------------

      if (!fullName) {

        if (formAlert) {
          formAlert.innerHTML = `
            <div class="alert error">
              Full name is required.
            </div>
          `;
        }

        return;
      }

      // ------------------------------------------------------
      // BUILD PAYLOAD
      // ------------------------------------------------------

      const payload = {

        full_name: fullName,

        gender:
          gender || null,

        section:
          section || null,

        date_of_birth:
          dateOfBirth || null,

        class_id:
          classSelect.value,

        stream_id:
          streamSelect.value || null
      };

      // ------------------------------------------------------
      // UPDATE EXISTING STUDENT
      // ------------------------------------------------------

      if (id) {

        const isActive =
          document.getElementById("isActive");

        payload.status =
          isActive && isActive.checked
            ? "active"
            : "inactive";

        const { error } =
          await supabaseClient
            .from("students")
            .update(payload)
            .eq("id", id);

        if (error) {

          console.error(
            "Update student error:",
            error
          );

          if (formAlert) {
            formAlert.innerHTML = `
              <div class="alert error">
                ${escapeHtml(error.message)}
              </div>
            `;
          }

          return;
        }

      } else {

        // ----------------------------------------------------
        // CREATE NEW STUDENT
        // ----------------------------------------------------

        payload.school_id =
          currentProfile.school_id;

        const { error } =
          await supabaseClient
            .from("students")
            .insert(payload);

        if (error) {

          console.error(
            "Create student error:",
            error
          );

          if (formAlert) {
            formAlert.innerHTML = `
              <div class="alert error">
                ${escapeHtml(error.message)}
              </div>
            `;
          }

          return;
        }
      }

      // ------------------------------------------------------
      // CLOSE FORM AND REFRESH TABLE
      // ------------------------------------------------------

      dialog.close();

      await loadStudents();
    }
  );
}