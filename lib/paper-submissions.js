"use strict";

const fs             = require("fs");
const path           = require("path");
const sanitizeFilename = require("sanitize-filename");
const { v4: uuidv4 } = require("uuid");

const ROOT      = path.resolve("private/submissions");
const FILE_ROOT = path.join(ROOT, "files");
const META_FILE = path.join(ROOT, "metadata.json");

const ALLOWED_PROGRAMS = new Set([
  "knight-aspirant",
  "knight",
  "knight-lieutenant",
  "knight-captain",
  "knight-major",
  "knight-commander"
]);

const ALLOWED_EXTENSIONS = new Set([".pdf", ".docx"]);
const ALLOWED_MIME_TYPES = new Set([
  "application/pdf",
  "application/vnd.openxmlformats-officedocument.wordprocessingml.document"
]);

function ensureStore() {
  fs.mkdirSync(FILE_ROOT, { recursive: true });
  if (!fs.existsSync(META_FILE)) {
    fs.writeFileSync(META_FILE, JSON.stringify([], null, 2), "utf8");
  }
}

function readMetadata() {
  ensureStore();
  return JSON.parse(fs.readFileSync(META_FILE, "utf8"));
}

function writeMetadata(data) {
  ensureStore();
  fs.writeFileSync(META_FILE, JSON.stringify(data, null, 2), "utf8");
}

function safeLessonNumber(value) {
  const n = Number(value);
  if (!Number.isInteger(n) || n < 1 || n > 20) return null;
  return n;
}

function buildStoredFileName(originalName = "") {
  const safeOriginal = sanitizeFilename(originalName) || "submission";
  const ext  = path.extname(safeOriginal).toLowerCase();
  const base = path.basename(safeOriginal, ext).slice(0, 80) || "paper";
  const stamp = new Date().toISOString().replace(/[:.]/g, "-");
  return `${stamp}-${uuidv4()}-${base}${ext}`;
}

function makeMemberLessonFolder(memberId, programSlug, lessonNumber) {
  const folder = path.join(
    FILE_ROOT,
    sanitizeFilename(String(memberId)),
    sanitizeFilename(String(programSlug)),
    `lesson-${lessonNumber}`
  );
  fs.mkdirSync(folder, { recursive: true });
  return folder;
}

function createSubmissionRecord({
  session,
  memberId,
  fullName,
  programSlug,
  lessonNumber,
  lessonTitle,
  assignmentTitle,
  originalFileName,
  storedRelativePath,
  mimeType,
  fileSize
}) {
  return {
    submissionId:       uuidv4(),
    memberId,
    fullName,
    uploadedBy:         session.memberId,
    programSlug,
    lessonNumber,
    lessonTitle,
    assignmentTitle,
    originalFileName,
    storedRelativePath,
    mimeType,
    fileSize,
    status:             "submitted",
    grade:              "",
    feedback:           "",
    uploadedAt:         new Date().toISOString(),
    gradedAt:           null,
    gradedBy:           null
  };
}

module.exports = {
  FILE_ROOT,
  META_FILE,
  ALLOWED_PROGRAMS,
  ALLOWED_EXTENSIONS,
  ALLOWED_MIME_TYPES,
  ensureStore,
  readMetadata,
  writeMetadata,
  safeLessonNumber,
  buildStoredFileName,
  makeMemberLessonFolder,
  createSubmissionRecord
};
