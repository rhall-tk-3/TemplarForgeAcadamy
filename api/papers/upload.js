"use strict";
/**
 * POST /api/papers/upload
 * Accepts multipart/form-data with fields:
 *   programSlug, lessonNumber, lessonTitle, assignmentTitle, paper (file)
 *
 * Auth: valid academy_session JWT (any authenticated member).
 */

const path       = require("path");
const fs         = require("fs");
const formidable = require("formidable");
const { requireSession } = require("../../lib/auth-session");
const {
  ALLOWED_PROGRAMS,
  ALLOWED_EXTENSIONS,
  ALLOWED_MIME_TYPES,
  safeLessonNumber,
  makeMemberLessonFolder,
  buildStoredFileName,
  createSubmissionRecord,
  readMetadata,
  writeMetadata
} = require("../../lib/paper-submissions");

const MAX_FILE_BYTES = 10 * 1024 * 1024; // 10 MB

function parseForm(req) {
  const form = formidable({
    multiples:      false,
    maxFileSize:    MAX_FILE_BYTES,
    keepExtensions: true
  });
  return new Promise((resolve, reject) => {
    form.parse(req, (err, fields, files) => {
      if (err) reject(err);
      else resolve({ fields, files });
    });
  });
}

async function handler(req, res) {
  if (req.method !== "POST") {
    return res.status(405).json({ error: "Method not allowed." });
  }

  const session = requireSession(req, res);
  if (!session) return;

  let fields, files;
  try {
    ({ fields, files } = await parseForm(req));
  } catch (err) {
    const msg = (err.code === "LIMIT_FILE_SIZE" || err.message?.includes("maxFileSize"))
      ? "File exceeds the 10 MB limit."
      : "Upload error: " + err.message;
    return res.status(400).json({ error: msg });
  }

  // Normalise formidable v2/v3 field shapes (array vs scalar)
  const f = v => (Array.isArray(v) ? v[0] : v);

  const programSlug     = String(f(fields.programSlug)     || "").trim();
  const lessonNumber    = safeLessonNumber(f(fields.lessonNumber));
  const lessonTitle     = String(f(fields.lessonTitle)     || "").trim();
  const assignmentTitle = String(f(fields.assignmentTitle) || "").trim();

  // File field is named "paper" (matches the upload form's fd.append("paper", ...))
  const paper = files.paper
    ? (Array.isArray(files.paper) ? files.paper[0] : files.paper)
    : null;

  if (!ALLOWED_PROGRAMS.has(programSlug)) {
    return res.status(400).json({ error: "Invalid program." });
  }
  if (!lessonNumber) {
    return res.status(400).json({ error: "lessonNumber must be an integer between 1 and 20." });
  }
  if (!lessonTitle || !assignmentTitle) {
    return res.status(400).json({ error: "Missing upload fields." });
  }
  if (!paper) {
    return res.status(400).json({ error: "No file received." });
  }

  const originalName = paper.originalFilename || paper.name || "submission";
  const ext          = path.extname(originalName).toLowerCase();
  const mimeType     = paper.mimetype || paper.type || "";
  const fileSize     = paper.size || 0;
  const tmpPath      = paper.filepath || paper.path;

  if (!ALLOWED_EXTENSIONS.has(ext)) {
    fs.unlink(tmpPath, () => {});
    return res.status(400).json({ error: "Only .docx and .pdf files are allowed." });
  }
  if (!ALLOWED_MIME_TYPES.has(mimeType)) {
    fs.unlink(tmpPath, () => {});
    return res.status(400).json({ error: "Invalid MIME type." });
  }

  const memberId = session.memberId;
  const fullName = session.fullName || session.name || memberId;

  const targetDir        = makeMemberLessonFolder(memberId, programSlug, lessonNumber);
  const storedFileName   = buildStoredFileName(originalName);
  const finalPath        = path.join(targetDir, storedFileName);
  const storedRelativePath = path.relative(path.resolve("private/submissions"), finalPath);

  try {
    fs.copyFileSync(tmpPath, finalPath);
    fs.unlink(tmpPath, () => {});
  } catch (err) {
    return res.status(500).json({ error: "Failed to store file." });
  }

  const meta       = readMetadata();
  const submission = createSubmissionRecord({
    session,
    memberId,
    fullName,
    programSlug,
    lessonNumber,
    lessonTitle,
    assignmentTitle,
    originalFileName:   originalName,
    storedRelativePath,
    mimeType,
    fileSize
  });

  meta.unshift(submission);
  writeMetadata(meta);

  return res.status(200).json({ ok: true, submission });
}

module.exports = { handler };
