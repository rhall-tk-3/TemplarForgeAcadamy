const test = require('node:test');
const assert = require('node:assert/strict');
const app = require('../server');

test('api smoke routes respond with operational metadata', async (t) => {
  const server = app.listen(0);
  t.after(() => server.close());

  const { port } = server.address();
  const baseUrl = `http://127.0.0.1:${port}`;

  const health = await fetch(`${baseUrl}/api/health`).then((response) => response.json());
  assert.equal(health.status, 'ok');

  const curriculum = await fetch(`${baseUrl}/api/curriculum`).then((response) => response.json());
  assert.ok(Array.isArray(curriculum.programs));
  assert.ok(curriculum.programs.some((program) => program.slug === 'commander'));

  const resources = await fetch(`${baseUrl}/api/resources`).then((response) => response.json());
  assert.equal(resources.totalItems, 7);

  const captain = await fetch(`${baseUrl}/api/curriculum/captain`).then((response) => response.json());
  assert.equal(captain.slug, 'captain');
  assert.ok(captain.manifestSummary.totalFiles >= 1);

  const aliasHtml = await fetch(`${baseUrl}/programs/captain/site/weeks/index.html`).then((response) => response.text());
  assert.match(aliasHtml, /Compatibility Redirect/);
});
