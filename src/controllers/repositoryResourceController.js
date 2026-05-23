const express = require('express');
const { getRepositoryResources, getResourceSection } = require('../services/repositoryResourceService');

const router = express.Router();

router.get('/', (_req, res) => {
  return res.json(getRepositoryResources());
});

router.get('/:sectionKey', (req, res) => {
  const section = getResourceSection(req.params.sectionKey);
  if (!section) {
    return res.status(404).json({ error: 'Resource section not found' });
  }

  return res.json(section);
});

module.exports = { router };
