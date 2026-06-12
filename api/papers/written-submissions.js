"use strict";
/**
 * GET /api/papers/written-submissions
 *
 * Returns all written (discussion/exam) submissions stored in users.json
 * (user.examSubmissions[]) for every member, formatted so the Paper
 * Grading Hub can merge them alongside file-upload submissions.
 *
 * Each item shape:
 * {
 *   submissionId   : "<userId>-exam-<index>",   // stable unique id
 *   memberId       : string,
 *   fullName       : string,
 *   programSlug    : string,
 *   lessonNumber   : number,                    // = week number
 *   lessonTitle    : string,
 *   assignmentTitle: "Written Assignment",
 *   submissionType : "written",                 // distinguishes from file uploads
 *   answers        : [{ question, answer }],
 *   status         : "submitted" | "graded",
 *   grade          : string,
 *   feedback       : string,                    // stored as notes
 *   uploadedAt     : ISO string,                // = submittedAt
 *   gradedAt       : ISO string | null,
 *   gradedBy       : null,
 *   originalFileName: null,                     // no file — UI handles gracefully
 * }
 *
 * Auth: schoolmaster JWT only.
 */

const { requireSchoolmaster } = require("../../lib/auth-session");
const { getMemberUsers }      = require("../../src/auth/userStore");

function handler(req, res) {
  if (req.method !== "GET") {
    return res.status(405).json({ error: "Method not allowed." });
  }

  const session = requireSchoolmaster(req, res);
  if (!session) return;

  const members = getMemberUsers();
  const items   = [];

  members.forEach(user => {
    const subs = user.examSubmissions || [];
    subs.forEach((sub, idx) => {
      // Determine status: if reviewedAt is set and grade is non-empty → graded,
      // otherwise treat as submitted (pending review).
      const graded = sub.reviewedAt && sub.grade && sub.grade !== "";
      const status = graded ? "graded" : "submitted";

      // Resolve a display label for the program section
      const prog = sub.programSlug || "";
      const week = Number(sub.week || sub.weekNumber || 0);

      items.push({
        submissionId:    `${user.id}-exam-${idx}`,
        memberId:        user.memberId || user.id,
        fullName:        user.username || user.name || user.memberId || "Unknown",
        programSlug:     prog,
        lessonNumber:    week,
        lessonTitle:     week ? `Week ${week}` : "",
        assignmentTitle: "Written Assignment",
        submissionType:  "written",
        answers:         sub.answers || [],
        status,
        grade:           sub.grade   || "",
        feedback:        sub.notes   || "",
        uploadedAt:      sub.submittedAt  || new Date(0).toISOString(),
        gradedAt:        sub.reviewedAt   || null,
        gradedBy:        null,
        originalFileName: null,
      });
    });
  });

  // Newest first
  items.sort((a, b) => new Date(b.uploadedAt) - new Date(a.uploadedAt));

  res.status(200).json({ items });
}

module.exports = { handler };
