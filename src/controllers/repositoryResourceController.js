'use strict';

const express = require('express');
const { getRepositoryResources, getDocumentsForProgram } = require('../services/repositoryResourceService');
const { findById } = require('../auth/userStore');

const router = express.Router();

// GET /api/resources
// Legacy full config — kept for backward compat
router.get('/', (_req, res) => {
  return res.json(getRepositoryResources());
});

// GET /api/resources/for-program
// Returns the document sections appropriate for the signed-in member's
// current program + completed history:
//   • Current program handbook + lesson outline
//   • All previous handbooks (cumulative)
//   • Permanent promotion manual (always)
router.get('/for-program', (req, res) => {
  if (!req.session || !req.session.userId) {
    return res.status(401).json({ error: 'Not signed in.' });
  }

  const user = findById(req.session.userId);
  if (!user) {
    return res.status(401).json({ error: 'Session expired.' });
  }

  const currentSlug    = user.assignedProgram || null;
  const completedSlugs = (user.programHistory || [])
    .filter(h => h.completedAt)
    .map(h => h.slug);

  return res.json(getDocumentsForProgram(currentSlug, completedSlugs));
});

module.exports = { router };
