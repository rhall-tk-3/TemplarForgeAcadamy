const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('fs');
const path = require('path');
const { getProgramCourse } = require('../src/services/fullCurriculumService');
const { submitWeekWork, approveRetest, approveUnlock, getStudentProgress, resetStore } = require('../src/services/submissionStoreService');

const root = path.join(__dirname, '..');

test('full curriculum dataset exists and all weeks have quiz questions, discussion prompts, and a valid passing score', () => {
  const fullConfigPath = path.join(root, 'src', 'config', 'curriculum', 'full-program-curriculum.json');
  assert.ok(fs.existsSync(fullConfigPath), 'full curriculum JSON should exist');
  const course = getProgramCourse('knight');
  assert.ok(course, 'knight course should exist');
  for (const program of require(fullConfigPath).programs) {
    assert.ok(program.weeks.length >= 4, 'each program should have multiple weeks');
    for (const week of program.weeks) {
      // Each week must have at least 1 quiz question (standard weeks have 10, some may have fewer)
      assert.ok(
        Array.isArray(week.quiz_questions) && week.quiz_questions.length >= 1,
        `${program.slug} week ${week.week_number} should have at least 1 quiz question (got ${(week.quiz_questions || []).length})`
      );
      // Each week must have exactly 3 discussion questions
      assert.equal(
        week.discussion_questions.length,
        3,
        `${program.slug} week ${week.week_number} should have 3 discussion questions`
      );
      // passing_score must be a valid percentage (50–100)
      assert.ok(
        typeof week.passing_score === 'number' && week.passing_score >= 50 && week.passing_score <= 100,
        `${program.slug} week ${week.week_number} passing_score must be between 50 and 100 (got ${week.passing_score})`
      );
    }
  }
});

test('assessment workflow enforces pass progression, schoolmaster unlock gate, 24hr auto-retest cooldown', () => {
  resetStore();
  const course = getProgramCourse('knight');
  const week1 = course.weeks[0];
  const week2 = course.weeks[1];
  const student = { studentName: 'Patch Test User', studentEmail: 'patch@example.com' };

  // Pass week 1
  const correctAnswersWeek1 = week1.quiz_questions.map((question) => question.correct_option);
  const result1 = submitWeekWork('knight', {
    ...student,
    weekNumber: week1.week_number,
    answers: correctAnswersWeek1,
    discussionAnswers: week1.discussion_questions.map((_, index) => `Week 1 discussion ${index + 1}`)
  });
  assert.equal(result1.submission.passed, true);

  // Week 1 should now be in pending_unlock (passed but awaiting schoolmaster progression approval)
  const progressAfterPass = getStudentProgress('knight', student.studentName, student.studentEmail);
  const week1Status = progressAfterPass.weeks.find((w) => Number(w.weekNumber) === Number(week1.week_number));
  assert.equal(week1Status.status, 'pending_unlock', 'Week 1 should be pending_unlock after passing (awaiting schoolmaster)');

  // Attempting week 2 before schoolmaster unlock should throw
  assert.throws(() => submitWeekWork('knight', {
    ...student,
    weekNumber: week2.week_number,
    answers: week2.quiz_questions.map(() => 'A'),
    discussionAnswers: week2.discussion_questions.map((_, i) => `Attempt before unlock ${i + 1}`)
  }), 'Should reject submission when prior week has no unlock approval');

  // Schoolmaster approves the unlock for week 1 (progression gate — still required)
  approveUnlock('knight', {
    ...student,
    weekNumber: week1.week_number,
    approvedBy: 'Schoolmaster',
    note: 'Progression approved after review.'
  });

  // Week 1 should now show as passed, week 2 should be available
  const progressAfterUnlock = getStudentProgress('knight', student.studentName, student.studentEmail);
  const week1StatusAfterUnlock = progressAfterUnlock.weeks.find((w) => Number(w.weekNumber) === Number(week1.week_number));
  assert.equal(week1StatusAfterUnlock.status, 'passed', 'Week 1 should be passed after schoolmaster unlock');

  // Now attempt week 2 and fail it
  const wrongAnswersWeek2 = week2.quiz_questions.map(() => 'A');
  const result2 = submitWeekWork('knight', {
    ...student,
    weekNumber: week2.week_number,
    answers: wrongAnswersWeek2,
    discussionAnswers: week2.discussion_questions.map((_, index) => `Week 2 discussion ${index + 1}`)
  });
  assert.equal(result2.submission.passed, false);

  // ── Auto-retest: no SM approval needed, but 24hr cooldown applies ──

  // Progress should show week 2 as 'retest_cooldown' immediately after failure
  const progressAfterFail = getStudentProgress('knight', student.studentName, student.studentEmail);
  const week2Status = progressAfterFail.weeks.find((w) => Number(w.weekNumber) === Number(week2.week_number));
  assert.equal(week2Status.status, 'retest_cooldown', 'Week 2 should be retest_cooldown immediately after failure (24hr not elapsed)');
  assert.ok(week2Status.retestAvailableAt, 'retestAvailableAt should be set on a failed week');
  const retestAt = new Date(week2Status.retestAvailableAt).getTime();
  assert.ok(retestAt > Date.now(), 'retestAvailableAt should be in the future (cooldown not yet elapsed)');

  // Retry within 24hr should throw with cooldown message — no SM approval bypasses this
  let cooldownError;
  assert.throws(() => {
    try {
      submitWeekWork('knight', {
        ...student,
        weekNumber: week2.week_number,
        answers: week2.quiz_questions.map((question) => question.correct_option),
        discussionAnswers: week2.discussion_questions.map((_, index) => `Retry discussion ${index + 1}`)
      });
    } catch (err) {
      cooldownError = err;
      throw err;
    }
  }, 'Should throw 24hr cooldown error when retesting within 24 hours');
  assert.ok(cooldownError.message.includes('Retest not yet available'), `Cooldown error should mention "Retest not yet available" — got: "${cooldownError.message}"`);
  assert.ok(cooldownError.message.includes('hour'), `Cooldown error should mention hours remaining — got: "${cooldownError.message}"`);

  // approveRetest() is kept for back-compat (legacy system) but does NOT
  // bypass the 24hr cooldown for curriculum-based exam submissions.
  // Calling it should not cause an error, but it won't unblock the submission.
  assert.doesNotThrow(() => approveRetest('knight', {
    ...student,
    weekNumber: week2.week_number,
    approvedBy: 'Schoolmaster',
    note: 'Legacy retest approval — has no effect on auto-retest cooldown.'
  }), 'approveRetest() should not throw (back-compat kept)');

  // Submission is STILL blocked even after approveRetest() — cooldown is the gate now
  assert.throws(() => submitWeekWork('knight', {
    ...student,
    weekNumber: week2.week_number,
    answers: week2.quiz_questions.map((question) => question.correct_option),
    discussionAnswers: week2.discussion_questions.map((_, index) => `Post-approve retry ${index + 1}`)
  }), 'approveRetest() should not bypass the 24hr auto-retest cooldown');

  const progress = getStudentProgress('knight', student.studentName, student.studentEmail);
  assert.equal(progress.passedCount >= 1, true, 'At least week 1 should be counted as passed');
  resetStore();
});

test('generated curriculum pages and assets exist', () => {
  const checks = [
    'public/assets/curriculum-portal.js',
    'public/assets/curriculum-portal.css',
    'public/library/index.html',
    'public/programs/knight/site/assessment/index.html',
    'public/programs/commander/site/materials/index.html',
    'public/programs/levie/site/progress/index.html'
  ];
  for (const rel of checks) {
    assert.ok(fs.existsSync(path.join(root, rel)), `${rel} should exist`);
  }
});
