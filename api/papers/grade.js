"use strict";
/**
 * POST /api/papers/grade
 * Body: { submissionId, status, grade, feedback }
 *   status   — optional; one of "submitted" | "graded" | "revision-requested"
 *   grade    — optional string, e.g. "Pass", "Fail", "A", "92"
 *   feedback — optional string
 *
 * Auth: schoolmaster JWT only.
 */

const { requireSchoolmaster } = require("../../lib/auth-session");
const { readMetadata, writeMetadata } = require("../../lib/paper-submissions");

const ALLOWED_STATUS = new Set(["submitted", "graded", "revision-requested"]);

function handler(req, res) {
  if (req.method !== "POST") return res.status(405).json({ error: "Method not allowed." });

  const session = requireSchoolmaster(req, res);
  if (!session) return;

  const { submissionId, status, grade, feedback } = req.body || {};
  if (!submissionId) {
    return res.status(400).json({ error: "submissionId is required." });
  }

  if (status && !ALLOWED_STATUS.has(status)) {
    return res.status(400).json({ error: "Invalid status." });
  }

  const items = readMetadata();
  const idx = items.findIndex(x => x.submissionId === submissionId);

  if (idx === -1) {
    return res.status(404).json({ error: "Submission not found." });
  }

  items[idx].status   = status || items[idx].status;
  items[idx].grade    = String(grade    || "");
  items[idx].feedback = String(feedback || "");
  items[idx].gradedAt = new Date().toISOString();
  items[idx].gradedBy = session.memberId;

  writeMetadata(items);

  res.status(200).json({ ok: true, item: items[idx] });
}

module.exports = { handler };
