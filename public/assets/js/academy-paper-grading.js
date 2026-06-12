/**
 * academy-paper-grading.js
 * Schoolmaster Paper Grading Hub — paper-grading/index.html
 *
 * Groups all submissions by student. Each student gets a collapsible
 * accordion panel listing every paper they have submitted, with full
 * grading controls inline.
 */

/* ── helpers ─────────────────────────────────────────────── */
async function apiJson(url, options = {}) {
  const res = await fetch(url, { credentials: "include", ...options });
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

function fmtDate(iso) {
  if (!iso) return "—";
  return new Date(iso).toLocaleString(undefined, {
    year: "numeric", month: "short", day: "numeric",
    hour: "2-digit", minute: "2-digit"
  });
}

function statusPill(status, grade) {
  const colours = {
    "submitted":          { bg: "#78350f", border: "#fbbf24", text: "#fde68a", label: "Pending" },
    "graded":             { bg: "#14532d", border: "#86efac", text: "#bbf7d0", label: "Graded"  },
    "revision-requested": { bg: "#450a0a", border: "#fca5a5", text: "#fecaca", label: "Revision Req." }
  };
  const c = colours[status] || { bg: "#1e293b", border: "#475569", text: "#94a3b8", label: status };
  const gradeStr = grade ? ` — ${esc(grade)}` : "";
  return `<span style="display:inline-block;padding:2px 10px;border-radius:999px;background:${c.bg};border:1px solid ${c.border};color:${c.text};font-weight:700;font-size:0.75rem;letter-spacing:0.05em;text-transform:uppercase;">${c.label}${gradeStr}</span>`;
}

function programLabel(slug) {
  const map = {
    "squire":          "Squire",
    "levie":           "Levie",
    "corporal":        "Corporal",
    "sergeant":        "Sergeant",
    "sfc":             "Sergeant First Class",
    "knight-aspirant": "Knight Aspirant",
    "knight":          "Knight",
    "lieutenant":      "Lieutenant",
    "captain":         "Captain",
    "major":           "Major",
    "commander":       "Commander",
    "chaplain":        "Chaplain"
  };
  return map[slug] || esc(slug);
}

/* ── state ───────────────────────────────────────────────── */
let ALL_ITEMS       = [];
let FILTER_STATUS   = "all";   // "all" | "pending" | "graded"
let SEARCH_QUERY    = "";

/* ── main load ───────────────────────────────────────────── */
async function loadGradingBoard() {
  const board = document.getElementById("grading-board");
  if (!board) return;

  board.innerHTML = '<p style="color:#94a3b8;padding:24px 0;">Loading submissions\u2026</p>';

  try {
    const data = await apiJson("/api/papers/list");
    ALL_ITEMS = data.submissions || data.items || [];
  } catch (err) {
    board.innerHTML = `<p style="color:#fca5a5;padding:24px 0;">Could not load submissions: ${esc(err.message)}</p>`;
    return;
  }

  renderBoard();
}

/* ── render ──────────────────────────────────────────────── */
function renderBoard() {
  const board = document.getElementById("grading-board");
  if (!board) return;

  // Apply filters
  let items = ALL_ITEMS.slice();

  if (FILTER_STATUS === "pending") {
    items = items.filter(i => i.status === "submitted");
  } else if (FILTER_STATUS === "graded") {
    items = items.filter(i => i.status === "graded" || i.status === "revision-requested");
  }

  if (SEARCH_QUERY) {
    const q = SEARCH_QUERY.toLowerCase();
    items = items.filter(i =>
      (i.fullName     || "").toLowerCase().includes(q) ||
      (i.memberId     || "").toLowerCase().includes(q) ||
      (i.programSlug  || "").toLowerCase().includes(q) ||
      (i.lessonTitle  || "").toLowerCase().includes(q) ||
      (i.assignmentTitle || "").toLowerCase().includes(q)
    );
  }

  // Stats (always from ALL_ITEMS, not filtered)
  const totalSubs    = ALL_ITEMS.length;
  const pendingCount = ALL_ITEMS.filter(i => i.status === "submitted").length;
  const gradedCount  = ALL_ITEMS.filter(i => i.status === "graded" || i.status === "revision-requested").length;
  const studentCount = new Set(ALL_ITEMS.map(i => i.memberId)).size;

  // Group filtered items by memberId → sorted newest-first within each student
  const byStudent = new Map();
  items.forEach(item => {
    if (!byStudent.has(item.memberId)) {
      byStudent.set(item.memberId, { fullName: item.fullName, memberId: item.memberId, subs: [] });
    }
    byStudent.get(item.memberId).subs.push(item);
  });
  // Sort each student's subs newest first
  byStudent.forEach(s => s.subs.sort((a, b) => new Date(b.uploadedAt) - new Date(a.uploadedAt)));
  // Sort students: those with pending first, then by most recent upload
  const students = [...byStudent.values()].sort((a, b) => {
    const aPending = a.subs.filter(s => s.status === "submitted").length;
    const bPending = b.subs.filter(s => s.status === "submitted").length;
    if (bPending !== aPending) return bPending - aPending;
    return new Date(b.subs[0].uploadedAt) - new Date(a.subs[0].uploadedAt);
  });

  board.innerHTML = `
    <!-- Stats bar -->
    <div class="stats-bar">
      <div class="stat-box">
        <div class="stat-val">${totalSubs}</div>
        <div class="stat-lbl">Total Submissions</div>
      </div>
      <div class="stat-box pending-stat">
        <div class="stat-val">${pendingCount}</div>
        <div class="stat-lbl">Awaiting Grade</div>
      </div>
      <div class="stat-box">
        <div class="stat-val">${gradedCount}</div>
        <div class="stat-lbl">Graded</div>
      </div>
      <div class="stat-box">
        <div class="stat-val">${studentCount}</div>
        <div class="stat-lbl">Students</div>
      </div>
    </div>

    <!-- Filter toolbar -->
    <div class="filter-bar">
      <div class="filter-tabs">
        <button class="ftab ${FILTER_STATUS === "all"     ? "active" : ""}" data-filter="all">All (${ALL_ITEMS.length})</button>
        <button class="ftab ${FILTER_STATUS === "pending" ? "active" : ""}" data-filter="pending">Pending (${pendingCount})</button>
        <button class="ftab ${FILTER_STATUS === "graded"  ? "active" : ""}" data-filter="graded">Graded (${gradedCount})</button>
      </div>
      <input id="paper-search" type="search" placeholder="Search student, program, lesson\u2026"
             value="${esc(SEARCH_QUERY)}"
             style="flex:1;min-width:200px;max-width:360px;" />
    </div>

    <!-- Student accordions -->
    <div id="student-list">
      ${students.length === 0
        ? `<p style="color:#94a3b8;padding:32px 0;text-align:center;">${ALL_ITEMS.length === 0 ? "No papers uploaded yet." : "No submissions match your filter."}</p>`
        : students.map(s => buildStudentAccordion(s)).join("")
      }
    </div>
  `;

  // Bind filter tabs
  board.querySelectorAll(".ftab").forEach(btn => {
    btn.addEventListener("click", () => {
      FILTER_STATUS = btn.dataset.filter;
      renderBoard();
    });
  });

  // Bind search
  const searchInput = board.querySelector("#paper-search");
  if (searchInput) {
    searchInput.addEventListener("input", () => {
      SEARCH_QUERY = searchInput.value.trim();
      renderBoard();
    });
  }

  // Bind accordion toggles
  board.querySelectorAll(".student-accordion-header").forEach(hdr => {
    hdr.addEventListener("click", () => {
      const panel = hdr.nextElementSibling;
      const arrow = hdr.querySelector(".acc-arrow");
      const isOpen = panel.style.display !== "none";
      panel.style.display = isOpen ? "none" : "block";
      if (arrow) arrow.textContent = isOpen ? "▶" : "▼";
    });
  });

  // Bind grade forms
  board.querySelectorAll(".grade-form").forEach(form => {
    form.addEventListener("submit", async (e) => {
      e.preventDefault();
      const msg = form.querySelector(".save-msg");
      const btn = form.querySelector("button[type=submit]");
      const fd  = new FormData(form);
      try {
        msg.textContent = "Saving\u2026";
        msg.className = "save-msg";
        if (btn) btn.disabled = true;
        await apiJson("/api/papers/grade", {
          method:  "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            submissionId: form.dataset.id,
            status:       fd.get("status"),
            grade:        fd.get("grade"),
            feedback:     fd.get("feedback")
          })
        });
        // Update local state so re-renders stay in sync
        const idx = ALL_ITEMS.findIndex(x => x.submissionId === form.dataset.id);
        if (idx !== -1) {
          ALL_ITEMS[idx].status   = fd.get("status");
          ALL_ITEMS[idx].grade    = fd.get("grade");
          ALL_ITEMS[idx].feedback = fd.get("feedback");
          ALL_ITEMS[idx].gradedAt = new Date().toISOString();
        }
        msg.textContent = "\u2713 Saved.";
        msg.className = "save-msg success";
      } catch (err) {
        msg.textContent = err.message;
        msg.className = "save-msg error";
      } finally {
        if (btn) btn.disabled = false;
      }
    });
  });

  // Open any student panel that has pending submissions by default
  board.querySelectorAll(".student-accordion-header").forEach(hdr => {
    const pending = parseInt(hdr.dataset.pending || "0", 10);
    if (pending > 0) {
      const panel = hdr.nextElementSibling;
      const arrow = hdr.querySelector(".acc-arrow");
      panel.style.display = "block";
      if (arrow) arrow.textContent = "▼";
    }
  });
}

/* ── student accordion builder ───────────────────────────── */
function buildStudentAccordion({ fullName, memberId, subs }) {
  const pendingCount = subs.filter(s => s.status === "submitted").length;
  const programs = [...new Set(subs.map(s => programLabel(s.programSlug)))].join(", ");

  const pendingBadge = pendingCount > 0
    ? `<span style="display:inline-block;margin-left:10px;padding:2px 10px;border-radius:999px;background:#78350f;border:1px solid #fbbf24;color:#fde68a;font-weight:700;font-size:0.78rem;">${pendingCount} Pending</span>`
    : `<span style="display:inline-block;margin-left:10px;padding:2px 10px;border-radius:999px;background:#14532d;border:1px solid #86efac;color:#bbf7d0;font-weight:700;font-size:0.78rem;">All Graded</span>`;

  const subsHtml = subs.map(item => buildSubmissionCard(item)).join("");

  return `
    <div class="student-accordion">
      <div class="student-accordion-header" data-pending="${pendingCount}">
        <div class="acc-left">
          <span class="acc-arrow" style="font-size:0.75rem;margin-right:10px;color:#94a3b8;">▶</span>
          <span class="acc-name">${esc(fullName || memberId)}</span>
          <span class="acc-member-id">(${esc(memberId)})</span>
          ${pendingBadge}
        </div>
        <div class="acc-right">
          <span class="acc-meta">${programs}</span>
          <span class="acc-count">${subs.length} submission${subs.length !== 1 ? "s" : ""}</span>
        </div>
      </div>
      <div class="student-accordion-panel" style="display:none;">
        ${subsHtml}
      </div>
    </div>
  `;
}

/* ── individual submission card ──────────────────────────── */
function buildSubmissionCard(item) {
  return `
    <div class="submission-card">
      <!-- Row 1: program / lesson / assignment + status pill -->
      <div class="sub-header-row">
        <div class="sub-meta">
          <span class="sub-program">${programLabel(item.programSlug)}</span>
          <span class="sub-sep">·</span>
          <span class="sub-lesson">Lesson ${item.lessonNumber}${item.lessonTitle ? " — " + esc(item.lessonTitle) : ""}</span>
          ${item.assignmentTitle ? `<span class="sub-sep">·</span><span class="sub-assign">${esc(item.assignmentTitle)}</span>` : ""}
        </div>
        <div>${statusPill(item.status, item.grade)}</div>
      </div>

      <!-- Row 2: file + dates -->
      <div class="sub-detail-row">
        <div class="sub-file-info">
          <span class="sub-icon">&#128196;</span>
          <span class="sub-filename">${esc(item.originalFileName)}</span>
          <a class="sub-download" href="/api/papers/download?submissionId=${encodeURIComponent(item.submissionId)}" target="_blank" rel="noopener">
            &#8681; Download
          </a>
        </div>
        <div class="sub-dates">
          <span><strong>Submitted:</strong> ${fmtDate(item.uploadedAt)}</span>
          ${item.gradedAt ? `<span><strong>Graded:</strong> ${fmtDate(item.gradedAt)}</span>` : ""}
        </div>
      </div>

      ${item.feedback ? `<div class="sub-feedback"><strong>Previous Feedback:</strong> ${esc(item.feedback)}</div>` : ""}

      <!-- Grade form -->
      <details class="grade-details">
        <summary class="grade-summary">&#9998; Grade / Feedback</summary>
        <form class="grade-form" data-id="${esc(item.submissionId)}">
          <div class="grade-grid">
            <div>
              <label class="field-label">Decision</label>
              <select name="status">
                <option value="submitted"          ${item.status === "submitted"          ? "selected" : ""}>Pending (submitted)</option>
                <option value="graded"             ${item.status === "graded"             ? "selected" : ""}>Graded — Accepted</option>
                <option value="revision-requested" ${item.status === "revision-requested" ? "selected" : ""}>Revision Required</option>
              </select>
            </div>
            <div>
              <label class="field-label">Grade</label>
              <input type="text" name="grade" value="${esc(item.grade || "")}" placeholder="Pass / Fail / A / 92\u2026" />
            </div>
          </div>
          <label class="field-label" style="margin-top:10px;display:block;">Feedback to Student</label>
          <textarea name="feedback" rows="3" placeholder="Notes or feedback visible to the student\u2026">${esc(item.feedback || "")}</textarea>
          <div style="display:flex;align-items:center;gap:14px;margin-top:10px;">
            <button type="submit" class="save-btn">&#10003; Save Grade</button>
            <div class="save-msg"></div>
          </div>
        </form>
      </details>
    </div>
  `;
}

document.addEventListener("DOMContentLoaded", loadGradingBoard);
