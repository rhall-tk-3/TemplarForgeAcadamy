/**
 * academy-paper-upload.js
 * Member paper submission hub — questionnaire-hub/index.html.
 * Renders one lesson card per paperRequired lesson across all programs.
 * Reads window.ACADEMY_ASSIGNMENT_CONFIG (keyed by programSlug).
 *
 * Query params (optional, set by curriculum-portal.js week-page links):
 *   ?program=SLUG   — auto-scroll to and highlight a specific program section
 *   ?lesson=N       — further highlight the specific lesson card within that program
 */

async function apiJson(url, options = {}) {
  const res = await fetch(url, {
    credentials: "include",
    ...options
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(data.error || "Request failed.");
  return data;
}

function badge(status) {
  const map = {
    submitted: "#fbbf24",
    graded: "#86efac",
    "revision-requested": "#fca5a5"
  };
  return `<span style="display:inline-block;padding:4px 8px;border-radius:999px;background:${map[status] || "#94a3b8"};color:#111827;font-weight:700;font-size:.78rem;text-transform:uppercase;">${status}</span>`;
}

function escapeHtml(s = "") {
  return String(s)
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;");
}

function findSubmissions(items, programSlug, lessonNumber) {
  return items.filter(
    x => x.programSlug === programSlug && Number(x.lessonNumber) === Number(lessonNumber)
  );
}

async function loadHub() {
  const wrap = document.getElementById("paper-upload-root");
  if (!wrap) return;

  wrap.innerHTML = '<p class="hub-loading">Loading your submissions\u2026</p>';

  let items = [];
  try {
    const data = await apiJson("/api/papers/my-submissions");
    items = data.submissions || data.items || [];
  } catch (err) {
    wrap.innerHTML = `<p class="hub-error">Could not load submissions: ${escapeHtml(err.message)}</p>`;
    return;
  }

  const config = window.ACADEMY_ASSIGNMENT_CONFIG || {};

  const html = Object.entries(config).map(([programSlug, program]) => {
    const cards = program.lessons
      .filter(l => l.paperRequired)
      .map(lesson => {
        const lessonSubs = findSubmissions(items, programSlug, lesson.lessonNumber);
        return `
          <article class="lesson-card" id="lesson-${escapeHtml(programSlug)}-${lesson.lessonNumber}">
            <div class="lesson-head">
              <div>
                <h3>${escapeHtml(program.title)} — Lesson ${lesson.lessonNumber}</h3>
                <p class="lesson-title">${escapeHtml(lesson.lessonTitle)}</p>
                <p class="assignment-title">${escapeHtml(lesson.assignmentTitle)}</p>
              </div>
            </div>

            <form class="upload-form"
              data-program-slug="${escapeHtml(programSlug)}"
              data-lesson-number="${lesson.lessonNumber}"
              data-lesson-title="${escapeHtml(lesson.lessonTitle)}"
              data-assignment-title="${escapeHtml(lesson.assignmentTitle)}"
            >
              <label class="file-label">Upload paper (.docx or .pdf only)</label>
              <input type="file" name="paper" accept=".pdf,.docx,application/pdf,application/vnd.openxmlformats-officedocument.wordprocessingml.document" required />
              <button type="submit">Upload Submission</button>
              <div class="form-msg"></div>
            </form>

            <div class="submission-list">
              <h4>Submitted Files</h4>
              ${
                lessonSubs.length
                  ? lessonSubs.map(sub => `
                    <div class="submission-row">
                      <div class="submission-main">
                        <strong>${escapeHtml(sub.originalFileName)}</strong>
                        <div class="meta">
                          ${badge(sub.status)}
                          <span>Uploaded ${new Date(sub.uploadedAt).toLocaleString()}</span>
                          ${sub.grade ? `<span>Grade: ${escapeHtml(sub.grade)}</span>` : ""}
                        </div>
                        ${sub.feedback ? `<div class="feedback"><strong>SM Feedback:</strong> ${escapeHtml(sub.feedback)}</div>` : ""}
                      </div>
                      <div class="submission-actions">
                        <a href="/api/papers/download?submissionId=${encodeURIComponent(sub.submissionId)}" target="_blank" rel="noopener">Download</a>
                      </div>
                    </div>
                  `).join("")
                  : `<p class="empty">No paper uploaded yet for this lesson.</p>`
              }
            </div>
          </article>
        `;
      }).join("");

    if (!cards) return "";
    return `<section class="program-block" id="program-${escapeHtml(programSlug)}"><h2>${escapeHtml(program.title)}</h2>${cards}</section>`;
  }).join("");

  wrap.innerHTML = html || '<p class="hub-empty">No assignment submissions are configured.</p>';

  /* ── Auto-scroll to program/lesson from query params ── */
  const qp = new URLSearchParams(window.location.search);
  const qProgram = qp.get("program");
  const qLesson  = qp.get("lesson");
  if (qProgram) {
    const targetId = qLesson
      ? `lesson-${qProgram}-${qLesson}`
      : `program-${qProgram}`;
    const target = document.getElementById(targetId);
    if (target) {
      /* Brief delay so layout is stable before scroll */
      setTimeout(function () {
        target.scrollIntoView({ behavior: "smooth", block: "start" });
        /* Highlight the card with a gold border flash */
        target.style.transition = "box-shadow 0.3s";
        target.style.boxShadow = "0 0 0 3px #d4af37";
        setTimeout(function () {
          target.style.boxShadow = "";
        }, 2500);
      }, 120);
    }
  }

  wrap.querySelectorAll(".upload-form").forEach(form => {
    form.addEventListener("submit", async (e) => {
      e.preventDefault();
      const msg = form.querySelector(".form-msg");
      const fileInput = form.querySelector('input[type="file"]');
      if (!fileInput.files.length) {
        msg.textContent = "Please choose a file.";
        msg.className = "form-msg error";
        return;
      }

      const fd = new FormData();
      fd.append("paper", fileInput.files[0]);
      fd.append("programSlug", form.dataset.programSlug);
      fd.append("lessonNumber", form.dataset.lessonNumber);
      fd.append("lessonTitle", form.dataset.lessonTitle);
      fd.append("assignmentTitle", form.dataset.assignmentTitle);

      const btn = form.querySelector("button[type=submit]");
      try {
        msg.textContent = "Uploading\u2026";
        msg.className = "form-msg";
        if (btn) btn.disabled = true;
        const res = await fetch("/api/papers/upload", {
          method: "POST",
          body: fd,
          credentials: "include"
        });
        const data = await res.json().catch(() => ({}));
        if (!res.ok) throw new Error(data.error || "Upload failed.");
        msg.textContent = "Upload complete.";
        msg.className = "form-msg success";
        await loadHub();
      } catch (err) {
        msg.textContent = err.message;
        msg.className = "form-msg error";
        if (btn) btn.disabled = false;
      }
    });
  });
}

document.addEventListener("DOMContentLoaded", loadHub);
