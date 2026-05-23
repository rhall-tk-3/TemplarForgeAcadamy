const express = require('express');
const path = require('path');
const { getCurriculumIndex, getProgramBySlug } = require('./src/services/curriculumService');
const curriculumController = require('./src/controllers/curriculumController');
const healthController = require('./src/controllers/healthController');
const repositoryResourceController = require('./src/controllers/repositoryResourceController');

const app = express();
const PORT = process.env.PORT || 3000;

app.use(express.json());
app.use('/api/health', healthController.router);
app.use('/api/curriculum', curriculumController.router);
app.use('/api/resources', repositoryResourceController.router);
app.use(express.static(path.join(__dirname, 'public')));

app.get('/api/programs', (_req, res) => {
  res.json({ programs: getCurriculumIndex() });
});

app.get('/api/programs/:slug', (req, res) => {
  const program = getProgramBySlug(req.params.slug);
  if (!program) {
    return res.status(404).json({ error: 'Program not found' });
  }
  return res.json(program);
});

app.get('/', (_req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'index.html'));
});

if (require.main === module) {
  app.listen(PORT, () => {
    console.log(`KTKC curriculum repository running on http://localhost:${PORT}`);
  });
}

module.exports = app;
