"use strict";
/**
 * GET /api/papers/my-submissions
 * Returns the authenticated member's own submissions.
 *
 * Auth: valid academy_session JWT.
 */

const { requireSession } = require("../../lib/auth-session");
const { readMetadata }   = require("../../lib/paper-submissions");

function handler(req, res) {
  if (req.method !== "GET") return res.status(405).json({ error: "Method not allowed." });

  const session = requireSession(req, res);
  if (!session) return;

  const items = readMetadata().filter(
    x => x.memberId === session.memberId || x.uploadedBy === session.memberId
  );

  res.status(200).json({ items });
}

module.exports = { handler };
