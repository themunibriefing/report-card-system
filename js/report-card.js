let currentProfile = null;
let studentId = null;
let yearId = null;
let termId = null;
let studentRow = null;

const alertBox = document.getElementById("alertBox");
const reportCard = document.getElementById("reportCard");

async function initReportCard() {
  const {
    data: { session },
  } = await supabaseClient.auth.getSession();

  if (!session) {
    window.location.href = "../login.html";
    return;
  }

  currentProfile = await fetchOwnProfile();

  if (!currentProfile) {
    window.location.href = "../login.html";
    return;
  }

  const backLink = document.getElementById("backLink");

  if (backLink) {
    backLink.href =
      currentProfile.role === "admin"
        ? "../admin/reports.html"
        : "../teacher/dashboard.html";
  }

  const params = new URLSearchParams(window.location.search);

  studentId = params.get("student");
  yearId = params.get("year");
  termId = params.get("term");

  if (!studentId || !yearId || !termId) {
    alertBox.innerHTML =
      '<div class="alert error">Missing student, year, or term in the link.</div>';
    return;
  }

  await loadReportCard();
}


async function loadReportCard() {

  // -----------------------------------------
  // LOAD SCHOOL AND STUDENT
  // -----------------------------------------

  const schoolResult = await supabaseClient
    .from("schools")
    .select("*")
    .eq("id", currentProfile.school_id)
    .single();

  const studentResult = await supabaseClient
    .from("students")
    .select(
      "id, full_name, class_id, stream_id, classes(name), streams(name)"
    )
    .eq("id", studentId)
    .single();

  if (schoolResult.error || studentResult.error) {

    console.error("School error:", schoolResult.error);
    console.error("Student error:", studentResult.error);

    alertBox.innerHTML =
      '<div class="alert error">Could not load the school or student information.</div>';

    return;
  }

  const school = schoolResult.data;
  const student = studentResult.data;

  studentRow = student;


  // -----------------------------------------
  // LOAD YEAR, TERM AND MARKS
  // -----------------------------------------

  const yearResult = await supabaseClient
    .from("academic_years")
    .select("year")
    .eq("id", yearId)
    .single();

  const termResult = await supabaseClient
    .from("terms")
    .select("name")
    .eq("id", termId)
    .single();

  const marksResult = await supabaseClient
    .from("marks")
    .select(
      "ai_score, exam_score, total, grade, entered_by, subjects(name)"
    )
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

    alertBox.innerHTML =
      `<div class="alert error">${escapeHtml(marksResult.error.message)}</div>`;

    return;
  }

  const year = yearResult.data;
  const term = termResult.data;
  const marks = marksResult.data || [];


  // -----------------------------------------
  // SCHOOL HEADER
  // -----------------------------------------

  const schoolName = document.getElementById("schoolName");
  const schoolMotto = document.getElementById("schoolMotto");
  const schoolContact = document.getElementById("schoolContact");
  const headTeacherName = document.getElementById("headTeacherName");

  if (schoolName) {
    schoolName.textContent = school.name || "";
  }

  if (schoolMotto) {
    schoolMotto.textContent = school.motto || "";
  }

  if (schoolContact) {
    schoolContact.textContent = [
      school.address,
      school.phone,
      school.email
    ]
      .filter(Boolean)
      .join(" · ");
  }

  if (headTeacherName) {
    headTeacherName.textContent =
      school.head_teacher_name || "";
  }


  // -----------------------------------------
  // SCHOOL LOGO
  // -----------------------------------------

  if (school.logo_url) {

    const logo = document.getElementById("schoolLogo");

    if (logo) {
      logo.src = school.logo_url;
      logo.style.display = "block";
    }

  }


  // -----------------------------------------
  // HEAD TEACHER SIGNATURE
  // -----------------------------------------

  if (school.signature_url) {

    const signature =
      document.getElementById("signatureImg");

    if (signature) {
      signature.src = school.signature_url;
      signature.style.display = "block";
    }

  }


  // -----------------------------------------
  // STUDENT INFORMATION
  // -----------------------------------------

  const studentName =
    document.getElementById("studentName");

  const infoYear =
    document.getElementById("infoYear");

  const infoTerm =
    document.getElementById("infoTerm");

  const infoClass =
    document.getElementById("infoClass");

  if (studentName) {
    studentName.textContent =
      student.full_name || "—";
  }

  if (infoYear) {
    infoYear.textContent =
      year ? year.year : "—";
  }

  if (infoTerm) {
    infoTerm.textContent =
      term ? term.name : "—";
  }

  if (infoClass) {

    const className =
      student.classes
        ? student.classes.name
        : "—";

    const streamName =
      student.streams
        ? student.streams.name
        : "";

    infoClass.textContent =
      streamName
        ? `${className} ${streamName}`
        : className;
  }


  // -----------------------------------------
  // RESULTS TABLE
  // -----------------------------------------

  const body =
    document.getElementById("resultsBody");

  if (!body) {

    alertBox.innerHTML =
      '<div class="alert error">The report card results table could not be found.</div>';

    return;
  }


  if (marks.length === 0) {

    body.innerHTML = `
      <tr>
        <td colspan="7"
            style="text-align:center;color:var(--ink-soft);">
          No marks recorded for this term yet.
        </td>
      </tr>
    `;

  } else {

    // ---------------------------------------
    // FIND TEACHERS WHO ENTERED THE MARKS
    // ---------------------------------------

    const teacherIds = [
      ...new Set(
        marks
          .map(mark => mark.entered_by)
          .filter(Boolean)
      )
    ];

    const teacherMap = {};


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


    // ---------------------------------------
    // TEACHER INITIALS
    // ---------------------------------------

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


    // ---------------------------------------
    // GRADE REMARK
    // ---------------------------------------

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


    // ---------------------------------------
    // CREATE TABLE ROWS
    // ---------------------------------------

    body.innerHTML = marks
      .map(mark => {

        const teacherName =
          teacherMap[mark.entered_by] || "";

        const teacherInitials =
          getInitials(teacherName);

        const remark =
          getRemark(mark.grade);

        return `
          <tr>

            <td>
              ${escapeHtml(
                mark.subjects?.name || "—"
              )}
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
              ${escapeHtml(
                mark.grade || "—"
              )}
            </td>

            <td>
              ${escapeHtml(remark)}
            </td>

            <td class="num">
              ${escapeHtml(
                teacherInitials
              )}
            </td>

          </tr>
        `;

      })
      .join("");
  }


  // -----------------------------------------
  // DISPLAY REPORT CARD
  // -----------------------------------------

  reportCard.style.display = "block";
}


// -------------------------------------------
// PRINT BUTTON
// -------------------------------------------

const printButton =
  document.getElementById("printBtn");

if (printButton) {

  printButton.addEventListener(
    "click",
    () => window.print()
  );

}


// -------------------------------------------
// START
// -------------------------------------------

initReportCard();
// --------------------------------------------------
// Save current report card as PDF
// --------------------------------------------------

async function saveReportCardAsPdf() {
  const btn = document.getElementById("savePdfBtn");

  if (!reportCard || reportCard.style.display === "none") {
    alertBox.innerHTML =
      '<div class="alert error">The report card is not ready yet.</div>';
    return;
  }

  btn.disabled = true;
  btn.textContent = "Preparing PDF...";

  try {
    const studentName =
      document.getElementById("studentName")?.textContent.trim() ||
      "Student";

    const academicYear =
      document.getElementById("infoYear")?.textContent.trim() ||
      "Year";

    const term =
      document.getElementById("infoTerm")?.textContent.trim() ||
      "Term";

    const safeName = `${studentName}_${term}_${academicYear}_Report_Card`
      .replace(/[<>:"/\\|?*]+/g, "")
      .replace(/\s+/g, "_");

    const options = {
      margin: 8,
      filename: `${safeName}.pdf`,

      image: {
        type: "jpeg",
        quality: 0.98
      },

      html2canvas: {
        scale: 2,
        useCORS: true,
        backgroundColor: "#ffffff"
      },

      jsPDF: {
        unit: "mm",
        format: "a4",
        orientation: "portrait"
      },

      pagebreak: {
        mode: ["css", "legacy"]
      }
    };

    await html2pdf()
      .set(options)
      .from(reportCard)
      .save();

    alertBox.innerHTML =
      '<div class="alert success">Report card PDF saved successfully.</div>';

  } catch (error) {
    console.error("PDF generation error:", error);

    alertBox.innerHTML =
      `<div class="alert error">Could not create the PDF: ${escapeHtml(error.message || "Unknown error")}</div>`;

  } finally {
    btn.disabled = false;
    btn.textContent = "Save as PDF";
  }
}
const savePdfButton = document.getElementById("savePdfBtn");

if (savePdfButton) {
  savePdfButton.addEventListener("click", saveReportCardAsPdf);
}