/**
 * academy-paper-grading.js
 * Schoolmaster Paper Grading Hub — paper-grading/index.html
 *
 * Fetches two sources and merges them into one unified view:
 *   1. /api/papers/list              — file uploads from the paper upload hub
 *   2. /api/papers/written-submissions — written/discussion answers stored in users.json
 *
 * Groups all submissions by student. Students with pending work appear first.
 * Each student gets a collapsible accordion listing every submission.
 */

/* ── helpers ─────────────────────────────────────────────── */
async function apiJson(url, options = {}) {
  const res = await fetch(url, { credentials: "include", ...options });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(data.error || `${res.status} ${res.statusText}`);
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

function typePill(submissionType) {
  if (submissionType === "written") {
    return `<span style="display:inline-block;padding:2px 9px;border-radius:999px;background:rgba(120,60,180,0.18);border:1px solid rgba(160,100,220,0.45);color:#c8a0f8;font-weight:700;font-size:0.72rem;letter-spacing:0.06em;text-transform:uppercase;">Written</span>`;
  }
  return `<span style="display:inline-block;padding:2px 9px;border-radius:999px;background:rgba(29,78,216,0.18);border:1px solid rgba(96,165,250,0.45);color:#93c5fd;font-weight:700;font-size:0.72rem;letter-spacing:0.06em;text-transform:uppercase;">File Upload</span>`;
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
  return map[slug] || esc(slug || "—");
}

/* ── state ───────────────────────────────────────────────── */
let ALL_ITEMS       = [];
let FILTER_STATUS   = "all";   // "all" | "pending" | "graded" | "written" | "uploads"
let SEARCH_QUERY    = "";

/* ── main load ───────────────────────────────────────────── */
async function loadGradingBoard() {
  const board = document.getElementById("grading-board");
  if (!board) return;

  board.innerHTML = '<p style="color:#94a3b8;padding:24px 0;">Loading submissions\u2026</p>';

  let fileItems    = [];
  let writtenItems = [];
  const errors     = [];

  // Fetch both sources in parallel — tolerate individual failures
  await Promise.all([
    apiJson("/api/papers/list")
      .then(d => { fileItems = d.submissions || d.items || []; })
      .catch(err => { errors.push("File uploads: " + err.message); }),
    apiJson("/api/papers/written-submissions")
      .then(d => { writtenItems = d.items || []; })
      .catch(err => { errors.push("Written submissions: " + err.message); })
  ]);

  if (fileItems.length === 0 && writtenItems.length === 0 && errors.length > 0) {
    board.innerHTML = `<p style="color:#fca5a5;padding:24px 0;">Could not load submissions:<br>${errors.map(esc).join("<br>")}</p>`;
    return;
  }

  // Tag each item with its source type (written-submissions endpoint already tags them)
  fileItems    = fileItems.map(i => ({ ...i, submissionType: i.submissionType || "upload" }));
  writtenItems = writtenItems.map(i => ({ ...i, submissionType: "written" }));

  // Merge — newest first
  ALL_ITEMS = [...fileItems, ...writtenItems]
    .sort((a, b) => new Date(b.uploadedAt) - new Date(a.uploadedAt));

  if (errors.length > 0) {
    console.warn("Paper grading hub — partial load errors:", errors);
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
  } else if (FILTER_STATUS === "written") {
    items = items.filter(i => i.submissionType === "written");
  } else if (FILTER_STATUS === "uploads") {
    items = items.filter(i => i.submissionType !== "written");
  }

  if (SEARCH_QUERY) {
    const q = SEARCH_QUERY.toLowerCase();
    items = items.filter(i =>
      (i.fullName         || "").toLowerCase().includes(q) ||
      (i.memberId         || "").toLowerCase().includes(q) ||
      (i.programSlug      || "").toLowerCase().includes(q) ||
      (i.lessonTitle      || "").toLowerCase().includes(q) ||
      (i.assignmentTitle  || "").toLowerCase().includes(q)
    );
  }

  // Counts always from ALL_ITEMS
  const totalSubs     = ALL_ITEMS.length;
  const pendingCount  = ALL_ITEMS.filter(i => i.status === "submitted").length;
  const gradedCount   = ALL_ITEMS.filter(i => i.status === "graded" || i.status === "revision-requested").length;
  const writtenCount  = ALL_ITEMS.filter(i => i.submissionType === "written").length;
  const uploadCount   = ALL_ITEMS.filter(i => i.submissionType !== "written").length;
  const studentCount  = new Set(ALL_ITEMS.map(i => i.memberId)).size;

  // Group filtered items by memberId
  const byStudent = new Map();
  items.forEach(item => {
    const key = item.memberId || item.fullName || "unknown";
    if (!byStudent.has(key)) {
      byStudent.set(key, { fullName: item.fullName, memberId: item.memberId, subs: [] });
    }
    byStudent.get(key).subs.push(item);
  });
  // Sort each student's subs newest first
  byStudent.forEach(s => s.subs.sort((a, b) => new Date(b.uploadedAt) - new Date(a.uploadedAt)));
  // Sort students: pending first, then most recent upload
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
        <div class="stat-lbl">Total</div>
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
        <div class="stat-val">${writtenCount}</div>
        <div class="stat-lbl">Written</div>
      </div>
      <div class="stat-box">
        <div class="stat-val">${uploadCount}</div>
        <div class="stat-lbl">File Uploads</div>
      </div>
      <div class="stat-box">
        <div class="stat-val">${studentCount}</div>
        <div class="stat-lbl">Students</div>
      </div>
    </div>

    <!-- Filter toolbar -->
    <div class="filter-bar">
      <div class="filter-tabs">
        <button class="ftab ${FILTER_STATUS === "all"     ? "active" : ""}" data-filter="all">All (${totalSubs})</button>
        <button class="ftab ${FILTER_STATUS === "pending" ? "active" : ""}" data-filter="pending">Pending (${pendingCount})</button>
        <button class="ftab ${FILTER_STATUS === "graded"  ? "active" : ""}" data-filter="graded">Graded (${gradedCount})</button>
        <button class="ftab ${FILTER_STATUS === "written" ? "active" : ""}" data-filter="written">Written (${writtenCount})</button>
        <button class="ftab ${FILTER_STATUS === "uploads" ? "active" : ""}" data-filter="uploads">Files (${uploadCount})</button>
      </div>
      <input id="paper-search" type="search" placeholder="Search student, program, lesson\u2026"
             value="${esc(SEARCH_QUERY)}"
             style="flex:1;min-width:200px;max-width:340px;" />
    </div>

    <!-- Student accordions -->
    <div id="student-list">
      ${students.length === 0
        ? `<p style="color:#94a3b8;padding:32px 0;text-align:center;">${ALL_ITEMS.length === 0 ? "No submissions yet." : "No submissions match your filter."}</p>`
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

  // Bind grade forms — file-upload submissions use /api/papers/grade,
  // written submissions use /api/papers/grade-written
  board.querySelectorAll(".grade-form").forEach(form => {
    form.addEventListener("submit", async (e) => {
      e.preventDefault();
      const msg      = form.querySelector(".save-msg");
      const btn      = form.querySelector("button[type=submit]");
      const fd       = new FormData(form);
      const isWritten = form.dataset.type === "written";
      try {
        msg.textContent = "Saving\u2026";
        msg.className = "save-msg";
        if (btn) btn.disabled = true;

        if (isWritten) {
          await apiJson("/api/papers/grade-written", {
            method:  "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
              submissionId: form.dataset.id,
              grade:        fd.get("grade"),
              notes:        fd.get("notes")
            })
          });
          const idx = ALL_ITEMS.findIndex(x => x.submissionId === form.dataset.id);
          if (idx !== -1) {
            ALL_ITEMS[idx].status   = "graded";
            ALL_ITEMS[idx].grade    = fd.get("grade");
            ALL_ITEMS[idx].feedback = fd.get("notes");
            ALL_ITEMS[idx].gradedAt = new Date().toISOString();
          }
        } else {
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
          const idx = ALL_ITEMS.findIndex(x => x.submissionId === form.dataset.id);
          if (idx !== -1) {
            ALL_ITEMS[idx].status   = fd.get("status");
            ALL_ITEMS[idx].grade    = fd.get("grade");
            ALL_ITEMS[idx].feedback = fd.get("feedback");
            ALL_ITEMS[idx].gradedAt = new Date().toISOString();
          }
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

  // ── Quick Approve / Pass / Fail buttons ──────────────────
  async function quickGrade(submissionId, action) {
    const msgEl = board.querySelector(`#qa-msg-${CSS.escape(submissionId)}`);
    const row   = board.querySelector(`.quick-approve-row[data-sid="${CSS.escape(submissionId)}"]`);
    const passBtn = row ? row.querySelector(".qa-pass") : null;
    const failBtn = row ? row.querySelector(".qa-fail") : null;

    const statusVal = (action === "pass") ? "graded" : "revision-requested";
    const gradeVal  = (action === "pass") ? "Pass"   : "Fail";

    try {
      if (msgEl) { msgEl.textContent = "Saving\u2026"; msgEl.style.color = "#94a3b8"; }
      if (passBtn) passBtn.disabled = true;
      if (failBtn) failBtn.disabled = true;

      await apiJson("/api/papers/grade", {
        method:  "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ submissionId, status: statusVal, grade: gradeVal, feedback: "" })
      });

      // Update in-memory state
      const idx = ALL_ITEMS.findIndex(x => x.submissionId === submissionId);
      if (idx !== -1) {
        ALL_ITEMS[idx].status   = statusVal;
        ALL_ITEMS[idx].grade    = gradeVal;
        ALL_ITEMS[idx].gradedAt = new Date().toISOString();
      }

      // Re-render so the card reflects the new state
      renderBoard();
    } catch (err) {
      if (msgEl) { msgEl.textContent = err.message; msgEl.style.color = "#fca5a5"; }
      if (passBtn) passBtn.disabled = false;
      if (failBtn) failBtn.disabled = false;
    }
  }

  // Pass / Fail quick buttons
  board.querySelectorAll(".qa-pass, .qa-fail").forEach(btn => {
    btn.addEventListener("click", () => {
      quickGrade(btn.dataset.sid, btn.dataset.action);
    });
  });

  // Re-open (reset to submitted) quick button
  board.querySelectorAll(".qa-reopen").forEach(btn => {
    btn.addEventListener("click", async () => {
      const sid = btn.dataset.sid;
      try {
        btn.disabled = true;
        await apiJson("/api/papers/grade", {
          method:  "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ submissionId: sid, status: "submitted", grade: "", feedback: "" })
        });
        const idx = ALL_ITEMS.findIndex(x => x.submissionId === sid);
        if (idx !== -1) {
          ALL_ITEMS[idx].status   = "submitted";
          ALL_ITEMS[idx].grade    = "";
          ALL_ITEMS[idx].gradedAt = null;
        }
        renderBoard();
      } catch (err) {
        btn.disabled = false;
        btn.textContent = "Error — retry";
      }
    });
  });

  // Auto-expand students with pending submissions
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
  const pendingCount  = subs.filter(s => s.status === "submitted").length;
  const programs      = [...new Set(subs.map(s => programLabel(s.programSlug)))].join(", ");
  const hasWritten    = subs.some(s => s.submissionType === "written");
  const hasUploads    = subs.some(s => s.submissionType !== "written");

  const typeTags = [
    hasWritten ? `<span style="font-size:0.75rem;color:#c8a0f8;">Written</span>` : "",
    hasUploads ? `<span style="font-size:0.75rem;color:#93c5fd;">Files</span>`   : ""
  ].filter(Boolean).join(" · ");

  const pendingBadge = pendingCount > 0
    ? `<span style="display:inline-block;margin-left:10px;padding:2px 10px;border-radius:999px;background:#78350f;border:1px solid #fbbf24;color:#fde68a;font-weight:700;font-size:0.78rem;">${pendingCount} Pending</span>`
    : `<span style="display:inline-block;margin-left:10px;padding:2px 10px;border-radius:999px;background:#14532d;border:1px solid #86efac;color:#bbf7d0;font-weight:700;font-size:0.78rem;">All Graded</span>`;

  const subsHtml = subs.map(item =>
    item.submissionType === "written"
      ? buildWrittenCard(item)
      : buildUploadCard(item)
  ).join("");

  return `
    <div class="student-accordion">
      <div class="student-accordion-header" data-pending="${pendingCount}">
        <div class="acc-left">
          <span class="acc-arrow" style="font-size:0.75rem;margin-right:10px;color:#94a3b8;">▶</span>
          <span class="acc-name">${esc(fullName || memberId)}</span>
          <span class="acc-member-id">(${esc(memberId || "—")})</span>
          ${pendingBadge}
        </div>
        <div class="acc-right">
          <span class="acc-meta">${programs}</span>
          ${typeTags ? `<span class="acc-meta" style="color:#64748b;">${typeTags}</span>` : ""}
          <span class="acc-count">${subs.length} submission${subs.length !== 1 ? "s" : ""}</span>
        </div>
      </div>
      <div class="student-accordion-panel" style="display:none;">
        ${subsHtml}
      </div>
    </div>
  `;
}

/* ── file-upload submission card ─────────────────────────── */
function buildUploadCard(item) {
  return `
    <div class="submission-card">
      <div class="sub-header-row">
        <div class="sub-meta">
          ${typePill("upload")}
          <span class="sub-sep" style="margin-left:6px;">·</span>
          <span class="sub-program">${programLabel(item.programSlug)}</span>
          <span class="sub-sep">·</span>
          <span class="sub-lesson">Lesson ${item.lessonNumber}${item.lessonTitle ? " — " + esc(item.lessonTitle) : ""}</span>
          ${item.assignmentTitle ? `<span class="sub-sep">·</span><span class="sub-assign">${esc(item.assignmentTitle)}</span>` : ""}
        </div>
        <div>${statusPill(item.status, item.grade)}</div>
      </div>

      ${item.lostUpload ? `<div style="padding:6px 12px;margin-bottom:8px;background:rgba(120,53,15,0.25);border-left:3px solid #f59e0b;font-size:0.82rem;color:#fde68a;"><strong>⚠ File Not Saved:</strong> This submission was recorded during system recovery. The original file was not retained due to a prior login issue. Grade this entry based on the student's verbal or re-submitted work.</div>` : ""}

      <div class="sub-detail-row">
        <div class="sub-file-info">
          <span class="sub-icon">&#128196;</span>
          <span class="sub-filename">${esc(item.originalFileName || "—")}</span>
          ${item.lostUpload || !item.storedRelativePath
            ? `<span style="color:#f59e0b;font-size:0.82rem;font-weight:700;">No file available</span>`
            : `<a class="sub-download" href="/api/papers/download?submissionId=${encodeURIComponent(item.submissionId)}" target="_blank" rel="noopener">&#8681; Download</a>`
          }
        </div>
        <div class="sub-dates">
          <span><strong>Submitted:</strong> ${fmtDate(item.uploadedAt)}</span>
          ${item.gradedAt ? `<span><strong>Graded:</strong> ${fmtDate(item.gradedAt)}</span>` : ""}
        </div>
      </div>

      ${item.feedback ? `<div class="sub-feedback"><strong>Previous Feedback:</strong> ${esc(item.feedback)}</div>` : ""}

      <!-- Quick approve buttons — always visible on pending cards -->
      ${item.status === "submitted" ? `
      <div class="quick-approve-row" data-sid="${esc(item.submissionId)}">
        <button class="qa-btn qa-pass" data-sid="${esc(item.submissionId)}" data-action="pass"
                title="Mark as Graded — Pass">
          &#10003; Approve / Pass
        </button>
        <button class="qa-btn qa-fail" data-sid="${esc(item.submissionId)}" data-action="fail"
                title="Mark as Revision Required — Fail">
          &#10007; Fail / Revision
        </button>
        <div class="qa-msg" id="qa-msg-${esc(item.submissionId)}"></div>
      </div>` : `
      <div style="margin:8px 0 4px;display:flex;align-items:center;gap:10px;">
        <span style="font-size:0.8rem;color:#64748b;font-style:italic;">
          ${item.status === "graded" ? `&#10003; Graded${item.grade ? ": " + esc(item.grade) : ""}` : `Revision requested${item.grade ? ": " + esc(item.grade) : ""}`}
        </span>
        <button class="qa-btn qa-reopen" data-sid="${esc(item.submissionId)}"
                style="font-size:0.75rem;padding:2px 10px;"
                title="Reset to Pending so you can re-grade">
          &#8635; Re-open
        </button>
      </div>`}

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

/* ── written-answer submission card ──────────────────────── */
function buildWrittenCard(item) {
  const answers = item.answers || [];

  const answersHtml = answers.length
    ? answers.map((a, i) => `
        <div style="margin-bottom:14px;">
          <div style="font-size:0.82rem;font-weight:700;color:#94a3b8;letter-spacing:0.04em;margin-bottom:4px;">
            Q${i + 1}. ${esc(a.question || "")}
          </div>
          <div style="background:#0b1220;border:1px solid rgba(148,163,184,.2);border-radius:6px;padding:10px 14px;font-size:0.88rem;color:#e5e7eb;white-space:pre-wrap;">${esc(a.answer || "")}</div>
        </div>`).join("")
    : `<p style="color:#64748b;font-size:0.85rem;font-style:italic;">No answers recorded.</p>`;

  const isGraded = item.status === "graded";

  return `
    <div class="submission-card">
      <!-- Header row: type pill · program · lesson · assignment · status pill -->
      <div class="sub-header-row">
        <div class="sub-meta">
          ${typePill("written")}
          <span class="sub-sep" style="margin-left:6px;">·</span>
          <span class="sub-program">${programLabel(item.programSlug)}</span>
          <span class="sub-sep">·</span>
          <span class="sub-lesson">Lesson ${item.lessonNumber}${item.lessonTitle ? " — " + esc(item.lessonTitle) : ""}</span>
          <span class="sub-sep">·</span>
          <span class="sub-assign">${esc(item.assignmentTitle || "Written Assignment")}</span>
        </div>
        <div>${statusPill(item.status, item.grade)}</div>
      </div>

      <!-- Dates -->
      <div class="sub-detail-row">
        <div class="sub-dates">
          <span><strong>Submitted:</strong> ${fmtDate(item.uploadedAt)}</span>
          ${item.gradedAt ? `<span><strong>Graded:</strong> ${fmtDate(item.gradedAt)}</span>` : ""}
        </div>
      </div>

      ${item.feedback ? `<div class="sub-feedback"><strong>SM Notes:</strong> ${esc(item.feedback)}</div>` : ""}

      <!-- Written answers accordion -->
      <details class="grade-details">
        <summary class="grade-summary">&#128196; View Written Answers (${answers.length})</summary>
        <div style="margin-top:12px;">
          ${answersHtml}
        </div>
      </details>

      <!-- Grade / approve form -->
      <details class="grade-details" ${!isGraded ? "open" : ""}>
        <summary class="grade-summary">&#9998; ${isGraded ? "Update Grade / Notes" : "Grade This Submission"}</summary>
        <form class="grade-form" data-id="${esc(item.submissionId)}" data-type="written">
          <div class="grade-grid">
            <div>
              <label class="field-label">Grade</label>
              <input type="text" name="grade" value="${esc(item.grade || "")}"
                     placeholder="Pass / Fail / A / 92\u2026" />
            </div>
            <div style="display:flex;align-items:flex-end;gap:10px;">
              <button type="submit" class="save-btn" style="white-space:nowrap;">
                &#10003; ${isGraded ? "Update Grade" : "Approve &amp; Save Grade"}
              </button>
            </div>
          </div>
          <label class="field-label" style="margin-top:10px;display:block;">Notes to Student</label>
          <textarea name="notes" rows="3"
                    placeholder="Optional feedback or notes visible to the student\u2026">${esc(item.feedback || "")}</textarea>
          <div style="display:flex;align-items:center;gap:14px;margin-top:10px;">
            <div class="save-msg"></div>
          </div>
        </form>
      </details>
    </div>
  `;
}

document.addEventListener("DOMContentLoaded", loadGradingBoard);
