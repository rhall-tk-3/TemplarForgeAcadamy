const express = require('express');

const router = express.Router();

router.get('/', (_req, res) => {
  res.json({
    status: 'ok',
    service: 'ktkc-school-programs-repository',
    timestamp: new Date().toISOString()
  });
});

module.exports = { router };
