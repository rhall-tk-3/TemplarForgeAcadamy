const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('fs');
const path = require('path');

const root = path.join(__dirname, '..');

test('required repository paths exist', () => {
  const requiredPaths = [
    'package.json',
    'src/config/curriculum/index.json',
    'src/controllers/curriculumController.js',
    'src/services/curriculumService.js',
    'tests/curriculumService.test.js',
    'public/index.html',
    'database/schema.sql',
    'database/migrations/001_create_curriculum_tables.sql'
  ];

  for (const relPath of requiredPaths) {
    assert.ok(fs.existsSync(path.join(root, relPath)), `${relPath} should exist`);
  }
});

test('public programs directory contains final program folders', () => {
  const programsDir = path.join(root, 'public', 'programs');
  const names = fs.readdirSync(programsDir);
  assert.ok(names.includes('knight'));
  assert.ok(names.includes('lieutenant'));
  assert.ok(names.includes('commander'));
});