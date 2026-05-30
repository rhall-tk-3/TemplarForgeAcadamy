const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('fs');
const path = require('path');

const root = path.join(__dirname, '..');

function read(relPath) {
  return fs.readFileSync(path.join(root, relPath), 'utf8');
}

test('document viewer assets exist', () => {
  assert.ok(fs.existsSync(path.join(root, 'public', 'viewer', 'index.html')));
  assert.ok(fs.existsSync(path.join(root, 'public', 'assets', 'document-link-enhancer.js')));
});

test('representative curriculum pages include the document enhancer script', () => {
  const pages = [
    'public/index.html',
    'public/programs/knight/site/index.html',
    'public/programs/corporal/site/weeks/index.html',
    'public/programs/commander/site/schoolmaster/index.html',
  ];

  for (const relPath of pages) {
    assert.match(read(relPath), /\/assets\/document-link-enhancer\.js/);
  }
});

test('viewer page provides open and download actions', () => {
  const viewerHtml = read('public/viewer/index.html');
  assert.match(viewerHtml, /Open [Dd]irect/);
  assert.match(viewerHtml, /Download/);
  assert.match(viewerHtml, /iframe/);
});
