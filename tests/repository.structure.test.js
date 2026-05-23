const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('fs');
const path = require('path');

const root = path.join(__dirname, '..');

test('required repository paths exist', () => {
  const requiredPaths = [
    'package.json',
    'src/config/curriculum/index.json',
    'src/config/repositoryResources.json',
    'src/controllers/curriculumController.js',
    'src/controllers/repositoryResourceController.js',
    'src/services/curriculumService.js',
    'src/services/repositoryResourceService.js',
    'tests/curriculumService.test.js',
    'tests/repositoryResources.test.js',
    'public/index.html',
    'public/app.js',
    'database/schema.sql',
    'database/migrations/001_create_curriculum_tables.sql',
    'database/migrations/003_create_shared_resource_tables.sql',
    '.dockerignore'
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
