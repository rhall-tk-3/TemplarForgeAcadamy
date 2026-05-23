const express = require('express');
const { getCurriculumIndex, getProgramBySlug, getProgramsByPhase } = require('../services/curriculumService');
const { buildProgramManifest } = require('../services/fileManifestService');

const router = express.Router();

router.get('/', (_req, res) => {
  res.json({ programs: getCurriculumIndex() });
});

router.get('/phases', (_req, res) => {
  res.json({ phases: getProgramsByPhase() });
});

router.get('/:slug', (req, res) => {
  const program = getProgramBySlug(req.params.slug);
  if (!program) {
    return res.status(404).json({ error: 'Program not found' });
  }

  const manifest = buildProgramManifest(req.params.slug);
  return res.json({
    ...program,
    manifestSummary: manifest.counts
  });
});

router.get('/:slug/manifest/files', (req, res) => {
  const program = getProgramBySlug(req.params.slug);
  if (!program) {
    return res.status(404).json({ error: 'Program not found' });
  }
  return res.json(buildProgramManifest(req.params.slug));
});

module.exports = { router };
