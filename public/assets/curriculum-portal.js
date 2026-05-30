(function () {
  const PROFILE_KEY = 'ktkcCurriculumProfileV1';
  const STYLE_ID = 'curriculum-portal-style';

  function esc(value) {
    return String(value || '')
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;')
      .replace(/'/g, '&#039;');
  }

  function loadProfile() {
    try {
      return JSON.parse(localStorage.getItem(PROFILE_KEY) || '{}');
    } catch (_error) {
      return {};
    }
  }

  function saveProfile(profile) {
    localStorage.setItem(PROFILE_KEY, JSON.stringify(profile));
  }

  function ensureStyle() {
    if (document.getElementById(STYLE_ID)) return;
    const link = document.createElement('link');
    link.id = STYLE_ID;
    link.rel = 'stylesheet';
    link.href = '/assets/curriculum-portal.css';
    document.head.appendChild(link);
  }

  function apiGet(url) {
    return fetch(url).then(async (response) => {
      const data = await response.json().catch(() => ({}));
      if (!response.ok) {
        throw new Error(data.error || 'Request failed');
      }
      return data;
    });
  }

  function apiPost(url, body) {
    return fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body)
    }).then(async (response) => {
      const data = await response.json().catch(() => ({}));
      if (!response.ok) {
        throw new Error(data.error || 'Request failed');
      }
      return data;
    });
  }

  function getProgramSlugFromPath() {
    const match = window.location.pathname.match(/\/programs\/([^/]+)\/site\//);
    return match ? match[1] : null;
  }

  function statusBadge(status) {
    const labelMap = {
      passed: 'Passed',
      failed: 'Failed',
      retest: 'Retest approved',
      available: 'Available now',
      locked: 'Locked',
      pending_unlock: 'Awaiting Schoolmaster Unlock'
    };
    return `<span class="curriculum-badge ${status}">${labelMap[status] || status}</span>`;
  }

  function addProgramLinks() {
    const slug = getProgramSlugFromPath();
    if (!slug) return;
    const nav = document.querySelector('header nav ul');
    if (nav && !nav.querySelector('[data-curriculum-nav="assessment"]')) {
      const links = [
        { key: 'assessment', label: 'Assessment', href: `/programs/${slug}/site/assessment/index.html` },
        { key: 'materials', label: 'Materials', href: `/programs/${slug}/site/materials/index.html` },
        { key: 'progress', label: 'Progress', href: `/programs/${slug}/site/progress/index.html` }
      ];
      links.forEach((item) => {
        const li = document.createElement('li');
        li.innerHTML = `<a data-curriculum-nav="${item.key}" href="${item.href}">${item.label}</a>`;
        nav.appendChild(li);
      });
    }

    const pageKey = document.body.dataset.curriculumPage;
    const weekPageMatch = window.location.pathname.match(/\/weeks\/week(\d+)\.html$/);
    const weekNumberOnPage = weekPageMatch ? Number(weekPageMatch[1]) : null;

    if (!document.querySelector('.curriculum-quicklinks') && slug) {
      const host = document.querySelector('.section .container') || document.querySelector('main .wrap') || document.body;
      const box = document.createElement('div');
      box.className = 'curriculum-quicklinks';

      const uploadLabel = weekNumberOnPage
        ? `Upload Week ${weekNumberOnPage} Paper`
        : `Student Paper Upload`;
      const uploadHref = weekNumberOnPage
        ? `/member/questionnaire-hub/?program=${encodeURIComponent(slug)}&lesson=${weekNumberOnPage}`
        : `/member/questionnaire-hub/`;

      box.innerHTML = `
        <strong>Course tools</strong>
        <div class="curriculum-note">Use the full curriculum tools to study, take quizzes, track progress, and review prior program materials.</div>
        <ul>
          <li><a href="${uploadHref}">${uploadLabel}</a></li>
          <li><a href="/programs/${slug}/site/assessment/index.html">Assessment Center</a></li>
          <li><a href="/programs/${slug}/site/materials/index.html">Materials Vault</a></li>
          <li><a href="/programs/${slug}/site/progress/index.html">Progress Tracker</a></li>
          <li><a href="/library/index.html">Shared Library</a></li>
        </ul>
      `;
      if (pageKey || window.location.pathname.includes('/weeks/') || window.location.pathname.endsWith('/index.html')) {
        host.insertBefore(box, host.firstChild.nextSibling || null);
      }
    }

    const weekMatch = window.location.pathname.match(/\/weeks\/week(\d+)\.html$/);
    if (weekMatch && !document.querySelector('[data-week-quiz-cta]')) {
      const weekNumber = Number(weekMatch[1]);
      const panel = document.createElement('div');
      panel.className = 'curriculum-review-card';
      panel.setAttribute('data-week-quiz-cta', 'true');
      panel.innerHTML = `
        <h3>Weekly assessment</h3>
        <p class="curriculum-help">The Assessment Center includes your lesson content, required reading, quiz questions, and discussion prompts — all in one place. Open it below to complete this week’s work.</p>
        <div class="curriculum-actions">
          <a class="curriculum-button secondary" href="/programs/${slug}/site/assessment/index.html?week=${weekNumber}">Open Week ${weekNumber} Assessment</a>
          <a class="curriculum-button ghost" href="/programs/${slug}/site/materials/index.html">Review study materials</a>
        </div>
      `;
      const target = document.querySelector('.section .container') || document.body;
      target.appendChild(panel);
    }
  }

  function renderProfileForm(container, course, onSave, message = '') {
    const profile = loadProfile();
    container.innerHTML = `
      <div class="curriculum-profile-card">
        <h3>Learner profile</h3>
        <p class="curriculum-help">Enter the learner name and schoolmaster-facing email once. Quiz submissions and discussion responses will be stored under this profile.</p>
        ${message ? `<div class="curriculum-badge failed">${esc(message)}</div>` : ''}
        <form id="curriculum-profile-form" class="curriculum-form-grid" style="margin-top:14px;">
          <div class="curriculum-field"><label>Student name</label><input name="studentName" value="${esc(profile.studentName || '')}" required /></div>
          <div class="curriculum-field"><label>Student email</label><input type="email" name="studentEmail" value="${esc(profile.studentEmail || '')}" required /></div>
          <div class="curriculum-actions"><button class="curriculum-button primary" type="submit">Save profile</button></div>
        </form>
      </div>
    `;
    container.querySelector('form').addEventListener('submit', (event) => {
      event.preventDefault();
      const form = new FormData(event.currentTarget);
      const nextProfile = {
        studentName: String(form.get('studentName') || '').trim(),
        studentEmail: String(form.get('studentEmail') || '').trim().toLowerCase()
      };
      saveProfile(nextProfile);
      onSave(nextProfile);
    });
  }

  function renderReview(review) {
    return review.map((item) => `
      <div class="curriculum-question">
        <strong>Question ${item.questionNumber}</strong>
        <p>${esc(item.prompt)}</p>
        <div class="curriculum-option ${item.isCorrect ? 'correct' : 'incorrect'}"><strong>Your answer:</strong> ${esc(item.submittedAnswer || 'No answer')} — ${esc(item.submittedText || 'No option selected')}</div>
        <div class="curriculum-option correct"><strong>Correct answer:</strong> ${esc(item.correctAnswer)} — ${esc(item.correctText)}</div>
        <div class="curriculum-help">${esc(item.explanation)}</div>
      </div>
    `).join('');
  }

  function weekSummaryCard(week, status, onSelect) {
    const latest = status.latestSubmission;
    const scoreText = latest ? `${latest.score}%` : 'Not attempted';
    return `
      <div class="curriculum-week-card">
        <div class="curriculum-actions" style="justify-content:space-between; margin-top:0; align-items:flex-start;">
          <div>
            <div class="curriculum-note">Week ${week.week_number}</div>
            <h3>${esc(week.week_title)}</h3>
          </div>
          ${statusBadge(status.status)}
        </div>
        <p class="curriculum-help">${esc(week.focus)}</p>
        <div class="curriculum-note">Attempts: ${status.attempts} · Latest score: ${scoreText}</div>
        <div class="curriculum-actions">
          <button class="curriculum-button ghost" data-week-select="${week.week_number}">${status.status === 'passed' || status.status === 'pending_unlock' ? 'Review answers' : 'Open week'}</button>
        </div>
      </div>
    `;
  }

  function renderAssessmentShell(container, course, progress, selectedWeekNumber, errorMessage) {
    const selectedStatus = progress.weeks.find((item) => Number(item.weekNumber) === Number(selectedWeekNumber)) || progress.weeks[0];
    const selectedWeek = course.weeks.find((item) => Number(item.week_number) === Number(selectedStatus.weekNumber));
    const profile = loadProfile();
    const hubUrl = `/programs/${course.slug}/hub`;
    container.innerHTML = `
      <div class="curriculum-shell">
        <div class="curriculum-summary-card">
          <div class="curriculum-grid two">
            <div>
              <h2>${esc(course.title)} — Week ${esc(String(selectedStatus.weekNumber))} Lesson Review</h2>
              <p class="curriculum-help">Review this week's lesson, objectives, key terms, and required reading. When ready, continue to the Program Hub to take the weekly exam.</p>
              <div class="curriculum-inline-list"><li><a href="${course.materials_home}">Materials Vault</a></li><li><a href="${course.progress_home}">Progress Tracker</a></li><li><a href="${esc(hubUrl)}">Program Hub</a></li></div>
            </div>
            <div style="display:flex; flex-direction:column; align-items:flex-end; gap:12px;">
              <div class="curriculum-profile-card" style="width:100%;">
                <h3>Learner profile</h3>
                <div class="curriculum-note">${esc(profile.studentName)} · ${esc(profile.studentEmail)}</div>
                <div class="curriculum-actions"><button class="curriculum-button ghost" id="edit-profile-button">Edit profile</button></div>
              </div>
              <a class="curriculum-button primary" href="${esc(hubUrl)}" style="display:inline-flex;align-items:center;gap:8px;text-decoration:none;white-space:nowrap;">
                ✎ Continue to Exam →
              </a>
            </div>
          </div>
          ${errorMessage ? `<div class="curriculum-badge failed" style="margin-top:14px;">${esc(errorMessage)}</div>` : ''}
          <div class="curriculum-metrics">
            <div class="curriculum-metric"><span class="curriculum-note">Weeks passed</span><strong>${progress.passedCount}/${progress.totalWeeks}</strong></div>
            <div class="curriculum-metric"><span class="curriculum-note">Completion</span><strong>${progress.completion}%</strong></div>
            <div class="curriculum-metric"><span class="curriculum-note">Next action week</span><strong>${progress.nextActionWeek || 'Done'}</strong></div>
            <div class="curriculum-metric"><span class="curriculum-note">Passing standard</span><strong>${selectedWeek.passing_score || 70}%</strong></div>
          </div>
        </div>
        <div class="curriculum-grid two">
          <div>
            <div class="curriculum-grid">${course.weeks.map((week) => weekSummaryCard(week, progress.weeks.find((item) => Number(item.weekNumber) === Number(week.week_number)), () => {})).join('')}</div>
          </div>
          <div id="curriculum-week-detail"></div>
        </div>
      </div>
    `;

    container.querySelectorAll('[data-week-select]').forEach((button) => {
      button.addEventListener('click', () => {
        const targetWeek = Number(button.getAttribute('data-week-select'));
        const url = new URL(window.location.href);
        url.searchParams.set('week', targetWeek);
        window.history.replaceState({}, '', url.toString());
        renderAssessmentPage(container, course.slug, targetWeek, '');
      });
    });

    container.querySelector('#edit-profile-button').addEventListener('click', () => {
      renderAssessmentPage(container, course.slug, selectedWeekNumber, '', true);
    });

    renderAssessmentDetail(container.querySelector('#curriculum-week-detail'), course, progress, selectedWeek);
  }

  function questionMarkup(question, index, existingAnswers) {
    return `
      <div class="curriculum-question">
        <strong>Question ${index + 1}</strong>
        <p>${esc(question.prompt)}</p>
        ${(question.choices || []).map((choice) => `
          <label class="curriculum-option">
            <input type="radio" name="question-${index}" value="${esc(choice.option)}" ${existingAnswers[index] === choice.option ? 'checked' : ''} required />
            <span><strong>${esc(choice.option)}.</strong> ${esc(choice.text)}</span>
          </label>
        `).join('')}
      </div>
    `;
  }

  function discussionMarkup(week, existingDiscussion) {
    return `
      <div class="curriculum-review-card">
        <h3>Discussion questions</h3>
        <p class="curriculum-help">Discussion responses are recorded for schoolmaster review. They are not graded, but they are submitted with the quiz attempt and can be reviewed afterward without changing them.</p>
        ${(week.discussion_questions || []).map((item, index) => `
          <div class="curriculum-field">
            <label>${esc(item.prompt)}</label>
            <textarea name="discussion-${index}" required>${esc(existingDiscussion[index] || '')}</textarea>
          </div>
        `).join('')}
      </div>
    `;
  }

  function renderAssessmentDetail(target, course, progress, week) {
    const status = progress.weeks.find((item) => Number(item.weekNumber) === Number(week.week_number));
    const latest = status.latestSubmission;
    const isPendingUnlock = status.status === 'pending_unlock';
    const isFailed = status.status === 'failed';

    // Hub URL for this week's exam tab
    const hubUrl = `/programs/${course.slug}/hub`;

    // Status banner (shown when previously submitted)
    let statusBannerHtml = '';
    if (latest) {
      if (isPendingUnlock) {
        statusBannerHtml = `
          <div class="curriculum-badge pending_unlock" style="margin:14px 0; display:block; padding:12px 16px;">
            ✠ You have passed this week (${latest.score}%). Your work is under review by the Schoolmaster.<br>
            The next week will unlock once the Schoolmaster approves your progression.
          </div>`;
      } else if (isFailed) {
        statusBannerHtml = `
          <div class="curriculum-badge failed" style="margin:14px 0; display:block; padding:12px 16px;">
            ✗ Failed — ${latest.score}%. The Schoolmaster must approve a retest before you may attempt again.<br>
            Visit your <a href="${esc(course.progress_home)}" style="color:inherit;text-decoration:underline;">Progress Tracker</a> for details.
          </div>`;
      } else {
        statusBannerHtml = `
          <div class="curriculum-badge" style="margin:14px 0; display:block; padding:10px 14px; background:rgba(10,58,26,0.3); border:1px solid #1a5a28; color:#6ccf88;">
            ✓ Score: ${latest.score}% — Submitted ${esc(new Date(latest.submittedAt).toLocaleDateString())}
          </div>`;
      }
    }

    // Build inline lesson panel — focus text, lesson outline, and key terms
    const lessonFocusAreas = (week.lesson_focus_areas || []).length
      ? `<div style="margin-top:10px;"><strong>This week covers:</strong><ul style="margin:6px 0 0 18px;">${(week.lesson_focus_areas || []).map((area) => `<li>${esc(area)}</li>`).join('')}</ul></div>`
      : '';
    const readinessGoals = (week.readiness_goals || []).length
      ? `<div style="margin-top:10px;"><strong>Readiness goals:</strong><ul style="margin:6px 0 0 18px;">${(week.readiness_goals || []).map((goal) => `<li>${esc(goal)}</li>`).join('')}</ul></div>`
      : '';
    const keyTermsHtml = (week.key_terms || []).length
      ? `<div class="curriculum-review-card" style="margin-top:16px;"><h3>Key Terms</h3><ul style="margin:6px 0 0 18px;">${(week.key_terms || []).map((term) => `<li><strong>${esc(term.term || term)}</strong>${term.definition ? ': ' + esc(term.definition) : ''}</li>`).join('')}</ul></div>`
      : '';
    const requiredReadingHtml = `
      <div class="curriculum-review-card" style="margin-top:16px;">
        <h3>Required Reading</h3>
        <ul class="curriculum-inline-list">${(week.required_reading || []).map((item) => `<li><a href="/viewer/index.html?url=${encodeURIComponent(item.url)}&title=${encodeURIComponent(item.title)}" target="_blank" rel="noopener noreferrer">${esc(item.title)}</a></li>`).join('') || '<li><span class="curriculum-note">See the Materials Vault for this week\'s reading.</span></li>'}</ul>
      </div>`;

    // Previous attempt review (shown during approved retest)
    const previousReviewHtml = (latest && (status.status === 'retest')) ? `
      <div class="curriculum-review-card" style="margin-top:16px;">
        <h3>Previous Attempt Review</h3>
        <p class="curriculum-help">Your last attempt is shown below for reference. Because a retest has been approved, you may take the exam again from the Program Hub.</p>
        ${renderReview(latest.review || [])}
      </div>` : '';

    // Continue to exam button — always shown, points to hub
    const continueBtn = `
      <div style="margin-top:20px; text-align:right;">
        <a class="curriculum-button primary" href="${esc(hubUrl)}" style="display:inline-flex;align-items:center;gap:8px;text-decoration:none;">
          Continue to Week ${esc(String(week.week_number))} Exam →
        </a>
      </div>`;

    target.innerHTML = `
      <div class="curriculum-review-card" style="margin-top:0;">
        <div style="display:flex; align-items:flex-start; justify-content:space-between; gap:16px; flex-wrap:wrap;">
          <div>
            <h3 style="margin-bottom:6px;">${esc(week.week_title)}</h3>
            <p class="curriculum-help">${esc(week.focus || '')}</p>
          </div>
          <a class="curriculum-button primary" href="${esc(hubUrl)}" style="display:inline-flex;align-items:center;gap:8px;text-decoration:none;white-space:nowrap;flex-shrink:0;">
            Continue to Exam →
          </a>
        </div>
        ${statusBannerHtml}
        ${lessonFocusAreas}
        ${readinessGoals}
      </div>
      ${keyTermsHtml}
      ${requiredReadingHtml}
      ${previousReviewHtml}
      ${continueBtn}
    `;
  }

  async function renderAssessmentPage(container, slug, forcedWeek, message = '', forceProfileEdit = false) {
    ensureStyle();
    const course = await apiGet(`/api/assessment/${slug}/course`);
    const profile = loadProfile();
    if (!profile.studentEmail || !profile.studentName || forceProfileEdit) {
      renderProfileForm(container, course, () => renderAssessmentPage(container, slug, forcedWeek), message);
      return;
    }
    try {
      const progress = await apiGet(`/api/assessment/${slug}/progress?studentName=${encodeURIComponent(profile.studentName)}&studentEmail=${encodeURIComponent(profile.studentEmail)}`);
      const queryWeek = Number(new URLSearchParams(window.location.search).get('week') || 0);
      const selectedWeekNumber = forcedWeek || queryWeek || progress.nextActionWeek || 1;
      renderAssessmentShell(container, course, progress, selectedWeekNumber, message);
    } catch (error) {
      renderProfileForm(container, course, () => renderAssessmentPage(container, slug, forcedWeek), error.message);
    }
  }

  async function renderMaterialsPage(container, slug) {
    ensureStyle();
    const course = await apiGet(`/api/assessment/${slug}/course`);
    container.innerHTML = `
      <div class="curriculum-shell">
        <div class="curriculum-grid two">
          <div class="curriculum-resource-card">
            <h3>Current program documents</h3>
            <p class="curriculum-help">Use these documents for weekly study, quiz preparation, and cumulative review.</p>
            <ul class="curriculum-inline-list">${(course.current_program_documents || []).map((item) => `<li><a href="${esc(item.url)}" target="_blank" rel="noopener noreferrer">${esc(item.title)}</a></li>`).join('')}</ul>
          </div>
          <div class="curriculum-resource-card">
            <h3>Study vault</h3>
            <p class="curriculum-help">Quick links to the main pages that support readiness, progression, and answer review.</p>
            <ul class="curriculum-inline-list">${(course.study_vault || []).map((item) => `<li><a href="${esc(item.url)}">${esc(item.title)}</a></li>`).join('')}</ul>
          </div>
        </div>
        <div class="curriculum-grid two" style="margin-top:18px;">
          <div class="curriculum-resource-card">
            <h3>Previous program materials</h3>
            ${(course.previous_programs || []).length ? `<table class="curriculum-table"><thead><tr><th>Program</th><th>Review links</th></tr></thead><tbody>${course.previous_programs.map((item) => `<tr><td>${esc(item.title)}</td><td><a href="${esc(item.site_home)}">Home</a> · <a href="${esc(item.weeks)}">Weeks</a> · <a href="${esc(item.schoolmaster)}">Schoolmaster</a></td></tr>`).join('')}</tbody></table>` : '<div class="curriculum-empty">This is the first program in the current progression path, so there are no earlier program materials to unlock.</div>'}
          </div>
          <div class="curriculum-resource-card">
            <h3>Governance & policy documents</h3>
            <ul class="curriculum-inline-list">${(course.governance_documents || []).map((item) => `<li><a href="${esc(item.url)}" target="_blank" rel="noopener noreferrer">${esc(item.title)}</a></li>`).join('')}</ul>
          </div>
        </div>
        <div class="curriculum-resource-card" style="margin-top:18px;">
          <h3>Schoolmaster grading & forms</h3>
          <p class="curriculum-help">These forms support recordkeeping, oral review, final evaluation, and retest administration.</p>
          <ul class="curriculum-inline-list">${(course.schoolmaster_documents || []).map((item) => `<li><a href="${esc(item.url)}" target="_blank" rel="noopener noreferrer">${esc(item.title)}</a></li>`).join('')}</ul>
        </div>
      </div>
    `;
  }

  async function renderProgressPage(container, slug) {
    ensureStyle();
    const course = await apiGet(`/api/assessment/${slug}/course`);
    const profile = loadProfile();
    if (!profile.studentEmail || !profile.studentName) {
      renderProfileForm(container, course, () => renderProgressPage(container, slug), 'Save a learner profile to load progress.');
      return;
    }
    const progress = await apiGet(`/api/assessment/${slug}/progress?studentName=${encodeURIComponent(profile.studentName)}&studentEmail=${encodeURIComponent(profile.studentEmail)}`);
    container.innerHTML = `
      <div class="curriculum-shell">
        <div class="curriculum-summary-card">
          <h2>${esc(course.title)} Progress Tracker</h2>
          <p class="curriculum-help">Weekly progression unlocks only after the previous week is passed. Failed quizzes remain reviewable, but answers cannot be changed. A schoolmaster may approve a retest when needed.</p>
          <div class="curriculum-metrics">
            <div class="curriculum-metric"><span class="curriculum-note">Learner</span><strong>${esc(profile.studentName)}</strong></div>
            <div class="curriculum-metric"><span class="curriculum-note">Completion</span><strong>${progress.completion}%</strong></div>
            <div class="curriculum-metric"><span class="curriculum-note">Weeks passed</span><strong>${progress.passedCount}/${progress.totalWeeks}</strong></div>
            <div class="curriculum-metric"><span class="curriculum-note">Next action</span><strong>${progress.nextActionWeek || 'Complete'}</strong></div>
          </div>
        </div>
        <div class="curriculum-resource-card">
          <table class="curriculum-table">
            <thead><tr><th>Week</th><th>Status</th><th>Attempts</th><th>Latest score</th><th>Action</th></tr></thead>
            <tbody>
              ${progress.weeks.map((item) => `<tr><td>${esc(item.weekTitle)}</td><td>${statusBadge(item.status)}</td><td>${item.attempts}</td><td>${item.latestSubmission ? `${item.latestSubmission.score}%` : '—'}</td><td><a href="/programs/${slug}/site/assessment/index.html?week=${item.weekNumber}">Open</a></td></tr>`).join('')}
            </tbody>
          </table>
        </div>
      </div>
    `;
  }

  async function renderSchoolmasterDashboard(host, slug) {
    ensureStyle();
    const wrapper = document.createElement('section');
    wrapper.className = 'section';
    wrapper.innerHTML = `<div class="container"><div class="curriculum-dashboard" id="schoolmaster-dashboard"><h2>Submission records &amp; controls</h2><div class="curriculum-help">Loading…</div></div></div>`;
    host.appendChild(wrapper);
    const dashboard = wrapper.querySelector('#schoolmaster-dashboard');

    async function refresh(message = '') {
      const records = await apiGet(`/api/assessment/schoolmaster/${slug}/records`);

      const pendingUnlockRows = (records.pendingUnlocks || []).map((item) =>
        `<tr>
          <td>${esc(item.studentName)}<div class="curriculum-help">${esc(item.studentEmail)}</div></td>
          <td>Week ${item.weekNumber} — ${esc(item.weekTitle)}</td>
          <td><button class="curriculum-button primary unlock-btn"
            data-student-name="${esc(item.studentName)}"
            data-student-email="${esc(item.studentEmail)}"
            data-week-number="${item.weekNumber}">Approve unlock</button></td>
        </tr>`
      ).join('');

      dashboard.innerHTML = `
        <h2>${esc(records.title)} · Submission records</h2>
        ${message ? `<div class="curriculum-badge passed">${esc(message)}</div>` : ''}
        ${(records.pendingUnlocks || []).length ? `
        <div class="curriculum-record-card" style="margin-top:14px; border-left:4px solid #b8941a;">
          <h3>⚠ Pending unlock approvals</h3>
          <p class="curriculum-help">These students have passed a week and are waiting for Schoolmaster progression approval.</p>
          <table class="curriculum-table"><thead><tr><th>Student</th><th>Week passed</th><th>Action</th></tr></thead><tbody>${pendingUnlockRows}</tbody></table>
        </div>` : ''}
        <div class="curriculum-grid two" style="margin-top:18px;">
          <div class="curriculum-record-card">
            <h3>Approve next-week unlock</h3>
            <p class="curriculum-help">After a student passes a week, use this form to unlock their progression to the next week.</p>
            <form id="unlock-form" class="curriculum-form-grid">
              <div class="curriculum-field"><label>Student name</label><input name="studentName" required /></div>
              <div class="curriculum-field"><label>Student email</label><input type="email" name="studentEmail" required /></div>
              <div class="curriculum-field"><label>Week number (the week they passed)</label><input type="number" min="1" name="weekNumber" required /></div>
              <div class="curriculum-field"><label>Approved by</label><input name="approvedBy" value="Schoolmaster" required /></div>
              <div class="curriculum-field"><label>Note (optional)</label><textarea name="note" placeholder="Notes on review, oral discussion, etc."></textarea></div>
              <div class="curriculum-actions"><button class="curriculum-button primary" type="submit">Approve progression unlock</button></div>
            </form>
          </div>
          <div class="curriculum-record-card">
            <h3>Recent unlock approvals</h3>
            ${(records.unlockApprovals || []).length ? records.unlockApprovals.slice(0, 8).map((item) => `<div class="curriculum-question"><strong>${esc(item.studentName)}</strong> · Week ${item.weekNumber}<div class="curriculum-help">${esc(item.studentEmail)} · ${esc(item.approvedBy)} · ${esc(new Date(item.approvedAt).toLocaleString())}</div><div class="curriculum-help">${esc(item.note || 'No note provided')}</div></div>`).join('') : '<div class="curriculum-empty">No unlock approvals yet.</div>'}
          </div>
        </div>
        <div class="curriculum-grid two" style="margin-top:18px;">
          <div class="curriculum-record-card">
            <h3>Approve retest</h3>
            <p class="curriculum-help">Allow a student to retake a week they have already attempted and failed.</p>
            <form id="retest-form" class="curriculum-form-grid">
              <div class="curriculum-field"><label>Student name</label><input name="studentName" required /></div>
              <div class="curriculum-field"><label>Student email</label><input type="email" name="studentEmail" required /></div>
              <div class="curriculum-field"><label>Week number</label><input type="number" min="1" name="weekNumber" required /></div>
              <div class="curriculum-field"><label>Approved by</label><input name="approvedBy" value="Schoolmaster" required /></div>
              <div class="curriculum-field"><label>Note</label><textarea name="note" placeholder="Reason for retest approval"></textarea></div>
              <div class="curriculum-actions"><button class="curriculum-button primary" type="submit">Approve retest</button></div>
            </form>
          </div>
          <div class="curriculum-record-card">
            <h3>Latest retest approvals</h3>
            ${(records.retestApprovals || []).length ? records.retestApprovals.slice(0, 8).map((item) => `<div class="curriculum-question"><strong>${esc(item.studentName)}</strong> · Week ${item.weekNumber}<div class="curriculum-help">${esc(item.studentEmail)} · ${esc(item.approvedBy)} · ${esc(new Date(item.approvedAt).toLocaleString())}</div><div class="curriculum-help">${esc(item.note || 'No note provided')}</div></div>`).join('') : '<div class="curriculum-empty">No retest approvals yet.</div>'}
          </div>
        </div>
        <div class="curriculum-record-card" style="margin-top:18px;">
          <h3>Recent submissions</h3>
          ${(records.submissions || []).length ? `<table class="curriculum-table"><thead><tr><th>Student</th><th>Week</th><th>Score</th><th>Status</th><th>Submitted</th></tr></thead><tbody>${records.submissions.slice(0, 20).map((item) => `<tr><td>${esc(item.studentName)}<div class="curriculum-help">${esc(item.studentEmail)}</div></td><td>${esc(item.weekTitle)}</td><td>${item.score}%</td><td>${statusBadge(item.passed ? 'passed' : 'failed')}</td><td>${esc(new Date(item.submittedAt).toLocaleString())}</td></tr>`).join('')}</tbody></table>` : '<div class="curriculum-empty">No submissions recorded yet.</div>'}
        </div>
      `;

      dashboard.querySelectorAll('.unlock-btn').forEach((btn) => {
        btn.addEventListener('click', async () => {
          btn.disabled = true;
          try {
            await apiPost(`/api/assessment/schoolmaster/${slug}/unlock`, {
              studentName: btn.dataset.studentName,
              studentEmail: btn.dataset.studentEmail,
              weekNumber: Number(btn.dataset.weekNumber),
              approvedBy: 'Schoolmaster',
              note: 'Approved via dashboard quick-action'
            });
            await refresh('Progression unlock approved.');
          } catch (error) {
            await refresh(error.message);
          }
        });
      });

      dashboard.querySelector('#unlock-form').addEventListener('submit', async (event) => {
        event.preventDefault();
        const form = new FormData(event.currentTarget);
        try {
          await apiPost(`/api/assessment/schoolmaster/${slug}/unlock`, {
            studentName: String(form.get('studentName') || '').trim(),
            studentEmail: String(form.get('studentEmail') || '').trim().toLowerCase(),
            weekNumber: Number(form.get('weekNumber')),
            approvedBy: String(form.get('approvedBy') || '').trim(),
            note: String(form.get('note') || '').trim()
          });
          await refresh('Progression unlock approved successfully.');
        } catch (error) {
          await refresh(error.message);
        }
      });

      dashboard.querySelector('#retest-form').addEventListener('submit', async (event) => {
        event.preventDefault();
        const form = new FormData(event.currentTarget);
        try {
          await apiPost(`/api/assessment/schoolmaster/${slug}/retest`, {
            studentName: String(form.get('studentName') || '').trim(),
            studentEmail: String(form.get('studentEmail') || '').trim().toLowerCase(),
            weekNumber: Number(form.get('weekNumber')),
            approvedBy: String(form.get('approvedBy') || '').trim(),
            note: String(form.get('note') || '').trim()
          });
          await refresh('Retest approved successfully.');
        } catch (error) {
          await refresh(error.message);
        }
      });
    }

    refresh();
  }

  async function renderLibraryIndex() {
    const host = document.getElementById('library-app');
    if (!host) return;
    ensureStyle();
    const response = await apiGet('/api/assessment/library');
    const library = response.library || {};
    host.innerHTML = `
      <div class="curriculum-shell">
        <div class="curriculum-grid three">
          <div class="curriculum-resource-card"><h3>Governance</h3><ul class="curriculum-inline-list">${(library.governance || []).map((item) => `<li><a href="${esc(item.url)}" target="_blank" rel="noopener noreferrer">${esc(item.title)}</a></li>`).join('')}</ul></div>
          <div class="curriculum-resource-card"><h3>Schoolmaster</h3><ul class="curriculum-inline-list">${(library.schoolmaster || []).map((item) => `<li><a href="${esc(item.url)}" target="_blank" rel="noopener noreferrer">${esc(item.title)}</a></li>`).join('')}</ul></div>
          <div class="curriculum-resource-card"><h3>Uploaded extras</h3><ul class="curriculum-inline-list">${(library.uploads || []).map((item) => `<li><a href="${esc(item.url)}" target="_blank" rel="noopener noreferrer">${esc(item.title)}</a></li>`).join('')}</ul></div>
        </div>
      </div>
    `;
  }

  async function bootCurriculumPage() {
    addProgramLinks();
    const app = document.getElementById('curriculum-app');
    const slug = app ? app.dataset.program : getProgramSlugFromPath();
    const page = app ? app.dataset.page : null;
    if (app && slug && page === 'assessment') {
      await renderAssessmentPage(app, slug);
    }
    if (app && slug && page === 'materials') {
      await renderMaterialsPage(app, slug);
    }
    if (app && slug && page === 'progress') {
      await renderProgressPage(app, slug);
    }
    if (!document.querySelector('[data-schoolmaster-dashboard]') && window.location.pathname.includes('/schoolmaster/') && slug) {
      const host = document.body;
      const marker = document.createElement('div');
      marker.setAttribute('data-schoolmaster-dashboard', 'true');
      host.appendChild(marker);
      await renderSchoolmasterDashboard(marker, slug);
    }
    await renderLibraryIndex();
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', bootCurriculumPage, { once: true });
  } else {
    bootCurriculumPage();
  }
})();
