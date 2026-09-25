// ============================================================
// REPORT CARD
// ============================================================

let currentProfile = null;
let studentId = null;
let yearId = null;
let termId = null;
let studentRow = null;

// ------------------------------------------------------------
// DOM ELEMENTS
// ------------------------------------------------------------

const alertBox = document.getElementById("alertBox");
const reportCard = document.getElementById("reportCard");

// ------------------------------------------------------------
// INITIALISE REPORT CARD
// ------------------------------------------------------------

async function initReportCard() {
  try {
    const {
      data: { session },
      error: sessionError
    } = await supabaseClient.auth.getSession();

    if (sessionError) {
      console.error("Session error:", sessionError);
      window.location.href = "../login.html";
      return;
    }

    if (!session) {
      window.location.href = "../login.html";
      return;
    }

    currentProfile = await fetchOwnProfile();

    if (!currentProfile) {
      window.location.href = "../login.html";
      return;
    }

    // --------------------------------------------------------
    // BACK BUTTON
    // --------------------------------------------------------

    const backLink = document.getElementById("backLink");

    if (backLink) {
      if (currentProfile.role === "admin") {
        backLink.href = "../admin/reports.html";
      } else {
        backLink.href = "../teacher/dashboard.html";
      }
    }

    // --------------------------------------------------------
    // READ URL PARAMETERS
    // --------------------------------------------------------

    const params = new URLSearchParams(window.location.search);

    studentId = params.get("student");
    yearId = params.get("year");
    termId = params.get("term");

    if (!studentId || !yearId || !termId) {
      showAlert(
        "Missing student, academic year, or term in the report-card link.",
        "error"
      );
      return;
    }

    await loadReportCard();

  } catch (error) {
    console.error("Report card initialisation error:", error);

    showAlert(
      "An unexpected error occurred while opening the report card.",
      "error"
    );
  }
}

// ------------------------------------------------------------
// LOAD REPORT CARD
// ------------------------------------------------------------

async function loadReportCard() {
  try {

    // ========================================================
    // LOAD SCHOOL
    // ========================================================

    const schoolResult = await supabaseClient
      .from("schools")
      .select("*")
      .eq("id", currentProfile.school_id)
      .single();

    // ========================================================
    // LOAD STUDENT
    // ========================================================

    const studentResult = await supabaseClient
      .from("students")
      .select(`
        id,
        full_name,
        gender,
        section,
        class_id,
        stream_id,
        classes(name),
        streams(name)
      `)
      .eq("id", studentId)
      .single();

    // --------------------------------------------------------
    // CHECK SCHOOL / STUDENT ERRORS
    // --------------------------------------------------------

    if (schoolResult.error) {
      console.error("School error:", schoolResult.error);
    }

    if (studentResult.error) {
      console.error("Student error:", studentResult.error);
    }

    if (schoolResult.error || studentResult.error) {
      showAlert(
        "Could not load the school or student information.",
        "error"
      );
      return;
    }

    const school = schoolResult.data;
    const student = studentResult.data;

    // Keep the complete student record available.
    studentRow = student;

    // Useful debugging information.
    console.log("REPORT CARD STUDENT:", student);

    // ========================================================
    // LOAD ACADEMIC YEAR
    // ========================================================

    const yearResult = await supabaseClient
      .from("academic_years")
      .select("year")
      .eq("id", yearId)
      .single();

    // ========================================================
    // LOAD TERM
    // ========================================================

    const termResult = await supabaseClient
      .from("terms")
      .select("name")
      .eq("id", termId)
      .single();

    // ========================================================
    // LOAD MARKS
    // ========================================================

    const marksResult = await supabaseClient
      .from("marks")
      .select(`
        ai_score,
        exam_score,
        total,
        grade,
        entered_by,
        subject_id,
        subjects(name)
      `)
      .eq("student_id", studentId)
      .eq("academic_year_id", yearId)
      .eq("term_id", termId)
      .order("subject_id");

    if (yearResult.error) {
      console.error("Academic year error:", yearResult.error);
    }

    if (termResult.error) {
      console.error("Term error:", termResult.error);
    }

    if (marksResult.error) {
      console.error("Marks error:", marksResult.error);

      showAlert(
        escapeHtml(marksResult.error.message),
        "error"
      );

      return;
    }

    const year = yearResult.data;
    const term = termResult.data;
    const marks = marksResult.data || [];

    // ========================================================
    // SCHOOL INFORMATION
    // ========================================================

    const schoolName = document.getElementById("schoolName");
    const schoolAddressLine1 =
      document.getElementById("schoolAddressLine1");
    const schoolAddressLine2 =
      document.getElementById("schoolAddressLine2");
    const schoolMotto = document.getElementById("schoolMotto");
    const schoolPhone = document.getElementById("schoolPhone");
    const schoolEmail = document.getElementById("schoolEmail");
    const headTeacherName =
      document.getElementById("headTeacherName");

    if (schoolName) {
      schoolName.textContent = school.name || "";
    }

    // --------------------------------------------------------
    // SCHOOL ADDRESS
    // --------------------------------------------------------

    if (schoolAddressLine1 || schoolAddressLine2) {

      const address = (school.address || "").trim();

      const lines = address
        .split(/\r?\n/)
        .map(line => line.trim())
        .filter(Boolean);

      if (schoolAddressLine1) {
        schoolAddressLine1.textContent = lines[0] || "";
      }

      if (schoolAddressLine2) {
        schoolAddressLine2.textContent = lines[1] || "";
      }
    }

    if (schoolMotto) {
      schoolMotto.textContent = school.motto || "";
    }

    if (schoolPhone) {
      schoolPhone.textContent = school.phone || "";
    }

    if (schoolEmail) {
      schoolEmail.textContent = school.email || "";
    }

    if (headTeacherName) {
      headTeacherName.textContent =
        school.head_teacher_name || "";
    }

    // ========================================================
    // SCHOOL LOGO
    // ========================================================

    if (school.logo_url) {

      const logo = document.getElementById("schoolLogo");

      if (logo) {
        logo.src = school.logo_url;
        logo.style.display = "block";
      }
    }

    // ========================================================
    // HEAD TEACHER SIGNATURE
    // ========================================================

    if (school.signature_url) {

      const signature =
        document.getElementById("signatureImg");

      if (signature) {
        signature.src = school.signature_url;
        signature.style.display = "block";
      }
    }

    // ========================================================
    // STUDENT INFORMATION
    // ========================================================

    const studentName =
      document.getElementById("studentName");

    const infoYear =
      document.getElementById("infoYear");

    const infoTerm =
      document.getElementById("infoTerm");

    const infoClass =
      document.getElementById("infoClass");

    const infoGender =
      document.getElementById("infoGender");

    const infoSection =
      document.getElementById("infoSection");

    // --------------------------------------------------------
    // STUDENT NAME
    // IMPORTANT:
    // This uses ONLY student.full_name.
    // --------------------------------------------------------

    if (studentName) {
      studentName.textContent =
        student.full_name || "—";
    }

    // --------------------------------------------------------
    // GENDER
    // --------------------------------------------------------

    if (infoGender) {
      infoGender.textContent =
        student.gender || "—";
    }

    // --------------------------------------------------------
    // SECTION
    // --------------------------------------------------------

    if (infoSection) {
      infoSection.textContent =
        student.section || "—";
    }

    // --------------------------------------------------------
    // ACADEMIC YEAR
    // --------------------------------------------------------

    if (infoYear) {
      infoYear.textContent =
        year && year.year
          ? year.year
          : "—";
    }

    // --------------------------------------------------------
    // TERM
    // --------------------------------------------------------

    if (infoTerm) {
      infoTerm.textContent =
        term && term.name
          ? term.name
          : "—";
    }

    // --------------------------------------------------------
    // CLASS + STREAM
    // --------------------------------------------------------

    if (infoClass) {

      const className =
        student.classes &&
        student.classes.name
          ? student.classes.name
          : "—";

      const streamName =
        student.streams &&
        student.streams.name
          ? student.streams.name
          : "";

      infoClass.textContent =
        streamName
          ? `${className} ${streamName}`
          : className;
    }

    // ========================================================
    // RESULTS TABLE
    // ========================================================

    const body =
      document.getElementById("resultsBody");

    if (!body) {

      showAlert(
        "The report card results table could not be found.",
        "error"
      );

      return;
    }

    // --------------------------------------------------------
    // NO MARKS
    // --------------------------------------------------------

    if (marks.length === 0) {

      body.innerHTML = `
        <tr>
          <td
            colspan="7"
            style="text-align:center;color:var(--ink-soft);"
          >
            No marks recorded for this term yet.
          </td>
        </tr>
      `;

    } else {

      // ======================================================
      // GET TEACHER IDS
      // ======================================================

      const teacherIds = [
        ...new Set(
          marks
            .map(mark => mark.entered_by)
            .filter(Boolean)
        )
      ];

      const teacherMap = {};

      // ======================================================
      // LOAD TEACHER NAMES
      // ======================================================

      if (teacherIds.length > 0) {

        const teacherResult =
          await supabaseClient
            .from("profiles")
            .select("id, full_name")
            .in("id", teacherIds);

        if (teacherResult.error) {

          console.error(
            "Teacher profile error:",
            teacherResult.error
          );

        } else if (teacherResult.data) {

          teacherResult.data.forEach(teacher => {

            teacherMap[teacher.id] =
              teacher.full_name || "";

          });
        }
      }

      // ======================================================
      // GET TEACHER INITIALS
      // ======================================================

      function getInitials(name) {

        if (!name) {
          return "—";
        }

        return name
          .trim()
          .split(/\s+/)
          .filter(Boolean)
          .map(word =>
            word.charAt(0).toUpperCase()
          )
          .join("");
      }

      // ======================================================
      // GET GRADE REMARK
      // ======================================================

      function getRemark(grade) {

        switch ((grade || "").toUpperCase()) {

          case "A":
            return "Exceptional";

          case "B":
            return "Outstanding";

          case "C":
            return "Satisfactory";

          case "D":
            return "Basic";

          case "E":
            return "Elementary";

          default:
            return "—";
        }
      }

      // ======================================================
      // BUILD RESULTS TABLE
      // ======================================================

      body.innerHTML = marks
        .map(mark => {

          const teacherName =
            teacherMap[mark.entered_by] || "";

          const teacherInitials =
            getInitials(teacherName);

          const remark =
            getRemark(mark.grade);

          const subjectName =
            mark.subjects &&
            mark.subjects.name
              ? mark.subjects.name
              : "—";

          return `
            <tr>

              <td>
                ${escapeHtml(subjectName)}
              </td>

              <td class="num">
                ${mark.ai_score ?? "—"}
              </td>

              <td class="num">
                ${mark.exam_score ?? "—"}
              </td>

              <td class="num">
                ${mark.total ?? "—"}
              </td>

              <td class="num">
                ${escapeHtml(mark.grade || "—")}
              </td>

              <td>
                ${escapeHtml(remark)}
              </td>

              <td class="num">
                ${escapeHtml(teacherInitials)}
              </td>

            </tr>
          `;

        })
        .join("");
    }

    // ========================================================
    // SHOW REPORT CARD
    // ========================================================

    reportCard.style.display = "block";

  } catch (error) {

    console.error(
      "Error loading report card:",
      error
    );

    showAlert(
      "An unexpected error occurred while loading the report card.",
      "error"
    );
  }
}

// ============================================================
// ALERT HELPER
// ============================================================

function showAlert(message, type = "error") {

  if (!alertBox) {
    return;
  }

  alertBox.innerHTML = `
    <div class="alert ${type}">
      ${message}
    </div>
  `;
}

// ============================================================
// SAVE / PRINT REPORT CARD
// ============================================================

function saveReportCardAsPdf() {

  if (
    !reportCard ||
    reportCard.style.display === "none"
  ) {

    showAlert(
      "The report card is not ready yet.",
      "error"
    );

    return;
  }

  // Opens the browser's native print dialog.
  // Select "Save as PDF" from the printer options.
  window.print();
}

// ============================================================
// PRINT BUTTON
// ============================================================

const printButton =
  document.getElementById("printBtn");

if (printButton) {

  printButton.addEventListener(
    "click",
    () => window.print()
  );
}

// ============================================================
// SAVE AS PDF BUTTON
// ============================================================

const savePdfButton =
  document.getElementById("savePdfBtn");

if (savePdfButton) {

  savePdfButton.addEventListener(
    "click",
    saveReportCardAsPdf
  );
}

// ============================================================
// START
// ============================================================

initReportCard();