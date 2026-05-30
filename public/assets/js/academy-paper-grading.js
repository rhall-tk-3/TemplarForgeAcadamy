/**
 * academy-paper-grading.js
 * Schoolmaster paper grading interface — paper-grading/index.html.
 * Renders one grading card per submission into #grading-board.
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

function esc(s = "") {
  return String(s)
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;");
}

async function loadGradingBoard() {
  const board = document.getElementById("grading-board");
  if (!board) return;

  board.innerHTML = '<p class="board-loading">Loading submissions\u2026</p>';

  let items = [];
  try {
    const data = await apiJson("/api/papers/list");
    items = data.submissions || data.items || [];
  } catch (err) {
    board.innerHTML = `<p class="board-error">Could not load submissions: ${esc(err.message)}</p>`;
    return;
  }

  board.innerHTML = items.length
    ? items.map(item => `
      <article class="grading-card">
        <div class="top">
          <div>
            <h3>${esc(item.fullName)} <span class="member-id">(${esc(item.memberId)})</span></h3>
            <p><strong>${esc(item.programSlug)}</strong> &middot; Lesson ${item.lessonNumber} &middot; ${esc(item.lessonTitle)}</p>
            <p><strong>Assignment:</strong> ${esc(item.assignmentTitle)}</p>
            <p><strong>File:</strong> ${esc(item.originalFileName)}</p>
            <p><strong>Status:</strong> ${esc(item.status)}${item.grade ? ` &middot; <strong>Grade:</strong> ${esc(item.grade)}` : ""}</p>
            <p><strong>Uploaded:</strong> ${new Date(item.uploadedAt).toLocaleString()}</p>
          </div>
          <div class="actions">
            <a class="download-btn" href="/api/papers/download?submissionId=${encodeURIComponent(item.submissionId)}" target="_blank" rel="noopener">Download</a>
          </div>
        </div>

        <form class="grade-form" data-id="${esc(item.submissionId)}">
          <label>Status</label>
          <select name="status">
            <option value="submitted" ${item.status === "submitted" ? "selected" : ""}>submitted</option>
            <option value="graded" ${item.status === "graded" ? "selected" : ""}>graded</option>
            <option value="revision-requested" ${item.status === "revision-requested" ? "selected" : ""}>revision-requested</option>
          </select>

          <label>Grade</label>
          <input type="text" name="grade" value="${esc(item.grade || "")}" placeholder="A / Pass / 92 / etc." />

          <label>Feedback</label>
          <textarea name="feedback" rows="4" placeholder="Schoolmaster feedback">${esc(item.feedback || "")}</textarea>

          <button type="submit">Save Grade / Feedback</button>
          <div class="save-msg"></div>
        </form>
      </article>
    `).join("")
    : `<p class="board-empty">No papers uploaded yet.</p>`;

  board.querySelectorAll(".grade-form").forEach(form => {
    form.addEventListener("submit", async (e) => {
      e.preventDefault();
      const msg = form.querySelector(".save-msg");
      const btn = form.querySelector("button[type=submit]");
      const fd = new FormData(form);
      try {
        msg.textContent = "Saving\u2026";
        msg.className = "save-msg";
        if (btn) btn.disabled = true;
        await apiJson("/api/papers/grade", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            submissionId: form.dataset.id,
            status:       fd.get("status"),
            grade:        fd.get("grade"),
            feedback:     fd.get("feedback")
          })
        });
        msg.textContent = "Saved.";
        msg.className = "save-msg success";
      } catch (err) {
        msg.textContent = err.message;
        msg.className = "save-msg error";
      } finally {
        if (btn) btn.disabled = false;
      }
    });
  });
}

document.addEventListener("DOMContentLoaded", loadGradingBoard);
