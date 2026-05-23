const express        = require('express');
const path           = require('path');
const session        = require('express-session');
const { getCurriculumIndex, getProgramBySlug } = require('./src/services/curriculumService');
const curriculumController      = require('./src/controllers/curriculumController');
const healthController          = require('./src/controllers/healthController');
const repositoryResourceController = require('./src/controllers/repositoryResourceController');
const authRouter                = require('./src/auth/authRouter');
const { getAllUsers }            = require('./src/auth/userStore');

const app  = express();
const PORT = process.env.PORT || 3000;

// ── MIDDLEWARE ──
app.use(express.json());
app.use(session({
  secret:            process.env.SESSION_SECRET || 'templar-forge-secret-2026',
  resave:            false,
  saveUninitialized: false,
  cookie: { maxAge: 8 * 60 * 60 * 1000 } // 8 hours
}));

// ── AUTH GUARDS ──
function requireMember(req, res, next) {
  if (!req.session.userId) return res.redirect('/login');
  next();
}
function requireAdmin(req, res, next) {
  if (!req.session.userId) return res.redirect('/login');
  if (req.session.role !== 'admin') return res.redirect('/member');
  next();
}

// ── API ROUTES ──
app.use('/api/health',    healthController.router);
app.use('/api/curriculum', curriculumController.router);
app.use('/api/resources',  repositoryResourceController.router);

app.get('/api/programs', (_req, res) => {
  res.json({ programs: getCurriculumIndex() });
});
app.get('/api/programs/:slug', (req, res) => {
  const program = getProgramBySlug(req.params.slug);
  if (!program) return res.status(404).json({ error: 'Program not found' });
  return res.json(program);
});

// ── AUTH ROUTES ──
app.use('/auth', authRouter);

// ── ADMIN API ──
app.get('/admin/members', requireAdmin, (_req, res) => {
  res.json({ members: getAllUsers() });
});

// ── PAGE ROUTES ──
// Landing / welcome page
app.get('/', (_req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'index.html'));
});

// Login page
app.get('/login', (_req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'login-portal.html'));
});

// Register page
app.get('/register', (_req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'register.html'));
});

// Member dashboard (protected)
app.get('/member', requireMember, (req, res) => {
  if (req.session.role === 'admin') return res.redirect('/schoolmaster');
  res.sendFile(path.join(__dirname, 'public', 'member-dashboard.html'));
});

// Schoolmaster / Admin dashboard (protected, admin only)
app.get('/schoolmaster', requireAdmin, (_req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'schoolmaster-dashboard.html'));
});

// Repository dashboard (legacy)
app.get('/dashboard', (_req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'dashboard.html'));
});

// ── STATIC FILES (after routes so /index.html doesn't hijack /) ──
app.use(express.static(path.join(__dirname, 'public')));

// ── START ──
if (require.main === module) {
  app.listen(PORT, () => {
    console.log(`KTKC Templar Forge Academy running on http://localhost:${PORT}`);
    console.log(`Admin key: ${process.env.ADMIN_KEY || 'forge-master-2026'}`);
  });
}

module.exports = app;
