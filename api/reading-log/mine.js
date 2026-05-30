"use strict";
/**
 * GET /api/reading-log/mine
 * Returns the authenticated member's reading log.
 *
 * Auth: valid academy_session JWT.
 */

const { requireSession }              = require("../../lib/auth-session");
const { readAllLogs, getMemberLog }   = require("../../lib/reading-log-store");

function handler(req, res) {
  if (req.method !== "GET") {
    return res.status(405).json({ error: "Method not allowed." });
  }

  const session = requireSession(req, res);
  if (!session) return;

  const allLogs   = readAllLogs();
  const memberLog = getMemberLog(allLogs, session);

  return res.status(200).json({
    memberId: memberLog.memberId,
    fullName: memberLog.fullName,
    programs: memberLog.programs || {}
  });
}

module.exports = { handler };
