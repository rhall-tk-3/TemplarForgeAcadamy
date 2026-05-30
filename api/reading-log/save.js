"use strict";
/**
 * POST /api/reading-log/save
 * Body: { programSlug, programState }
 *   programState must include a `weeks` array.
 *
 * Auth: valid academy_session JWT.
 */

const { requireSession }                              = require("../../lib/auth-session");
const { readAllLogs, writeAllLogs,
        upsertMemberProgramLog }                      = require("../../lib/reading-log-store");

function handler(req, res) {
  if (req.method !== "POST") {
    return res.status(405).json({ error: "Method not allowed." });
  }

  const session = requireSession(req, res);
  if (!session) return;

  const { programSlug, programState } = req.body || {};

  if (!programSlug || !programState || !Array.isArray(programState.weeks)) {
    return res.status(400).json({ error: "Invalid reading-log payload." });
  }

  const allLogs = readAllLogs();
  const updated = upsertMemberProgramLog(allLogs, session, programSlug, programState);
  writeAllLogs(updated);

  return res.status(200).json({ ok: true, savedAt: new Date().toISOString() });
}

module.exports = { handler };
