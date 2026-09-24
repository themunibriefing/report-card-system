let currentProfile = null;
let studentId = null;

const alertBox = document.getElementById("alertBox");
const historyContainer = document.getElementById("historyContainer");

(async () => {
  currentProfile = await requireRole("admin");
  if (!currentProfile) return;
  document.getElementById("whoAmI").textContent = `${currentProfile.full_name} · Administrator`;

  const params = new URLSearchParams(window.location.search);
  studentId = params.get("id");
  if (!studentId) {
    alertBox.innerHTML = `<div class="alert error">No student selected.</div>`;
    historyContainer.innerHTML = "";
    return;
  }

  await load();
})();

document.getElementById("logoutBtn").addEventListener("click", logout);

async function load() {
  const { data: student, error: studentErr } = await supabaseClient
    .from("students")
    .select("id, full_name, status, classes(name), streams(name)")
    .eq("id", studentId)
    .single();

  if (studentErr || !student) {
    alertBox.innerHTML = `<div class="alert error">Couldn't load this student.</div>`;
    historyContainer.innerHTML = "";
    return;
  }

  document.getElementById("studentName").textContent = student.full_name;
  document.getElementById("studentClass").textContent =
    `${student.classes ? student.classes.name : "—"}${student.streams ? " " + student.streams.name : ""}` +
    (student.status !== "active" ? " · Inactive" : "");

  const [{ data: marks, error: marksErr }, { data: comments }] = await Promise.all([
    supabaseClient
      .from("marks")
      .select("ai_score, exam_score, total, grade, academic_years(id, year), terms(id, name), subjects(name)")
      .eq("student_id", studentId),
    supabaseClient
      .from("comments")
      .select("academic_year_id, term_id, class_teacher_comment, head_teacher_comment")
      .eq("student_id", studentId),
  ]);

  if (marksErr) {
    alertBox.innerHTML = `<div class="alert error">${escapeHtml(marksErr.message)}</div>`;
    historyContainer.innerHTML = "";
    return;
  }

  if (!marks || marks.length === 0) {
    historyContainer.innerHTML = `<div class="placeholder-note">No marks recorded for this student yet.</div>`;
    return;
  }

  // Group by academic year -> term
  const byYear = {};
  marks.forEach((m) => {
    const yearLabel = m.academic_years ? m.academic_years.year : "Unknown year";
    const termLabel = m.terms ? m.terms.name : "Unknown term";
    const termId = m.terms ? m.terms.id : "unknown";
    const yearId = m.academic_years ? m.academic_years.id : "unknown";
    byYear[yearLabel] = byYear[yearLabel] || {};
    byYear[yearLabel][termLabel] = byYear[yearLabel][termLabel] || { rows: [], termId, yearId };
    byYear[yearLabel][termLabel].rows.push(m);
  });

  const sortedYears = Object.keys(byYear).sort().reverse();

  historyContainer.innerHTML = sortedYears
    .map((yearLabel) => {
      const terms = byYear[yearLabel];
      const termBlocks = Object.keys(terms)
        .sort()
        .map((termLabel) => {
          const { rows, termId, yearId } = terms[termLabel];
          const comment = (comments || []).find((c) => c.term_id === termId && c.academic_year_id === yearId);

          const tableRows = rows
            .map(
              (m) => `
            <tr>
              <td>${escapeHtml(m.subjects ? m.subjects.name : "—")}</td>
              <td>${m.ai_score}</td>
              <td>${m.exam_score}</td>
              <td>${m.total}</td>
              <td>${escapeHtml(m.grade)}</td>
            </tr>`
            )
            .join("");

          const commentHtml =
            comment && (comment.class_teacher_comment || comment.head_teacher_comment)
              ? `
            <div style="margin-top:12px;font-size:0.88rem;">
              ${comment.class_teacher_comment ? `<p><strong>Class teacher:</strong> ${escapeHtml(comment.class_teacher_comment)}</p>` : ""}
              ${comment.head_teacher_comment ? `<p><strong>Head teacher:</strong> ${escapeHtml(comment.head_teacher_comment)}</p>` : ""}
            </div>`
              : "";

          return `
          <div style="margin-bottom:24px;">
            <h3 style="font-size:0.95rem;margin-bottom:10px;">${escapeHtml(termLabel)}</h3>
            <div class="table-wrap">
              <table class="data-table">
                <thead><tr><th>Subject</th><th>AI</th><th>Exam</th><th>Total</th><th>Grade</th></tr></thead>
                <tbody>${tableRows}</tbody>
              </table>
            </div>
            ${commentHtml}
          </div>`;
        })
        .join("");

      return `
      <section style="margin-bottom:32px;">
        <h2 style="font-size:1.05rem;border-bottom:1px solid var(--border);padding-bottom:8px;">${escapeHtml(yearLabel)}</h2>
        ${termBlocks}
      </section>`;
    })
    .join("");
}
