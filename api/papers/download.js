"use strict";
/**
 * GET /api/papers/download?submissionId=
 * Streams the stored file to the authenticated requester.
 *
 * Auth rules:
 *   - A member can download their own submission.
 *   - A schoolmaster can download any submission.
 */

const fs   = require("fs");
const path = require("path");
const { readSession }  = require("../../lib/auth-session");
const { readMetadata } = require("../../lib/paper-submissions");

function handler(req, res) {
  if (req.method !== "GET") return res.status(405).json({ error: "Method not allowed." });

  const session = readSession(req);
  if (!session) return res.status(401).json({ error: "Unauthorized." });

  const submissionId = String(
    (req.params && req.params.submissionId) || req.query.submissionId || ""
  ).trim();
  if (!submissionId) {
    return res.status(400).json({ error: "submissionId is required." });
  }

  const items = readMetadata();
  const item  = items.find(x => x.submissionId === submissionId);
  if (!item) return res.status(404).json({ error: "Submission not found." });

  const isOwner = item.memberId === session.memberId || item.uploadedBy === session.memberId;
  const isSM    = session.role === "schoolmaster";

  if (!isOwner && !isSM) {
    return res.status(403).json({ error: "Forbidden." });
  }

  const absPath = path.resolve("private/submissions", item.storedRelativePath);
  if (!fs.existsSync(absPath)) {
    return res.status(404).json({ error: "File not found." });
  }

  res.setHeader("Content-Type", item.mimeType || "application/octet-stream");
  res.setHeader(
    "Content-Disposition",
    `attachment; filename="${encodeURIComponent(item.originalFileName || "file")}"`
  );

  fs.createReadStream(absPath).pipe(res);
}

module.exports = { handler };
