const fs = require('fs');
const path = require('path');

const configPath = path.join(__dirname, '..', 'config', 'curriculum', 'full-program-curriculum.json');

// Module-level cache so every call within the same process shares the SAME
// parsed object tree.  This is critical: getProgramCourse() and getProgramWeek()
// must return objects that belong to the same tree so Array.prototype.indexOf()
// works correctly in submissionStoreService (weekIdx lookup).
// The cache is invalidated whenever the file's mtime changes, allowing hot-
// reloads in development without restarting the server.
let _cache = null;
let _cacheMtime = 0;

function readFullCurriculum() {
  try {
    const mtime = fs.statSync(configPath).mtimeMs;
    if (!_cache || mtime !== _cacheMtime) {
      _cache = JSON.parse(fs.readFileSync(configPath, 'utf8'));
      _cacheMtime = mtime;
    }
    return _cache;
  } catch (_e) {
    // Fallback: parse fresh on any stat/read error
    return JSON.parse(fs.readFileSync(configPath, 'utf8'));
  }
}

function getFullCurriculumPrograms() {
  return readFullCurriculum().programs;
}

function getProgramCourse(slug) {
  return getFullCurriculumPrograms().find((program) => program.slug === slug) || null;
}

function getProgramWeek(slug, weekNumber) {
  const course = getProgramCourse(slug);
  if (!course) return null;
  const n = Number(weekNumber);
  // Primary: explicit week_number field
  const byField = course.weeks.find((week) => Number(week.week_number) === n);
  if (byField) return byField;
  // Fallback: 1-based positional index (handles weeks that have no week_number key,
  // e.g. squire and levie programs in full-program-curriculum.json).
  // Because readFullCurriculum() is now cached, the week object returned here
  // belongs to the SAME array as course.weeks — so indexOf() in
  // submissionStoreService will return the correct index, not -1.
  const byIndex = course.weeks[n - 1];
  return byIndex || null;
}

function getSharedLibrary() {
  return readFullCurriculum().library || {};
}

module.exports = {
  readFullCurriculum,
  getFullCurriculumPrograms,
  getProgramCourse,
  getProgramWeek,
  getSharedLibrary
};
