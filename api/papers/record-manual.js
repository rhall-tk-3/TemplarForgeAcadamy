"use strict";
/**
 * POST /api/papers/record-manual
 *
 * Allows the Schoolmaster to manually record a paper submission on behalf of
 * a student — used when a student submitted a document but the system failed
 * to save it (e.g., due to a prior login/JWT issue).
 *
 * Body: {
 *   memberId       : string   — e.g. "KTKC-0004"
 *   fullName       : string   — e.g. "Ryan Patrick Hall"
 *   programSlug    : string   — e.g. "squire"
 *   lessonNumber   : number   — e.g. 3
 *   lessonTitle    : string   — e.g. "Week 3"
 *   assignmentTitle: string   — e.g. "Written Assignment"
 *   note           : string   — SM note explaining why recorded manually
 * }
 *
 * Auth: schoolmaster JWT only.
 */

const { requireSchoolmaster }           = require("../../lib/auth-session");
const { createSubmissionRecord, readMetadata, writeMetadata } = require("../../lib/paper-submissions");
const { v4: uuidv4 }                    = require("uuid");

async function handler(req, res) {
  if (req.method !== "POST") {
    return res.status(405).json({ error: "Method not allowed." });
  }

  const session = requireSchoolmaster(req, res);
  if (!session) return;

  const {
    memberId,
    fullName,
    programSlug,
    lessonNumber,
    lessonTitle,
    assignmentTitle,
    note
  } = req.body || {};

  if (!memberId || !fullName || !programSlug || !lessonNumber) {
    return res.status(400).json({ error: "memberId, fullName, programSlug, and lessonNumber are required." });
  }

  const ln = Number(lessonNumber);
  if (!Number.isInteger(ln) || ln < 1 || ln > 20) {
    return res.status(400).json({ error: "lessonNumber must be an integer 1–20." });
  }

  const submission = {
    submissionId:       uuidv4(),
    memberId:           String(memberId).trim(),
    fullName:           String(fullName).trim(),
    uploadedBy:         session.memberId || "schoolmaster",
    programSlug:        String(programSlug).trim(),
    lessonNumber:       ln,
    lessonTitle:        String(lessonTitle || `Week ${ln}`).trim(),
    assignmentTitle:    String(assignmentTitle || "Written Assignment").trim(),
    originalFileName:   `[Manual Record] ${String(assignmentTitle || "Written Assignment").trim()}`,
    storedRelativePath: null,
    mimeType:           null,
    fileSize:           0,
    status:             "submitted",
    grade:              "",
    feedback:           "",
    uploadedAt:         new Date().toISOString(),
    gradedAt:           null,
    gradedBy:           null,
    lostUpload:         true,
    note:               String(note || "Manually recorded by Schoolmaster.").trim(),
    recordedBy:         session.fullName || "Schoolmaster",
  };

  const meta = readMetadata();
  meta.unshift(submission);
  writeMetadata(meta);

  return res.status(200).json({ ok: true, submission });
}

module.exports = { handler };
