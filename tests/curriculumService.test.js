const test = require('node:test');
const assert = require('node:assert/strict');
const { getCurriculumIndex, getProgramBySlug, getProgramsByPhase } = require('../src/services/curriculumService');

test('curriculum index includes expected programs', () => {
  const programs = getCurriculumIndex();
  assert.ok(Array.isArray(programs));
  assert.ok(programs.length >= 11);
  assert.ok(programs.some((program) => program.slug === 'major'));
  assert.ok(programs.some((program) => program.slug === 'commander'));
});

test('program lookup returns enriched metadata', () => {
  const program = getProgramBySlug('captain');
  assert.ok(program);
  assert.equal(program.title, 'Captain School Program');
  assert.ok(program.resources.length >= 3);
  assert.equal(program.durationLabel, '12 weeks');
  assert.equal(program.hasSyllabus, true);
  assert.ok(program.manifestEndpoint);
});

test('programs can be grouped by phase', () => {
  const phases = getProgramsByPhase();
  assert.ok(phases['Officer Formation Level IV']);
  assert.ok(phases['Foundational rank']);
});
