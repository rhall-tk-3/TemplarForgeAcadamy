"use strict";
/**
 * POST /api/papers/grade-written
 * Body: { submissionId, grade, notes }
 *
 * Grades a written (examSubmissions[]) entry stored in users.json.
 * submissionId format: "<userId>-exam-<index>"  (set by written-submissions.js)
 *
 * Writes grade, notes, and reviewedAt back into the user record.
 * Returns the updated submission entry.
 *
 * Auth: schoolmaster JWT only.
 */

const { requireSchoolmaster } = require("../../lib/auth-session");
const { findById, updateUser } = require("../../src/auth/userStore");

function handler(req, res) {
  if (req.method !== "POST") {
    return res.status(405).json({ error: "Method not allowed." });
  }

  const session = requireSchoolmaster(req, res);
  if (!session) return;

  const { submissionId, grade, notes } = req.body || {};
  if (!submissionId) {
    return res.status(400).json({ error: "submissionId is required." });
  }

  // Parse the synthetic id: "<userId>-exam-<index>"
  const match = /^(.+)-exam-(\d+)$/.exec(submissionId);
  if (!match) {
    return res.status(400).json({ error: "Invalid submissionId format." });
  }
  const userId   = match[1];
  const examIdx  = Number(match[2]);

  const user = findById(userId);
  if (!user || user.role === "admin") {
    return res.status(404).json({ error: "Member not found." });
  }

  const submissions = [...(user.examSubmissions || [])];
  if (!submissions[examIdx]) {
    return res.status(404).json({ error: "Submission not found." });
  }

  submissions[examIdx] = {
    ...submissions[examIdx],
    grade:      String(grade      ?? submissions[examIdx].grade      ?? ""),
    notes:      String(notes      ?? submissions[examIdx].notes      ?? ""),
    reviewedAt: new Date().toISOString()
  };

  updateUser(user.id, { examSubmissions: submissions });

  res.status(200).json({ ok: true, submission: submissions[examIdx] });
}

module.exports = { handler };
