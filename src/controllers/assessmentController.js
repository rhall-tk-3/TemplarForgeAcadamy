const express = require('express');
const { getProgramCourse, getSharedLibrary } = require('../services/fullCurriculumService');
const { getStudentProgress, submitWeekWork, approveRetest, approveUnlock, getSchoolmasterRecords } = require('../services/submissionStoreService');

const router = express.Router();

router.get('/library', (_req, res) => {
  return res.json({ library: getSharedLibrary() });
});

router.get('/:slug/course', (req, res) => {
  const course = getProgramCourse(req.params.slug);
  if (!course) {
    return res.status(404).json({ error: 'Program not found' });
  }
  return res.json(course);
});

router.get('/:slug/progress', (req, res) => {
  try {
    const progress = getStudentProgress(req.params.slug, req.query.studentName || '', req.query.studentEmail || '');
    return res.json(progress);
  } catch (error) {
    return res.status(400).json({ error: error.message });
  }
});

router.post('/:slug/submit', (req, res) => {
  try {
    const result = submitWeekWork(req.params.slug, req.body || {});
    return res.status(201).json(result);
  } catch (error) {
    return res.status(400).json({ error: error.message });
  }
});

router.get('/schoolmaster/:slug/records', (req, res) => {
  try {
    return res.json(getSchoolmasterRecords(req.params.slug));
  } catch (error) {
    return res.status(400).json({ error: error.message });
  }
});

router.post('/schoolmaster/:slug/retest', (req, res) => {
  try {
    return res.status(201).json(approveRetest(req.params.slug, req.body || {}));
  } catch (error) {
    return res.status(400).json({ error: error.message });
  }
});

// POST /api/assessment/schoolmaster/:slug/unlock
// Schoolmaster approves next-week progression for a student who has passed the
// specified week.  The payload mirrors the retest approval shape:
//   { studentName, studentEmail, weekNumber, approvedBy?, note? }
router.post('/schoolmaster/:slug/unlock', (req, res) => {
  try {
    return res.status(201).json(approveUnlock(req.params.slug, req.body || {}));
  } catch (error) {
    return res.status(400).json({ error: error.message });
  }
});

module.exports = { router };
