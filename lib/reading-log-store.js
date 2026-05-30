"use strict";
/**
 * Reading-log persistence helpers.
 * Storage: private/reading-log/logs.json
 * Shape:   Array of member objects, each with a `programs` keyed object.
 */

const fs   = require("fs");
const path = require("path");

const ROOT = path.resolve("private/reading-log");
const FILE = path.join(ROOT, "logs.json");

function ensureStore() {
  fs.mkdirSync(ROOT, { recursive: true });
  if (!fs.existsSync(FILE)) {
    fs.writeFileSync(FILE, JSON.stringify([], null, 2), "utf8");
  }
}

function readAllLogs() {
  ensureStore();
  return JSON.parse(fs.readFileSync(FILE, "utf8"));
}

function writeAllLogs(data) {
  ensureStore();
  fs.writeFileSync(FILE, JSON.stringify(data, null, 2), "utf8");
}

function getMemberLog(allLogs, session) {
  const found = allLogs.find((x) => x.memberId === session.memberId);
  if (found) return found;

  return {
    memberId: session.memberId,
    fullName: session.fullName || session.memberId,
    role: session.role || "member",
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
    programs: {}
  };
}

function upsertMemberProgramLog(allLogs, session, programSlug, programState) {
  const now = new Date().toISOString();
  let member = allLogs.find((x) => x.memberId === session.memberId);

  if (!member) {
    member = {
      memberId: session.memberId,
      fullName: session.fullName || session.memberId,
      role: session.role || "member",
      createdAt: now,
      updatedAt: now,
      programs: {}
    };
    allLogs.unshift(member);
  }

  const existingProgram = member.programs[programSlug] || {};

  member.fullName = session.fullName || member.fullName || session.memberId;
  member.updatedAt = now;
  member.programs[programSlug] = {
    ...existingProgram,
    ...programState,
    programSlug,
    updatedAt: now,
    submittedAt: existingProgram.submittedAt || null
  };

  return allLogs;
}

function markProgramSubmitted(allLogs, session, programSlug) {
  const now = new Date().toISOString();
  let member = allLogs.find((x) => x.memberId === session.memberId);

  if (!member) {
    member = {
      memberId: session.memberId,
      fullName: session.fullName || session.memberId,
      role: session.role || "member",
      createdAt: now,
      updatedAt: now,
      programs: {}
    };
    allLogs.unshift(member);
  }

  const current = member.programs[programSlug] || {
    programSlug,
    weeks: [],
    summary: { totalDocs: 0, completedDocs: 0, completionPct: 0 }
  };
  current.submittedAt = now;
  current.updatedAt   = now;
  member.programs[programSlug] = current;
  member.updatedAt = now;
  return allLogs;
}

module.exports = {
  readAllLogs,
  writeAllLogs,
  getMemberLog,
  upsertMemberProgramLog,
  markProgramSubmitted
};
