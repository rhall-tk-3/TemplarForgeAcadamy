async function fetchJson(url) {
  const response = await fetch(url);
  if (!response.ok) {
    throw new Error(`Failed to load ${url}`);
  }
  return response.json();
}

function esc(value = '') {
  return String(value)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#039;');
}

function groupPrograms(programs) {
  return programs.reduce((groups, program) => {
    const key = program.phase || 'Other';
    groups[key] ||= [];
    groups[key].push(program);
    return groups;
  }, {});
}

function renderProgramGroups(programs) {
  const container = document.getElementById('programGroups');
  const grouped = groupPrograms(programs);

  container.innerHTML = Object.entries(grouped).map(([phase, items]) => `
    <section class="section-block">
      <div class="section-head">
        <div>
          <p class="eyebrow">Program phase</p>
          <h3>${esc(phase)}</h3>
        </div>
        <span class="pill">${items.length} program${items.length === 1 ? '' : 's'}</span>
      </div>
      <div class="program-grid">
        ${items.map((program) => `
          <article class="program-card">
            <div class="card-top">
              <div>
                <h4>${esc(program.title)}</h4>
                <p class="muted">${esc(program.slug)} · ${esc(program.durationLabel)}</p>
              </div>
              <span class="pill subtle">${program.resourceCount} resource${program.resourceCount === 1 ? '' : 's'}</span>
            </div>
            <p class="muted">Audience: ${esc(program.audience)} · Type: ${esc(program.programType)}</p>
            <div class="button-row compact">
              <a class="btn primary" href="/${program.siteEntry}">Open site</a>
              <a class="btn secondary" href="${program.apiEndpoint}">API JSON</a>
              <a class="btn secondary" href="${program.manifestEndpoint}">File manifest</a>
            </div>
            <ul class="resource-list">
              ${program.resources.map((resource) => `<li><a href="/${resource}">${esc(resource.split('/').pop())}</a></li>`).join('')}
            </ul>
          </article>
        `).join('')}
      </div>
    </section>
  `).join('');
}

function renderResourceSections(resourceData) {
  const container = document.getElementById('resourceSections');
  container.innerHTML = resourceData.sections.map((section) => `
    <section class="resource-section">
      <div class="section-head">
        <div>
          <p class="eyebrow">Resource library</p>
          <h3>${esc(section.title)}</h3>
        </div>
        <a class="btn secondary" href="/api/resources/${section.key}">Section JSON</a>
      </div>
      <p class="lead small">${esc(section.description)}</p>
      <div class="resource-grid">
        ${section.items.map((item) => `
          <a class="resource-tile" href="${item.path}">
            <strong>${esc(item.title)}</strong>
            <span>${esc(item.slug)}</span>
          </a>
        `).join('')}
      </div>
    </section>
  `).join('');
}

function renderSummary(programs, resourceData, healthData) {
  document.getElementById('summaryStats').innerHTML = `
    <div class="stat-card"><strong>${programs.length}</strong><span>Programs</span></div>
    <div class="stat-card"><strong>${resourceData.totalItems}</strong><span>Shared documents</span></div>
    <div class="stat-card"><strong>${resourceData.sections.length}</strong><span>Library sections</span></div>
    <div class="stat-card"><strong>${esc(healthData.status)}</strong><span>API status</span></div>
  `;
}

async function init() {
  const status = document.getElementById('statusBanner');

  try {
    const [curriculumData, resourceData, healthData] = await Promise.all([
      fetchJson('/api/curriculum'),
      fetchJson('/api/resources'),
      fetchJson('/api/health')
    ]);

    renderSummary(curriculumData.programs, resourceData, healthData);
    renderProgramGroups(curriculumData.programs);
    renderResourceSections(resourceData);

    status.textContent = `Repository ready · ${curriculumData.programs.length} programs loaded · ${healthData.timestamp}`;
  } catch (error) {
    console.error(error);
    status.textContent = 'Repository page loaded, but API data could not be fetched.';
    status.classList.add('error');
  }
}

document.addEventListener('DOMContentLoaded', init);
