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

function readConfig() {
  return JSON.parse(fs.readFileSync(configPath, 'utf8'));
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

function getCurriculumIndex() {
  return readConfig().programs.map(enrichProgram);
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
