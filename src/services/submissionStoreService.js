const fs = require('fs');
const path = require('path');
const crypto = require('crypto');
const { getProgramCourse, getProgramWeek } = require('./fullCurriculumService');
const { DATA_DIR, SUBMISSIONS_FILE } = require('../config/dataPaths');

const dataDir   = DATA_DIR;
const storePath = SUBMISSIONS_FILE;

// ── Auto-retest cooldown: 24 hours after a failed attempt ──
// Students do NOT need Schoolmaster approval to retest.  After failing they
// must wait 24 hours (RETEST_COOLDOWN_MS), then the exam form unlocks
// automatically.
// ── Week progression ──
// Students do NOT need Schoolmaster approval to advance to the next week.
// Passing an exam automatically unlocks the next week — no unlock approval required.
const RETEST_COOLDOWN_MS = 24 * 60 * 60 * 1000; // 24 hours in milliseconds

function ensureStore() {
  fs.mkdirSync(dataDir, { recursive: true });
  if (!fs.existsSync(storePath)) {
    fs.writeFileSync(storePath, JSON.stringify({ submissions: [], retestApprovals: [], unlockApprovals: [] }, null, 2));
  }
}

function readStore() {
  ensureStore();
  const raw = JSON.parse(fs.readFileSync(storePath, 'utf8'));
  // Back-compat: ensure unlockApprovals array exists on older store files
  if (!raw.unlockApprovals) raw.unlockApprovals = [];
  return raw;
}

function writeStore(store) {
  ensureStore();
  fs.writeFileSync(storePath, JSON.stringify(store, null, 2));
}

function studentKey(name = '', email = '') {
  const normalizedEmail = String(email || '').trim().toLowerCase();
  if (normalizedEmail) return normalizedEmail;
  const normalizedName = String(name || '').trim().toLowerCase().replace(/\s+/g, '-');
  return normalizedName;
}

function getStudentSubmissions(store, slug, studentId) {
  return store.submissions
    .filter((item) => item.slug === slug && item.studentId === studentId)
    .sort((a, b) => {
      const aTime = new Date(a.submittedAt).getTime();
      const bTime = new Date(b.submittedAt).getTime();
      return aTime - bTime;
    });
}

function getLatestSubmissionForWeek(submissions, weekNumber) {
  const matches = submissions.filter((item) => Number(item.weekNumber) === Number(weekNumber));
  return matches.length ? matches[matches.length - 1] : null;
}

// Kept for back-compat (approveUnlock still uses it; approveRetest no longer
// guards submission access but is kept so old SM dashboard calls don't break).
function getUnusedApproval(store, slug, studentId, weekNumber) {
  return store.retestApprovals.find(
    (item) =>
      item.slug === slug &&
      item.studentId === studentId &&
      Number(item.weekNumber) === Number(weekNumber) &&
      !item.usedAt
  ) || null;
}

// Returns the first unused unlock approval for a given week.
// An unlock approval is created by the Schoolmaster after a student passes a week,
// and it allows the NEXT week to become available.
function getUnusedUnlockApproval(store, slug, studentId, weekNumber) {
  return (store.unlockApprovals || []).find(
    (item) =>
      item.slug === slug &&
      item.studentId === studentId &&
      Number(item.weekNumber) === Number(weekNumber) &&
      !item.usedAt
  ) || null;
}

// Returns true when the 24-hour cooldown has elapsed since the latest failed
// submission for a given week.  If the latest attempt passed, or there is no
// attempt yet, returns true (no cooldown in effect).
function retestAvailable(latestFailedSub) {
  if (!latestFailedSub || latestFailedSub.passed !== false) return true;
  const elapsed = Date.now() - new Date(latestFailedSub.submittedAt).getTime();
  return elapsed >= RETEST_COOLDOWN_MS;
}

function scoreQuiz(week, answers) {
  const review = week.quiz_questions.map((question, index) => {
    const submitted = String(answers[index] || '').trim().toUpperCase();
    const correct = String(question.correct_option || '').trim().toUpperCase();
    return {
      questionNumber: index + 1,
      prompt: question.prompt,
      submittedAnswer: submitted,
      submittedText: (question.choices.find((choice) => choice.option === submitted) || {}).text || '',
      correctAnswer: correct,
      correctText: question.correct_text,
      explanation: question.explanation,
      isCorrect: submitted === correct
    };
  });
  const correctCount = review.filter((item) => item.isCorrect).length;
  const score = Math.round((correctCount / week.quiz_questions.length) * 100);
  return { score, correctCount, totalQuestions: week.quiz_questions.length, review };
}

function getStudentProgress(slug, studentName, studentEmail) {
  const course = getProgramCourse(slug);
  if (!course) {
    throw new Error('Program not found');
  }
  const store = readStore();
  const studentId = studentKey(studentName, studentEmail);
  const submissions = getStudentSubmissions(store, slug, studentId);
  const progressWeeks = [];
  let unlocked = true;
  let passedCount = 0;

  for (const [weekIdx, week] of course.weeks.entries()) {
    // Use explicit week_number when present; fall back to 1-based position index
    const effectiveWeekNum = (week.week_number != null) ? week.week_number : (weekIdx + 1);
    const latest = getLatestSubmissionForWeek(submissions, effectiveWeekNum);
    const passed = submissions.some(
      (item) => Number(item.weekNumber) === Number(effectiveWeekNum) && item.passed
    );
    const unlockApproval = getUnusedUnlockApproval(store, slug, studentId, effectiveWeekNum);
    const attempts = submissions.filter((item) => Number(item.weekNumber) === Number(effectiveWeekNum)).length;
    let status = 'locked';

    // Compute retest availability for failed weeks
    let retestAvailableAt = null;
    if (latest && latest.passed === false) {
      const failedAt = new Date(latest.submittedAt).getTime();
      retestAvailableAt = new Date(failedAt + RETEST_COOLDOWN_MS).toISOString();
    }
    const canRetest = retestAvailable(latest && !latest.passed ? latest : null);

    if (passed) {
      // Week is passed — next week opens automatically, no SM approval required.
      status = 'passed';
      passedCount += 1;
    } else if (latest && latest.passed === false) {
      // Auto-retest: no SM approval needed.
      // 'retest_cooldown' = failed, 24hr not yet elapsed (exam form locked)
      // 'retest_ready'    = failed, 24hr elapsed (exam form shown again)
      status = canRetest ? 'retest_ready' : 'retest_cooldown';
    } else if (unlocked) {
      status = 'available';
    }

    progressWeeks.push({
      weekNumber: effectiveWeekNum,
      weekTitle: week.week_title,
      status,
      attempts,
      latestSubmission: latest,
      retestAvailableAt,   // ISO timestamp when retest unlocks (null if not applicable)
      unlockApproval,
      passingScore: week.passing_score || 70
    });

    // A passed week automatically unlocks the next week (no SM approval required).
    unlocked = passed;
  }

  const nextWeek = progressWeeks.find(
    (week) => week.status === 'available' || week.status === 'retest_ready'
  );
  const completion = Math.round((passedCount / course.weeks.length) * 100);

  return {
    studentId,
    studentName,
    studentEmail,
    program: { slug: course.slug, title: course.title },
    completion,
    passedCount,
    totalWeeks: course.weeks.length,
    nextActionWeek: nextWeek ? nextWeek.weekNumber : null,
    weeks: progressWeeks
  };
}

function submitWeekWork(slug, payload) {
  const course = getProgramCourse(slug);
  if (!course) {
    throw new Error('Program not found');
  }
  const week = getProgramWeek(slug, payload.weekNumber);
  if (!week) {
    throw new Error('Week not found');
  }

  const studentName = String(payload.studentName || '').trim();
  const studentEmail = String(payload.studentEmail || '').trim().toLowerCase();
  const answers = Array.isArray(payload.answers) ? payload.answers : [];
  const discussionAnswers = Array.isArray(payload.discussionAnswers) ? payload.discussionAnswers : [];
  if (!studentName || !studentEmail) {
    throw new Error('Student name and email are required');
  }
  if (answers.length !== week.quiz_questions.length) {
    throw new Error(`Exactly ${week.quiz_questions.length} quiz answers are required`);
  }

  // Resolve the effective week number (explicit field or positional fallback)
  const weekIdx = course.weeks.indexOf(week);
  const effectiveWeekNum = (week.week_number != null) ? Number(week.week_number) : (weekIdx + 1);

  const store = readStore();
  const studentId = studentKey(studentName, studentEmail);
  const submissions = getStudentSubmissions(store, slug, studentId);

  // Progression gate: every prior week must be passed before the student
  // can submit the current week. No SM unlock approval needed.
  const priorWeeks = course.weeks
    .map((w, i) => ({ w, effNum: (w.week_number != null) ? Number(w.week_number) : (i + 1) }))
    .filter(({ effNum }) => effNum < effectiveWeekNum);

  const missingPriorPass = priorWeeks.find(
    ({ w, effNum }) => !submissions.some(
      (item) => Number(item.weekNumber) === effNum && item.passed
    )
  );
  if (missingPriorPass) {
    throw new Error(`Progression is locked until ${missingPriorPass.w.week_title || `Week ${missingPriorPass.effNum}`} is passed`);
  }

  const alreadyPassed = submissions.some(
    (item) => Number(item.weekNumber) === effectiveWeekNum && item.passed
  );
  if (alreadyPassed) {
    throw new Error('This week is already passed and cannot be changed');
  }

  // Auto-retest gate: if the latest attempt failed, the student must wait
  // 24 hours before submitting again.  No SM approval needed.
  const latestAttempt = getLatestSubmissionForWeek(submissions, effectiveWeekNum);
  if (latestAttempt && latestAttempt.passed === false) {
    if (!retestAvailable(latestAttempt)) {
      const availableAt = new Date(new Date(latestAttempt.submittedAt).getTime() + RETEST_COOLDOWN_MS);
      const hoursLeft = Math.ceil((availableAt.getTime() - Date.now()) / (60 * 60 * 1000));
      throw new Error(
        `Retest not yet available. You may retry in approximately ${hoursLeft} hour${hoursLeft !== 1 ? 's' : ''}. ` +
        `Retest opens: ${availableAt.toLocaleString()}`
      );
    }
  }

  const graded = scoreQuiz(week, answers);
  const passed = graded.score >= Number(week.passing_score || 70);
  const submission = {
    id: crypto.randomUUID(),
    slug,
    studentId,
    studentName,
    studentEmail,
    weekNumber: effectiveWeekNum,
    weekTitle: week.week_title,
    submittedAt: new Date().toISOString(),
    answers: answers.map((value) => String(value || '').trim().toUpperCase()),
    discussionAnswers: discussionAnswers.map((value) => String(value || '').trim()),
    score: graded.score,
    correctCount: graded.correctCount,
    totalQuestions: graded.totalQuestions,
    passed,
    passingScore: Number(week.passing_score || 70),
    review: graded.review
  };

  store.submissions.push(submission);
  writeStore(store);

  return {
    submission,
    progress: getStudentProgress(slug, studentName, studentEmail)
  };
}

// approveRetest: kept for back-compat — the SM dashboard may still call this
// for legacy examSubmissions.  In the new auto-retest system, this function
// is no longer required for program-hub exam submissions.
function approveRetest(slug, payload) {
  const course = getProgramCourse(slug);
  if (!course) {
    throw new Error('Program not found');
  }
  const week = getProgramWeek(slug, payload.weekNumber);
  if (!week) {
    throw new Error('Week not found');
  }

  const approvedBy = String(payload.approvedBy || 'Schoolmaster').trim();
  const note = String(payload.note || '').trim();

  const store = readStore();

  // Accept pre-resolved studentId (from SM dashboard curriculumExams) or derive from name+email
  let studentId, studentName, studentEmail;
  if (payload.studentId) {
    studentId = String(payload.studentId).trim();
    const match = store.submissions.find(s => s.studentId === studentId && s.slug === slug);
    studentName  = match ? match.studentName  : (payload.studentName  || studentId);
    studentEmail = match ? match.studentEmail : (payload.studentEmail || '');
  } else {
    studentName  = String(payload.studentName  || '').trim();
    studentEmail = String(payload.studentEmail || '').trim().toLowerCase();
    if (!studentName || !studentEmail) {
      throw new Error('Student name and email are required (or pass studentId)');
    }
    studentId = studentKey(studentName, studentEmail);
  }

  // Resolve effective week number (positional fallback for programs with week_number: null)
  const weekIdx2 = course.weeks.indexOf(week);
  const effectiveWeekNum2 = (week.week_number != null) ? Number(week.week_number) : (weekIdx2 >= 0 ? weekIdx2 + 1 : Number(payload.weekNumber));
  const approval = {
    id: crypto.randomUUID(),
    slug,
    studentId,
    studentName,
    studentEmail,
    weekNumber: effectiveWeekNum2,
    weekTitle: week.week_title || `Week ${effectiveWeekNum2}`,
    approvedBy,
    note,
    approvedAt: new Date().toISOString(),
    usedAt: null,
    usedBySubmissionId: null
  };

  store.retestApprovals.push(approval);
  writeStore(store);
  return approval;
}

// approveUnlock: Schoolmaster grants progression from a passed week to the next.
// The student's week must already be passed (score >= passing_score).
// Once issued, this approval flips the week from 'pending_unlock' → 'passed'
// in the student's progress view and makes the next week 'available'.
function approveUnlock(slug, payload) {
  const course = getProgramCourse(slug);
  if (!course) {
    throw new Error('Program not found');
  }
  const week = getProgramWeek(slug, payload.weekNumber);
  if (!week) {
    throw new Error('Week not found');
  }

  const approvedBy = String(payload.approvedBy || 'Schoolmaster').trim();
  const note = String(payload.note || '').trim();

  const store = readStore();

  // The SM dashboard passes studentId directly (from the curriculumExams entry).
  // Fall back to deriving it from name+email for API callers that use the old shape.
  let studentId, studentName, studentEmail;
  if (payload.studentId) {
    // Preferred path: use the pre-resolved studentId and look up name/email from store
    studentId = String(payload.studentId).trim();
    const match = store.submissions.find(s => s.studentId === studentId && s.slug === slug);
    studentName  = match ? match.studentName  : (payload.studentName  || studentId);
    studentEmail = match ? match.studentEmail : (payload.studentEmail || '');
  } else {
    // Legacy path: derive from name + email (both required)
    studentName  = String(payload.studentName  || '').trim();
    studentEmail = String(payload.studentEmail || '').trim().toLowerCase();
    if (!studentName || !studentEmail) {
      throw new Error('Student name and email are required (or pass studentId)');
    }
    studentId = studentKey(studentName, studentEmail);
  }

  // Resolve effective week number (positional fallback for programs with week_number: null)
  const weekIdx3 = course.weeks.indexOf(week);
  const effectiveWeekNum3 = (week.week_number != null) ? Number(week.week_number) : (weekIdx3 >= 0 ? weekIdx3 + 1 : Number(payload.weekNumber));

  // Verify the student actually passed this week before issuing an unlock
  const passed = store.submissions.some(
    (item) =>
      item.slug === slug &&
      item.studentId === studentId &&
      Number(item.weekNumber) === effectiveWeekNum3 &&
      item.passed
  );
  if (!passed) {
    throw new Error('Student has not passed this week — unlock cannot be issued until the week is passed');
  }

  const unlockApproval = {
    id: crypto.randomUUID(),
    slug,
    studentId,
    studentName,
    studentEmail,
    weekNumber: effectiveWeekNum3,
    weekTitle: week.week_title || `Week ${effectiveWeekNum3}`,
    approvedBy,
    note,
    approvedAt: new Date().toISOString(),
    usedAt: null
  };

  store.unlockApprovals.push(unlockApproval);
  writeStore(store);
  return unlockApproval;
}

function getSchoolmasterRecords(slug) {
  const course = getProgramCourse(slug);
  if (!course) {
    throw new Error('Program not found');
  }
  const store = readStore();
  const submissions = store.submissions
    .filter((item) => item.slug === slug)
    .sort((a, b) => new Date(b.submittedAt).getTime() - new Date(a.submittedAt).getTime());
  const retestApprovals = store.retestApprovals
    .filter((item) => item.slug === slug)
    .sort((a, b) => new Date(b.approvedAt).getTime() - new Date(a.approvedAt).getTime());
  const unlockApprovals = (store.unlockApprovals || [])
    .filter((item) => item.slug === slug)
    .sort((a, b) => new Date(b.approvedAt).getTime() - new Date(a.approvedAt).getTime());

  // Build a list of students currently in pending_unlock so the dashboard can
  // surface them prominently.
  const studentIds = [...new Set(submissions.map((s) => s.studentId))];
  const pendingUnlocks = [];
  for (const studentId of studentIds) {
    const studentSubs = submissions.filter((s) => s.studentId === studentId);
    const studentName = studentSubs[0] ? studentSubs[0].studentName : studentId;
    const studentEmail = studentSubs[0] ? studentSubs[0].studentEmail : '';
    for (const [wIdx, week] of course.weeks.entries()) {
      // Positional fallback for programs whose weeks have no week_number field
      const effNum = (week.week_number != null) ? Number(week.week_number) : (wIdx + 1);
      const weekPassed = studentSubs.some(
        (s) => Number(s.weekNumber) === effNum && s.passed
      );
      if (!weekPassed) continue;
      const hasUnlock = (store.unlockApprovals || []).some(
        (u) =>
          u.slug === slug &&
          u.studentId === studentId &&
          Number(u.weekNumber) === effNum
      );
      if (!hasUnlock) {
        pendingUnlocks.push({
          studentId,
          studentName,
          studentEmail,
          weekNumber: effNum,
          weekTitle: week.week_title || `Week ${effNum}`
        });
      }
    }
  }

  return { slug, title: course.title, submissions, retestApprovals, unlockApprovals, pendingUnlocks };
}

function resetStore() {
  writeStore({ submissions: [], retestApprovals: [], unlockApprovals: [] });
}

module.exports = {
  readStore,
  writeStore,
  getStudentProgress,
  submitWeekWork,
  approveRetest,
  approveUnlock,
  getSchoolmasterRecords,
  resetStore,
  studentKey,
  RETEST_COOLDOWN_MS
};
