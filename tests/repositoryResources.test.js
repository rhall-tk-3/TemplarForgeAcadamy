const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('fs');
const path = require('path');
const { getRepositoryResources } = require('../src/services/repositoryResourceService');

const root = path.join(__dirname, '..');

test('repository resources config exposes both document sections', () => {
  const config = getRepositoryResources();
  assert.equal(config.sections.length, 2);
  assert.equal(config.totalItems, 7);
  assert.ok(config.sections.some((section) => section.key === 'core-documents'));
  assert.ok(config.sections.some((section) => section.key === 'schoolmaster-forms'));
});

test('shared resource files exist in public resources', () => {
  const requiredFiles = [
    'public/resources/core-documents/18-Curriculum-Handbook.pdf',
    'public/resources/core-documents/19-Weekly-Lesson-Plan-Packet.pdf',
    'public/resources/core-documents/20-Promotion-and-Assessment-Guide.pdf',
    'public/resources/schoolmaster-forms/26-Fillable-Attendance-Sheets.pdf',
    'public/resources/schoolmaster-forms/27-Fillable-Oral-Review-Rubrics.pdf',
    'public/resources/schoolmaster-forms/28-Fillable-Advancement-Checklists.pdf',
    'public/resources/schoolmaster-forms/29-Fillable-Final-Evaluation-Forms.pdf'
  ];

  for (const relPath of requiredFiles) {
    assert.ok(fs.existsSync(path.join(root, relPath)), `${relPath} should exist`);
  }
});

test('officer compatibility alias pages exist', () => {
  const requiredFiles = [
    'public/programs/captain/site/weeks/index.html',
    'public/programs/captain/site/schoolmaster/index.html',
    'public/programs/major/site/weeks/index.html',
    'public/programs/major/site/schoolmaster/index.html',
    'public/programs/commander/site/weeks/index.html',
    'public/programs/commander/site/schoolmaster/index.html'
  ];

  for (const relPath of requiredFiles) {
    assert.ok(fs.existsSync(path.join(root, relPath)), `${relPath} should exist`);
  }
});
