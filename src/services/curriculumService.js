const fs = require('fs');
const path = require('path');

const configPath = path.join(__dirname, '..', 'config', 'curriculum', 'index.json');
const defaultSharedResourceKeys = [
  'curriculum-handbook',
  'weekly-lesson-plan-packet',
  'promotion-and-assessment-guide',
  'attendance-sheets',
  'oral-review-rubrics',
  'advancement-checklists',
  'final-evaluation-forms'
];

// ── In-process mtime-gated cache (mirrors fullCurriculumService pattern) ──────
// curriculum/index.json is read-only at runtime (never written by the app),
// so in practice this cache is populated once and never invalidated.
// mtime checks ensure hot-reloads still work in development.
let _cache      = null;
let _cacheMtime = 0;

function readConfig() {
  try {
    const mtime = fs.statSync(configPath).mtimeMs;
    if (_cache && mtime === _cacheMtime) return _cache;
    _cache      = JSON.parse(fs.readFileSync(configPath, 'utf8'));
    _cacheMtime = mtime;
    return _cache;
  } catch (_e) {
    _cache      = JSON.parse(fs.readFileSync(configPath, 'utf8'));
    _cacheMtime = 0;
    return _cache;
  }
}

function enrichProgram(program) {
  const durationWeeks = Number(program.durationWeeks || 0);
  const resourceCount = Array.isArray(program.resources) ? program.resources.length : 0;

  return {
    ...program,
    durationWeeks,
    durationLabel: durationWeeks ? `${durationWeeks} week${durationWeeks === 1 ? '' : 's'}` : 'Self-paced',
    resourceCount,
    hasDownloads: resourceCount > 0,
    sharedResourceKeys: program.sharedResourceKeys || defaultSharedResourceKeys,
    apiEndpoint: `/api/curriculum/${program.slug}`,
    legacyApiEndpoint: `/api/programs/${program.slug}`,
    manifestEndpoint: `/api/curriculum/${program.slug}/manifest/files`
  };
}

// Enriched-program cache — rebuilt when readConfig() cache is refreshed
let _indexCache     = null;
let _indexCacheMtime = 0;

function getCurriculumIndex() {
  try {
    const mtime = fs.statSync(configPath).mtimeMs;
    if (_indexCache && mtime === _indexCacheMtime) return _indexCache;
    _indexCache      = readConfig().programs.map(enrichProgram);
    _indexCacheMtime = mtime;
    return _indexCache;
  } catch (_e) {
    return readConfig().programs.map(enrichProgram);
  }
}

function getProgramBySlug(slug) {
  return getCurriculumIndex().find((program) => program.slug === slug) || null;
}

function getProgramsByPhase() {
  return getCurriculumIndex().reduce((groups, program) => {
    groups[program.phase] ||= [];
    groups[program.phase].push(program);
    return groups;
  }, {});
}

module.exports = {
  readConfig,
  enrichProgram,
  getCurriculumIndex,
  getProgramBySlug,
  getProgramsByPhase
};
