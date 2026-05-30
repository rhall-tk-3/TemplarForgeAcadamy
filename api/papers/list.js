"use strict";
/**
 * GET /api/papers/list
 * Returns all submissions for schoolmaster review.
 *
 * Auth: schoolmaster JWT only.
 */

const { requireSchoolmaster } = require("../../lib/auth-session");
const { readMetadata }        = require("../../lib/paper-submissions");

function handler(req, res) {
  if (req.method !== "GET") return res.status(405).json({ error: "Method not allowed." });

  const session = requireSchoolmaster(req, res);
  if (!session) return;

  const items = readMetadata();
  res.status(200).json({ items });
}

module.exports = { handler };
