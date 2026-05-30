function esc(v = "") {
  return String(v)
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;");
}

async function apiJson(url, options = {}) {
  const res = await fetch(url, { credentials: "include", ...options });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(data.error || "Request failed.");
  return data;
}

let SM_DATA = [];

function renderSummary(items) {
  const root = document.getElementById("sm-summary");
  if (!items.length) {
    root.innerHTML = `<p class="empty">No student reading logs have synced yet.</p>`;
    return;
  }

  root.innerHTML = `
    <table class="summary-table">
      <thead>
        <tr>
          <th>Member</th>
          <th>Program</th>
          <th>Completion</th>
          <th>Last Activity</th>
          <th>Synced</th>
          <th>View</th>
        </tr>
      </thead>
      <tbody>
        ${items.map((item, index) => `
          <tr>
            <td><strong>${esc(item.fullName)}</strong><br /><span class="muted">${esc(item.memberId)}</span></td>
            <td>${esc(item.programSlug)}</td>
            <td>${item.summary.completedDocs}/${item.summary.totalDocs} (${item.summary.completionPct}%)</td>
            <td>${item.updatedAt ? new Date(item.updatedAt).toLocaleString() : "—"}</td>
            <td>${item.submittedAt ? new Date(item.submittedAt).toLocaleString() : "Not synced"}</td>
            <td><button class="view-btn" data-index="${index}">Open</button></td>
          </tr>
        `).join("")}
      </tbody>
    </table>
  `;

  root.querySelectorAll(".view-btn").forEach((btn) => {
    btn.addEventListener("click", () => renderDetail(items[Number(btn.dataset.index)]));
  });
}

function renderDetail(item) {
  const root = document.getElementById("sm-detail");
  root.innerHTML = `
    <section class="detail-card">
      <h2>${esc(item.fullName)} <span class="muted">(${esc(item.memberId)})</span></h2>
      <p><strong>Program:</strong> ${esc(item.programSlug)}</p>
      <p><strong>Completion:</strong> ${item.summary.completedDocs}/${item.summary.totalDocs} (${item.summary.completionPct}%)</p>
      <p><strong>Last Activity:</strong> ${item.updatedAt ? new Date(item.updatedAt).toLocaleString() : "—"}</p>
      <p><strong>Synced to Schoolmaster:</strong> ${item.submittedAt ? new Date(item.submittedAt).toLocaleString() : "Not synced"}</p>

      ${item.weeks.map((week) => `
        <article class="detail-week">
          <h3>Week ${week.weekNumber} — ${esc(week.title)}</h3>
          <div class="detail-doc-grid">
            ${week.documents.map((doc) => `
              <div class="detail-doc-card">
                <div class="doc-title">${esc(doc.title)}</div>
                <div class="doc-meta"><strong>Status:</strong> ${esc(doc.status)}</div>
                <div class="doc-meta"><strong>Opened:</strong> ${doc.openCount}</div>
                <div class="doc-meta"><strong>Last Opened:</strong> ${doc.lastOpenedAt ? new Date(doc.lastOpenedAt).toLocaleString() : "—"}</div>
                <div class="doc-meta"><strong>Notes:</strong> ${doc.notes ? esc(doc.notes) : "—"}</div>
                <div class="doc-meta"><a href="${esc(doc.url)}" target="_blank" rel="noopener">Open source document</a></div>
              </div>
            `).join("")}
          </div>
        </article>
      `).join("")}
    </section>
  `;
}

async function loadSchoolmasterLogs() {
  const data = await apiJson("/api/reading-log/list");
  SM_DATA = data.items || [];
  renderSummary(SM_DATA);
  if (SM_DATA.length) renderDetail(SM_DATA[0]);
}

document.addEventListener("DOMContentLoaded", async () => {
  await loadSchoolmasterLogs();
  setInterval(loadSchoolmasterLogs, 30000);
});
