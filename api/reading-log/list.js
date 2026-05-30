"use strict";
/**
 * GET /api/reading-log/list
 * Returns all member reading logs, flattened per-program, newest first.
 *
 * Auth: schoolmaster JWT only.
 */

const { requireSchoolmaster } = require("../../lib/auth-session");
const { readAllLogs }         = require("../../lib/reading-log-store");

function handler(req, res) {
  if (req.method !== "GET") {
    return res.status(405).json({ error: "Method not allowed." });
  }

  const session = requireSchoolmaster(req, res);
  if (!session) return;

  const allLogs  = readAllLogs();
  const flattened = [];

  for (const member of allLogs) {
    const programs = member.programs || {};
    for (const [programSlug, programData] of Object.entries(programs)) {
      flattened.push({
        memberId:    member.memberId,
        fullName:    member.fullName,
        programSlug,
        updatedAt:   programData.updatedAt  || member.updatedAt,
        submittedAt: programData.submittedAt || null,
        summary:     programData.summary    || { totalDocs: 0, completedDocs: 0, completionPct: 0 },
        weeks:       programData.weeks      || []
      });
    }
  }

  flattened.sort(
    (a, b) => new Date(b.updatedAt || 0).getTime() - new Date(a.updatedAt || 0).getTime()
  );

  return res.status(200).json({ items: flattened });
}

module.exports = { handler };
