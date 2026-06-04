/**
 * Progression API
 *
 * Member-facing:
 *   GET  /api/progression/me/discussion-weeks  — all weeks + questions + submission status
 *   POST /api/progression/me/exam       — submit exam answers for review
 *
 * Admin (Schoolmaster) only:
 *   GET  /api/progression/members            — all members + progress
 *   GET  /api/progression/member/:id         — single member full record
 *   POST /api/progression/member/:id/assign  — assign a program
 *   POST /api/progression/member/:id/advance — manually advance week
 *   POST /api/progression/member/:id/exam/:examIdx/review — grade an exam submission
 *   POST /api/progression/member/:id/note    — add a schoolmaster note
 *   POST /api/progression/member/:id/complete — mark program complete, optionally assign next
 *   POST /api/progression/member/:id/unlock      — grant access to a program
 *   POST /api/progression/member/:id/lock        — revoke access to a program
 *   POST /api/progression/member/:id/unlock-all  — grant access to all programs
 *   POST /api/progression/member/:id/lock-all    — clear all program overrides
 *   POST /api/progression/member/:id/rank    — assign formal rank + optional display name
 *   POST /api/progression/member/:id/status  — set programStatus: active | paused
 *   DELETE /api/progression/member/:id       — permanently delete member account
 */

const express  = require('express');
const fs       = require('fs');
const { findById, updateUser, deleteUser, getMemberUsers, safeUser } = require('./userStore');
const { ACCOUNTS_FILE, SUBMISSIONS_FILE, DELETED_IDS_FILE } = require('../config/dataPaths');
const { getCurriculumIndex } = require('../services/curriculumService');
const { getLessonForWeek, getLessonProgram } = require('../services/lessonService');
const { readStore, studentKey } = require('../services/submissionStoreService');
const { sendCertificate }    = require('../services/certificateService');

const { hydrateSessionFromJwt } = require('../config/jwtSession');

const router = express.Router();

// ── Overdue threshold: more than 2 weeks (in ms) on a single week ──
const OVERDUE_MS = 14 * 24 * 60 * 60 * 1000; // 14 days

// ── Guards ──
// Both guards hydrate from JWT first so Railway restarts (which wipe the
// in-memory express-session store) don't break authenticated requests.
function requireMember(req, res, next) {
  hydrateSessionFromJwt(req);
  if (!req.session.userId) return res.status(401).json({ error: 'Not signed in.' });
  next();
}
function requireAdmin(req, res, next) {
  hydrateSessionFromJwt(req);
  if (!req.session.userId) return res.status(401).json({ error: 'Not signed in.' });
  if (req.session.role !== 'admin') return res.status(403).json({ error: 'Schoolmaster access required.' });
  next();
}

// ─────────────────────────────────────────
//  MEMBER ROUTES
// ─────────────────────────────────────────

// GET /api/progression/me
router.get('/me', requireMember, (req, res) => {
  const user = findById(req.session.userId);
  if (!user) return res.status(401).json({ error: 'Session expired.' });
  res.json(buildProgressView(user));
});

// POST /api/progression/me/exam  { programSlug, week, answers: [{ question, answer }] }
router.post('/me/exam', requireMember, (req, res) => {
  const user = findById(req.session.userId);
  if (!user) return res.status(401).json({ error: 'Session expired.' });

  const { programSlug, week, answers } = req.body;
  if (!programSlug || !week || !Array.isArray(answers)) {
    return res.status(400).json({ error: 'programSlug, week, and answers[] are required.' });
  }

  const submission = {
    programSlug,
    week:        Number(week),
    answers,
    submittedAt: new Date().toISOString(),
    reviewedAt:  null,
    grade:       null,
    notes:       null
  };

  const submissions = [...(user.examSubmissions || []), submission];
  updateUser(user.id, { examSubmissions: submissions });

  res.json({ ok: true, message: 'Exam submitted. Awaiting Schoolmaster review.' });
});

// ─────────────────────────────────────────
//  READING LOG ROUTES
// ─────────────────────────────────────────

// GET /api/progression/me/reading-log
// Returns all reading log entries for the signed-in member.
router.get('/me/reading-log', requireMember, (req, res) => {
  const user = findById(req.session.userId);
  if (!user) return res.status(401).json({ error: 'Session expired.' });
  res.json({ entries: user.readingLog || [] });
});

// POST /api/progression/me/reading-log
// Add a new reading log entry.
// Body: { week, title, author, pages, notes }
router.post('/me/reading-log', requireMember, (req, res) => {
  const user = findById(req.session.userId);
  if (!user) return res.status(401).json({ error: 'Session expired.' });

  const { week, title, author, pages, notes } = req.body;
  if (!title || !title.trim()) {
    return res.status(400).json({ error: 'Reading title is required.' });
  }

  const entry = {
    id:          Date.now(),
    week:        week ? Number(week) : (user.currentWeek || null),
    programSlug: user.assignedProgram || null,
    title:       title.trim(),
    author:      (author || '').trim(),
    pages:       (pages || '').trim(),
    notes:       (notes || '').trim(),
    loggedAt:    new Date().toISOString()
  };

  const log = [...(user.readingLog || []), entry];
  updateUser(user.id, { readingLog: log });
  res.json({ ok: true, entry });
});

// DELETE /api/progression/me/reading-log/:id
// Remove a reading log entry by its id.
router.delete('/me/reading-log/:id', requireMember, (req, res) => {
  const user = findById(req.session.userId);
  if (!user) return res.status(401).json({ error: 'Session expired.' });

  const entryId = Number(req.params.id);
  const log = (user.readingLog || []).filter(e => e.id !== entryId);
  updateUser(user.id, { readingLog: log });
  res.json({ ok: true });
});

// ─────────────────────────────────────────
//  LESSON VIEWER ROUTES
// ─────────────────────────────────────────

// GET /api/progression/me/lesson
// Returns the current week's lesson for the signed-in member.
router.get('/me/lesson', requireMember, (req, res) => {
  const user = findById(req.session.userId);
  if (!user) return res.status(401).json({ error: 'Session expired.' });

  if (!user.assignedProgram || !user.currentWeek) {
    return res.status(404).json({ error: 'No program currently assigned.' });
  }

  const lesson = getLessonForWeek(user.assignedProgram, user.currentWeek);
  if (!lesson) {
    return res.status(404).json({ error: 'Lesson content not found for this week.' });
  }

  res.json({
    lesson,
    programSlug:   user.assignedProgram,
    week:          user.currentWeek,
    programStatus: user.programStatus || 'active',
    statusNote:    user.statusNote    || null
  });
});

// GET /api/progression/me/lesson/:week  — read-ahead (read-only; does not advance progress)
router.get('/me/lesson/:week', requireMember, (req, res) => {
  const user = findById(req.session.userId);
  if (!user) return res.status(401).json({ error: 'Session expired.' });

  if (!user.assignedProgram) {
    return res.status(404).json({ error: 'No program currently assigned.' });
  }

  const requestedWeek = Number(req.params.week);
  if (!Number.isInteger(requestedWeek) || requestedWeek < 1) {
    return res.status(400).json({ error: 'Invalid week number.' });
  }

  // Members may only read up to and including their current week (no skipping ahead)
  if (requestedWeek > (user.currentWeek || 1)) {
    return res.status(403).json({ error: 'Week not yet available. Complete earlier weeks first.' });
  }

  const lesson = getLessonForWeek(user.assignedProgram, requestedWeek);
  if (!lesson) {
    return res.status(404).json({ error: 'Lesson content not found for this week.' });
  }

  res.json({
    lesson,
    programSlug:   user.assignedProgram,
    week:          requestedWeek,
    programStatus: user.programStatus || 'active',
    statusNote:    user.statusNote    || null
  });
});

// GET /api/progression/me/discussion-weeks
// Returns all weeks of the member's current program with their discussion
// questions and submission status. Weeks already submitted show answers;
// incomplete weeks show blank questions ready to fill out.
router.get('/me/discussion-weeks', requireMember, (req, res) => {
  const user = findById(req.session.userId);
  if (!user) return res.status(401).json({ error: 'Session expired.' });
  if (!user.assignedProgram) {
    return res.status(404).json({ error: 'No program currently assigned.' });
  }

  const program = getLessonProgram(user.assignedProgram);
  if (!program) {
    return res.status(404).json({ error: 'Lesson content not found for this program.' });
  }

  const currentWeek = user.currentWeek || 1;
  const submissions = user.examSubmissions || [];

  const weeks = program.weeks
    .filter(w => w.week <= currentWeek)   // only weeks the member has reached
    .map(w => {
      const questions = (w.examQuestions || []).map(q => q.question || q);
      // Find if this week was already submitted
      const sub = submissions.find(
        s => s.programSlug === user.assignedProgram && Number(s.week) === Number(w.week)
      );
      return {
        week:       w.week,
        title:      w.title || `Week ${w.week}`,
        questions,
        submitted:  !!sub,
        submittedAt: sub ? sub.submittedAt : null,
        answers:    sub ? (sub.answers || []) : [],
        reviewedAt: sub ? sub.reviewedAt  : null,
        grade:      sub ? sub.grade       : null,
      };
    });

  res.json({
    programSlug:   user.assignedProgram,
    programTitle:  program.title || user.assignedProgram,
    currentWeek,
    programStatus: user.programStatus || 'active',
    statusNote:    user.statusNote || null,
    weeks,
  });
});

// ─────────────────────────────────────────
//  SCHOOLMASTER ROUTES
// ─────────────────────────────────────────

// GET /api/progression/members
router.get('/members', requireAdmin, (_req, res) => {
  const programs = getCurriculumIndex();
  const members  = getMemberUsers();
  const list = members.map(m => buildProgressView(m, programs));
  res.json({ members: list });
});

// GET /api/progression/member/:id
router.get('/member/:id', requireAdmin, (req, res) => {
  const user = findById(req.params.id);
  if (!user || user.role === 'admin') return res.status(404).json({ error: 'Member not found.' });
  const programs = getCurriculumIndex();
  res.json(buildProgressView(user, programs));
});

// POST /api/progression/member/:id/assign  { programSlug }
router.post('/member/:id/assign', requireAdmin, (req, res) => {
  const user = findById(req.params.id);
  if (!user || user.role === 'admin') return res.status(404).json({ error: 'Member not found.' });

  const { programSlug } = req.body;
  if (!programSlug) return res.status(400).json({ error: 'programSlug is required.' });

  const programs = getCurriculumIndex();
  const program  = programs.find(p => p.slug === programSlug);
  if (!program) return res.status(400).json({ error: 'Unknown program slug.' });

  // Archive the current program if one is active
  const history = [...(user.programHistory || [])];
  if (user.assignedProgram) {
    const existing = history.find(h => h.slug === user.assignedProgram && !h.completedAt);
    if (!existing) {
      history.push({ slug: user.assignedProgram, assignedAt: user.programAssignedAt || user.createdAt, completedAt: null, grade: null });
    }
  }

  // Auto-unlock the assigned program so the member can access it
  const unlocked = new Set(user.unlockedSlugs || []);
  unlocked.add(programSlug);

  updateUser(user.id, {
    assignedProgram:    programSlug,
    programAssignedAt:  new Date().toISOString(),
    currentWeek:        1,
    programHistory:     history,
    unlockedSlugs:      [...unlocked]
  });

  res.json({ ok: true, message: `${user.username} assigned to ${program.title}.` });
});

// POST /api/progression/member/:id/unlock  { programSlug }  — grant access to a program
router.post('/member/:id/unlock', requireAdmin, (req, res) => {
  const user = findById(req.params.id);
  if (!user || user.role === 'admin') return res.status(404).json({ error: 'Member not found.' });

  const { programSlug } = req.body;
  if (!programSlug) return res.status(400).json({ error: 'programSlug is required.' });

  const programs = getCurriculumIndex();
  const program  = programs.find(p => p.slug === programSlug);
  if (!program) return res.status(400).json({ error: 'Unknown program slug.' });

  const unlocked = new Set(user.unlockedSlugs || []);
  if (unlocked.has(programSlug)) {
    return res.json({ ok: true, message: `${program.title} is already unlocked for ${user.username}.` });
  }
  unlocked.add(programSlug);
  updateUser(user.id, { unlockedSlugs: [...unlocked] });
  res.json({ ok: true, message: `${program.title} unlocked for ${user.username}.` });
});

// POST /api/progression/member/:id/lock  { programSlug }  — revoke access to a program
router.post('/member/:id/lock', requireAdmin, (req, res) => {
  const user = findById(req.params.id);
  if (!user || user.role === 'admin') return res.status(404).json({ error: 'Member not found.' });

  const { programSlug } = req.body;
  if (!programSlug) return res.status(400).json({ error: 'programSlug is required.' });

  const unlocked = new Set(user.unlockedSlugs || []);
  unlocked.delete(programSlug);
  updateUser(user.id, { unlockedSlugs: [...unlocked] });

  const programs = getCurriculumIndex();
  const program  = programs.find(p => p.slug === programSlug);
  res.json({ ok: true, message: `${program ? program.title : programSlug} locked for ${user.username}.` });
});

// POST /api/progression/member/:id/unlock-all  — grant access to every program at once
router.post('/member/:id/unlock-all', requireAdmin, (req, res) => {
  const user = findById(req.params.id);
  if (!user || user.role === 'admin') return res.status(404).json({ error: 'Member not found.' });

  const programs = getCurriculumIndex();
  const allSlugs = programs.map(p => p.slug);
  updateUser(user.id, { unlockedSlugs: allSlugs });
  res.json({ ok: true, message: `All ${allSlugs.length} programs unlocked for ${user.username}.`, unlockedSlugs: allSlugs });
});

// POST /api/progression/member/:id/lock-all  — revoke all explicit unlocks at once
router.post('/member/:id/lock-all', requireAdmin, (req, res) => {
  const user = findById(req.params.id);
  if (!user || user.role === 'admin') return res.status(404).json({ error: 'Member not found.' });

  updateUser(user.id, { unlockedSlugs: [] });
  res.json({ ok: true, message: `All program overrides cleared for ${user.username}.` });
});

// POST /api/progression/member/:id/advance  { week? }  — set week manually
router.post('/member/:id/advance', requireAdmin, (req, res) => {
  const user = findById(req.params.id);
  if (!user || user.role === 'admin') return res.status(404).json({ error: 'Member not found.' });
  if (!user.assignedProgram) return res.status(400).json({ error: 'No program assigned.' });

  const programs = getCurriculumIndex();
  const program  = programs.find(p => p.slug === user.assignedProgram);
  const maxWeek  = program ? program.durationWeeks : 99;

  let week = req.body.week ? Number(req.body.week) : (user.currentWeek || 1) + 1;
  if (week < 1) week = 1;
  if (week > maxWeek) week = maxWeek;

  // Record the timestamp when this week was set (used for overdue detection)
  updateUser(user.id, { currentWeek: week, weekSetAt: new Date().toISOString() });
  res.json({ ok: true, week, message: `Week advanced to ${week}.` });
});

// POST /api/progression/member/:id/exam/:examIdx/review  { grade, notes }
router.post('/member/:id/exam/:examIdx/review', requireAdmin, (req, res) => {
  const user = findById(req.params.id);
  if (!user || user.role === 'admin') return res.status(404).json({ error: 'Member not found.' });

  const idx = Number(req.params.examIdx);
  const submissions = [...(user.examSubmissions || [])];
  if (!submissions[idx]) return res.status(404).json({ error: 'Exam submission not found.' });

  const { grade, notes } = req.body;
  submissions[idx] = {
    ...submissions[idx],
    grade:      grade ?? submissions[idx].grade,
    notes:      notes ?? submissions[idx].notes,
    reviewedAt: new Date().toISOString()
  };

  updateUser(user.id, { examSubmissions: submissions });
  res.json({ ok: true, message: 'Exam review saved.' });
});

// POST /api/progression/member/:id/note  { note }
router.post('/member/:id/note', requireAdmin, (req, res) => {
  const user = findById(req.params.id);
  if (!user || user.role === 'admin') return res.status(404).json({ error: 'Member not found.' });

  const { note } = req.body;
  if (!note) return res.status(400).json({ error: 'note is required.' });

  const notes = [...(user.progressNotes || []), { date: new Date().toISOString(), note }];
  updateUser(user.id, { progressNotes: notes });
  res.json({ ok: true, message: 'Note saved.' });
});

// POST /api/progression/member/:id/complete  { grade?, nextProgramSlug? }
router.post('/member/:id/complete', requireAdmin, async (req, res) => {
  const user = findById(req.params.id);
  if (!user || user.role === 'admin') return res.status(404).json({ error: 'Member not found.' });
  if (!user.assignedProgram) return res.status(400).json({ error: 'No program assigned.' });

  const { grade, nextProgramSlug } = req.body;
  const completedProgramSlug  = user.assignedProgram;
  const completedAt            = new Date().toISOString();

  // Mark current program complete in history
  const history = [...(user.programHistory || [])];
  const existing = history.find(h => h.slug === completedProgramSlug && !h.completedAt);
  if (existing) {
    existing.completedAt = completedAt;
    existing.grade = grade || null;
  } else {
    history.push({
      slug:        completedProgramSlug,
      assignedAt:  user.programAssignedAt || user.createdAt,
      completedAt: completedAt,
      grade:       grade || null
    });
  }

  const update = {
    programHistory: history,
    assignedProgram: null,
    currentWeek: null,
    weekSetAt: null
  };

  if (nextProgramSlug) {
    const programs = getCurriculumIndex();
    const next = programs.find(p => p.slug === nextProgramSlug);
    if (next) {
      update.assignedProgram   = nextProgramSlug;
      update.programAssignedAt = new Date().toISOString();
      update.currentWeek       = 1;
      update.weekSetAt         = new Date().toISOString();
      // Auto-unlock the next program when assigning it
      const unlocked = new Set(user.unlockedSlugs || []);
      unlocked.add(nextProgramSlug);
      update.unlockedSlugs = [...unlocked];
    }
  }

  updateUser(user.id, update);

  // ── Send completion certificate email ──
  const programs      = getCurriculumIndex();
  const completedProg = programs.find(p => p.slug === completedProgramSlug);
  const programTitle  = completedProg ? completedProg.title : completedProgramSlug;
  const certResult    = await sendCertificate(user, programTitle, completedAt, grade || null, completedProgramSlug);

  // ── Persist certId on the history entry so member can re-download later ──
  if (certResult.certId) {
    const freshUser    = findById(user.id);
    const freshHistory = [...(freshUser.programHistory || [])];
    const hEntry       = freshHistory.find(h => h.slug === completedProgramSlug && h.completedAt === completedAt);
    if (hEntry) {
      hEntry.certId = certResult.certId;
      updateUser(user.id, { programHistory: freshHistory });
    }
  }

  res.json({
    ok: true,
    message: nextProgramSlug
      ? `Program completed. ${user.username} assigned to next program.`
      : `Program marked complete for ${user.username}.`,
    certificate: {
      sent:    certResult.sent,
      email:   user.email  || null,
      certId:  certResult.certId  || null,
      preview: certResult.preview || null,
      error:   certResult.error   || null,
    }
  });
});

// POST /api/progression/member/:id/certificate/:slug
// Re-send (or send for the first time) a certificate for a completed program.
// Useful if the original email was missed, or for manual sending after the fact.
router.post('/member/:id/certificate/:slug', requireAdmin, async (req, res) => {
  const user = findById(req.params.id);
  if (!user || user.role === 'admin') return res.status(404).json({ error: 'Member not found.' });

  const slug    = req.params.slug;
  const history = user.programHistory || [];
  const entry   = history.filter(h => h.slug === slug && h.completedAt).pop();
  if (!entry) {
    return res.status(404).json({ error: `No completed record found for program "${slug}".` });
  }

  const programs     = getCurriculumIndex();
  const prog         = programs.find(p => p.slug === slug);
  const programTitle = prog ? prog.title : slug;

  const certResult = await sendCertificate(user, programTitle, entry.completedAt, entry.grade || null, slug);

  // Persist updated certId on history entry
  if (certResult.certId) {
    const freshUser    = findById(user.id);
    const freshHistory = [...(freshUser.programHistory || [])];
    const hEntry       = freshHistory.find(h => h.slug === slug && h.completedAt === entry.completedAt);
    if (hEntry) {
      hEntry.certId = certResult.certId;
      updateUser(user.id, { programHistory: freshHistory });
    }
  }

  return res.json({
    ok:      certResult.sent,
    email:   user.email  || null,
    certId:  certResult.certId  || null,
    preview: certResult.preview || null,
    error:   certResult.error   || null,
    message: certResult.sent
      ? `Certificate re-sent to ${user.email}. (ID: ${certResult.certId})`
      : `Certificate could not be sent: ${certResult.error}`,
  });
});

// ─────────────────────────────────────────
//  RANK ASSIGNMENT
//  POST /api/progression/member/:id/rank
//  Body: { rank, rankName? }
//  rank = program slug used as rank key (e.g. "corporal")
//  rankName = optional custom display name given at formal ceremony
// ─────────────────────────────────────────
router.post('/member/:id/rank', requireAdmin, (req, res) => {
  const user = findById(req.params.id);
  if (!user || user.role === 'admin') return res.status(404).json({ error: 'Member not found.' });

  const { rank, rankName } = req.body;
  if (!rank) return res.status(400).json({ error: 'rank is required.' });

  const programs = getCurriculumIndex();
  const program  = programs.find(p => p.slug === rank);
  if (!program) return res.status(400).json({ error: 'Unknown rank slug.' });

  // Append to rank history
  const history = [...(user.rankHistory || []), {
    rank,
    rankName:   rankName ? rankName.trim().slice(0, 80) : null,
    assignedAt: new Date().toISOString(),
    assignedBy: 'Schoolmaster'
  }];

  const updatedName = rankName ? rankName.trim().slice(0, 80) : (user.rankName || null);

  updateUser(user.id, {
    rank,
    rankName:       updatedName,
    rankAssignedAt: new Date().toISOString(),
    rankHistory:    history
  });

  res.json({
    ok: true,
    message: rankName
      ? `Rank "${program.title}" assigned to ${user.username}. Display name: ${rankName}`
      : `Rank "${program.title}" assigned to ${user.username}.`
  });
});

// ─────────────────────────────────────────
//  MEMBER STATUS (pause / activate)
//  POST /api/progression/member/:id/status
//  Body: { status: 'active' | 'paused', note? }
// ─────────────────────────────────────────
router.post('/member/:id/status', requireAdmin, (req, res) => {
  const user = findById(req.params.id);
  if (!user || user.role === 'admin') return res.status(404).json({ error: 'Member not found.' });

  const { status, note } = req.body;
  if (!['active', 'paused'].includes(status)) {
    return res.status(400).json({ error: 'status must be "active" or "paused".' });
  }

  updateUser(user.id, {
    programStatus:   status,
    statusNote:      note ? note.trim().slice(0, 300) : null,
    statusChangedAt: new Date().toISOString()
  });

  res.json({
    ok: true,
    message: status === 'paused'
      ? `${user.username}'s program has been paused.`
      : `${user.username}'s program has been set to active.`
  });
});

// ─────────────────────────────────────────
//  BULK OPERATIONS  (admin only)
//  POST /api/progression/bulk-advance    { memberIds[], action: 'advance'|'lock' }
//    advance  → each member's currentWeek += 1  (capped at durationWeeks)
//    lock     → each member's programStatus set to 'paused'
//  POST /api/progression/bulk-retest     { memberId, examIdx }
//    → approve an inline retest for a single member exam row
// ─────────────────────────────────────────

router.post('/bulk-advance', requireAdmin, (req, res) => {
  const { memberIds, action } = req.body;
  if (!Array.isArray(memberIds) || !memberIds.length) {
    return res.status(400).json({ error: 'memberIds array is required.' });
  }
  if (!['advance', 'lock'].includes(action)) {
    return res.status(400).json({ error: 'action must be "advance" or "lock".' });
  }

  const programs = getCurriculumIndex();
  const results  = [];
  const errors   = [];

  for (const id of memberIds) {
    const user = findById(id);
    if (!user || user.role === 'admin') { errors.push(id); continue; }

    if (action === 'advance') {
      if (!user.assignedProgram) { errors.push(id); continue; }
      const prog   = programs.find(p => p.slug === user.assignedProgram);
      const maxW   = prog ? prog.durationWeeks : 99;
      const newW   = Math.min((user.currentWeek || 1) + 1, maxW);
      updateUser(id, { currentWeek: newW, weekSetAt: new Date().toISOString() });
      results.push({ id, username: user.username, week: newW });
    } else {
      // lock = pause progression
      updateUser(id, { programStatus: 'paused', statusNote: 'Locked by Schoolmaster (bulk action)', statusChangedAt: new Date().toISOString() });
      results.push({ id, username: user.username, status: 'paused' });
    }
  }

  res.json({ ok: true, processed: results, failed: errors,
    message: `Bulk ${action}: ${results.length} updated, ${errors.length} failed.` });
});

router.post('/bulk-retest', requireAdmin, (req, res) => {
  const { memberId, examIdx } = req.body;
  if (!memberId || examIdx === undefined) {
    return res.status(400).json({ error: 'memberId and examIdx required.' });
  }
  const user = findById(memberId);
  if (!user || user.role === 'admin') return res.status(404).json({ error: 'Member not found.' });

  const idx  = Number(examIdx);
  const subs = [...(user.examSubmissions || [])];
  if (!subs[idx]) return res.status(404).json({ error: 'Exam submission not found.' });

  // Mark this submission as approved for retest (sets grade to 'Retest Approved')
  subs[idx] = { ...subs[idx], retestApproved: true, retestApprovedAt: new Date().toISOString(), reviewedAt: subs[idx].reviewedAt || new Date().toISOString(), grade: subs[idx].grade || 'Retest Approved' };
  updateUser(user.id, { examSubmissions: subs });
  res.json({ ok: true, message: `Retest approved for ${user.username} exam ${idx + 1}.` });
});

// ─────────────────────────────────────────
//  DELETE MEMBER
//  DELETE /api/progression/member/:id
// ─────────────────────────────────────────
router.delete('/member/:id', requireAdmin, (req, res) => {
  const user = findById(req.params.id);
  if (!user || user.role === 'admin') return res.status(404).json({ error: 'Member not found.' });

  const username = user.username;
  const userEmail = (user.email || '').trim().toLowerCase();
  try {
    // 1. Remove from userStore (data/users.json)
    deleteUser(user.id);

    // 2. Remove from accounts.json so the boot migration never re-promotes them
    try {
      if (fs.existsSync(ACCOUNTS_FILE)) {
        const accounts = JSON.parse(fs.readFileSync(ACCOUNTS_FILE, 'utf8'));
        const filtered = accounts.filter(a => {
          const nameMatch  = (a.fullName  || '').trim().toUpperCase() === username.trim().toUpperCase();
          const emailMatch = userEmail && (a.email || '').trim().toLowerCase() === userEmail;
          return !(nameMatch || emailMatch);
        });
        if (filtered.length !== accounts.length) {
          fs.writeFileSync(ACCOUNTS_FILE, JSON.stringify(filtered, null, 2), 'utf8');
        }
      }
    } catch (acctErr) {
      console.warn(`✠ Delete: could not clean accounts.json for ${username}:`, acctErr.message);
    }

    // 3. Remove curriculum submissions for this member
    try {
      if (fs.existsSync(SUBMISSIONS_FILE)) {
        const subs = JSON.parse(fs.readFileSync(SUBMISSIONS_FILE, 'utf8'));
        const filteredSubs = subs.filter(s =>
          s.studentId !== user.id &&
          s.studentName?.trim().toUpperCase() !== username.trim().toUpperCase()
        );
        if (filteredSubs.length !== subs.length) {
          fs.writeFileSync(SUBMISSIONS_FILE, JSON.stringify(filteredSubs, null, 2), 'utf8');
        }
      }
    } catch (subErr) {
      console.warn(`✠ Delete: could not clean submissions for ${username}:`, subErr.message);
    }

    // 4. Record this ID in deleted-ids.json so migration v3 never re-injects it
    try {
      const deletedIds = fs.existsSync(DELETED_IDS_FILE)
        ? JSON.parse(fs.readFileSync(DELETED_IDS_FILE, 'utf8'))
        : [];
      if (!deletedIds.includes(user.id)) {
        deletedIds.push(user.id);
        fs.writeFileSync(DELETED_IDS_FILE, JSON.stringify(deletedIds, null, 2), 'utf8');
        console.log(`✠ Delete: recorded id=${user.id} in deleted-ids.json — will not be re-injected on reboot.`);
      }
    } catch (delErr) {
      console.warn(`✠ Delete: could not write deleted-ids.json for ${username}:`, delErr.message);
    }

    console.log(`✠ Member "${username}" permanently deleted (userStore + accounts.json + submissions + deleted-ids).`);
    res.json({ ok: true, message: `Member "${username}" has been permanently deleted.` });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// ─────────────────────────────────────────
//  Helper: compute overdue status
//  A member is overdue when they have an active program, are on a specific week,
//  and have NOT advanced from that week in more than OVERDUE_MS milliseconds.
// ─────────────────────────────────────────
function computeOverdue(user) {
  if (!user.assignedProgram || !user.currentWeek) return false;
  if (user.programStatus === 'paused') return false;
  // weekSetAt is stamped whenever currentWeek changes — fall back to programAssignedAt
  const since = user.weekSetAt || user.programAssignedAt || user.createdAt;
  if (!since) return false;
  const elapsed = Date.now() - new Date(since).getTime();
  return elapsed > OVERDUE_MS;
}

// ─────────────────────────────────────────
//  Helper: build a clean progress view
// ─────────────────────────────────────────
function buildProgressView(user, programs) {
  programs = programs || getCurriculumIndex();
  const assigned = user.assignedProgram
    ? programs.find(p => p.slug === user.assignedProgram) || null
    : null;

  // ── Pull curriculum-submissions for this member ──
  // The new assessment system (program-hub.html → /api/assessment/:slug/submit)
  // writes to curriculum-submissions.json, keyed by studentId = email.
  // We surface these as curriculumExams so both the SM dashboard and member
  // profile pages can display accurate exam status without depending on the
  // legacy users.json.examSubmissions array.
  let curriculumExams = [];
  let pendingCurriculumCount = 0;
  try {
    const store = readStore();
    const emailStudentId = studentKey(user.username, user.email);
    // Name-based fallback key (used when email was absent at submission time)
    const nameStudentId  = user.username.trim().toLowerCase().replace(/\s+/g, '-');
    const matchIds = new Set([emailStudentId]);
    if (nameStudentId && nameStudentId !== emailStudentId) matchIds.add(nameStudentId);
    // Collect all submissions across all programs for this student (both keys)
    curriculumExams = store.submissions
      .filter(s => matchIds.has(s.studentId))
      .sort((a, b) => new Date(b.submittedAt).getTime() - new Date(a.submittedAt).getTime())
      .map(s => ({
        id:            s.id,
        studentId:     s.studentId,     // ← needed so SM dashboard can approve without email
        studentName:   s.studentName,
        studentEmail:  s.studentEmail,
        programSlug:   s.slug,
        weekNumber:    s.weekNumber,
        weekTitle:     s.weekTitle || `Week ${s.weekNumber}`,
        submittedAt:   s.submittedAt,
        score:         s.score,
        correctCount:  s.correctCount,
        totalQuestions:s.totalQuestions,
        passed:        s.passed,
        passingScore:  s.passingScore,
        review:        s.review || [],
        // Legacy-compat fields expected by SM dashboard renderExams()
        answers:       (s.review || []).map(r => ({ question: r.prompt, answer: `${r.submittedAnswer} — ${r.submittedText}` })),
        reviewedAt:    s.passed ? s.submittedAt : null,  // auto-graded; treat as "reviewed"
        grade:         s.passed ? `Pass (${s.score}%)` : `Fail (${s.score}%)`
      }));
    // Pending = failed submissions without a retest approval yet
    const unlockApprovals = store.unlockApprovals || [];
    const retestApprovals  = store.retestApprovals || [];
    if (assigned) {
      // Count weeks where the student has failed and has no active retest or pass
      const studentSubs = store.submissions.filter(s => matchIds.has(s.studentId) && s.slug === user.assignedProgram);
      const weekNums = [...new Set(studentSubs.map(s => s.weekNumber))];
      for (const wn of weekNums) {
        const weekSubs = studentSubs.filter(s => s.weekNumber === wn).sort((a, b) => new Date(a.submittedAt) - new Date(b.submittedAt));
        const latestSub = weekSubs[weekSubs.length - 1];
        if (latestSub && !latestSub.passed) {
          pendingCurriculumCount += 1;
        }
      }
    }
  } catch (_e) { /* curriculum store read errors are non-fatal */ }

  const pendingExams = (user.examSubmissions || [])
    .map((s, i) => ({ ...s, index: i }))
    .filter(s => !s.reviewedAt);

  const overdue = computeOverdue(user);

  return {
    id:              user.id,
    username:        user.username,
    salutation:      user.salutation,
    memberId:        user.memberId      || null,
    role:            user.role,
    createdAt:       user.createdAt,
    unlockedSlugs:   user.unlockedSlugs || [],
    // ── Rank ──
    rank:            user.rank          || null,
    rankName:        user.rankName      || null,
    rankAssignedAt:  user.rankAssignedAt|| null,
    rankHistory:     user.rankHistory   || [],
    // ── Program status ──
    programStatus:   user.programStatus || 'active',
    statusNote:      user.statusNote    || null,
    statusChangedAt: user.statusChangedAt || null,
    // ── Progress ──
    assignedProgram: assigned ? {
      slug:        assigned.slug,
      title:       assigned.title,
      phase:       assigned.phase,
      durationWeeks: assigned.durationWeeks,
      assignedAt:  user.programAssignedAt || null,
      siteEntry:   assigned.siteEntry,
      schoolmasterEntry: assigned.navAliases?.schoolmaster || null
    } : null,
    currentWeek:      user.currentWeek || null,
    weekSetAt:        user.weekSetAt   || null,
    overdue:          overdue,
    programHistory:   user.programHistory || [],
    // Legacy exam submissions (old /api/progression/me/exam system)
    examSubmissions:  user.examSubmissions || [],
    pendingExamCount: pendingExams.length + pendingCurriculumCount,
    // Total exams taken = all curriculum submissions + all legacy submissions
    totalExamCount:   curriculumExams.length + (user.examSubmissions || []).length,
    // New curriculum-based exam submissions (program-hub.html → /api/assessment/:slug/submit)
    curriculumExams,
    progressNotes:    user.progressNotes || []
  };
}

module.exports = router;
