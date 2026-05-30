"use strict";
/**
 * POST /api/reading-log/submit
 * Body: { programSlug }
 * Marks the member's program log as formally submitted for Schoolmaster review.
 *
 * Auth: valid academy_session JWT.
 */

const { requireSession }                            = require("../../lib/auth-session");
const { readAllLogs, writeAllLogs,
        markProgramSubmitted }                       = require("../../lib/reading-log-store");

function handler(req, res) {
  if (req.method !== "POST") {
    return res.status(405).json({ error: "Method not allowed." });
  }

  const session = requireSession(req, res);
  if (!session) return;

  const { programSlug } = req.body || {};

  if (!programSlug) {
    return res.status(400).json({ error: "programSlug is required." });
  }

  const allLogs = readAllLogs();
  const updated = markProgramSubmitted(allLogs, session, programSlug);
  writeAllLogs(updated);

  return res.status(200).json({ ok: true, submittedAt: new Date().toISOString() });
}

module.exports = { handler };
