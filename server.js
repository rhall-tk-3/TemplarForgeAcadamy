const express        = require('express');
const path           = require('path');
const session        = require('express-session');
const { getCurriculumIndex, getProgramBySlug } = require('./src/services/curriculumService');
const curriculumController      = require('./src/controllers/curriculumController');
const healthController          = require('./src/controllers/healthController');
const repositoryResourceController = require('./src/controllers/repositoryResourceController');
const authRouter                = require('./src/auth/authRouter');
const progressionRouter         = require('./src/auth/progressionRouter');
const profileRouter             = require('./src/auth/profileRouter');
const { getAllUsers, seedSchoolmaster } = require('./src/auth/userStore');
const assessmentService = require('./src/services/assessmentService');
const assessmentController  = require('./src/controllers/assessmentController');

const app  = express();
const PORT = process.env.PORT || 3000;

// Trust Nginx/Railway reverse proxy — required for correct IP, HTTPS detection, and secure cookies
app.set('trust proxy', 1);

// Cookie security — Secure flag on HTTPS (Railway/production), strict same-site
const IS_PROD = process.env.NODE_ENV === 'production';
const COOKIE_SECURE = IS_PROD ? '; Secure' : '';
const SESSION_COOKIE = (token) =>
  `academy_session=${token}; HttpOnly; Path=/; SameSite=Strict; Max-Age=28800${COOKIE_SECURE}`;
const CLEAR_COOKIE = `academy_session=; HttpOnly; Path=/; SameSite=Strict; Max-Age=0${COOKIE_SECURE}`;

// ── MIDDLEWARE ──
app.use(express.json());
app.use(session({
  secret:            process.env.SESSION_SECRET || 'templar-forge-secret-2026',
  resave:            false,
  saveUninitialized: false,
  cookie: {
    maxAge:   8 * 60 * 60 * 1000, // 8 hours
    secure:   IS_PROD,             // HTTPS only in production
    sameSite: 'strict',
    httpOnly: true
  }
}));

// ── JWT helper — verifies the HttpOnly academy_session cookie ──
const jwt = require('jsonwebtoken');
const JWT_SECRET = process.env.JWT_SECRET || 'templar-jwt-secret-2026';

function verifyJwtCookie(req) {
  // Parse the raw Cookie header manually — express-session doesn't parse our JWT cookie
  const raw = req.headers.cookie || '';
  const match = raw.match(/(?:^|;\s*)academy_session=([^;]+)/);
  if (!match) return null;
  try {
    return jwt.verify(match[1], JWT_SECRET);
  } catch (_) {
    return null;
  }
}

// Hydrate req.session from a valid JWT payload when Express session is absent.
// This happens when members log in via the registry path (JWT-only) and then
// hit a session-gated route such as /api/doc-render or /api/programs/:slug/lessons.
function hydrateSessionFromJwt(req) {
  if (req.session.userId) return true;          // session already populated
  const payload = verifyJwtCookie(req);
  if (!payload) return false;
  // Resolve the internal user id from the JWT payload (fullName or memberId)
  const allUsers = getAllUsers ? getAllUsers() : [];
  let user = null;
  if (payload.fullName) {
    user = allUsers.find(u => u.username && u.username.trim().toUpperCase() === payload.fullName.trim().toUpperCase());
  }
  if (!user && payload.memberId) {
    user = allUsers.find(u => u.memberId && u.memberId.trim().toUpperCase() === payload.memberId.trim().toUpperCase());
  }
  if (!user) {
    // JWT is valid but user not in userStore (e.g. registry-only accounts that haven't been
    // promoted yet) — grant a temporary session from JWT claims so pages load
    req.session.userId   = payload.memberId || payload.fullName || 'jwt-user';
    req.session.role     = payload.role || 'member';
    req.session.username = payload.fullName || '';
    return true;
  }
  req.session.userId   = user.id;
  req.session.role     = user.role;
  req.session.username = user.username;
  return true;
}

// ── AUTH GUARDS ──
// API routes (path starts with /api/ or is called by fetch) must receive a
// JSON 401 on auth failure, NOT an HTML redirect.  A redirect causes the
// browser's fetch() to follow to /login, get back HTML, and then fail with
// "Unexpected token '<'" when the caller tries to .json() the response.
function isApiRequest(req) {
  return req.path.startsWith('/api/') ||
         (req.headers['accept'] && req.headers['accept'].includes('application/json')) ||
         req.xhr;
}
function requireMember(req, res, next) {
  if (hydrateSessionFromJwt(req)) return next();
  if (isApiRequest(req)) return res.status(401).json({ error: 'Session expired. Please log in again.', redirect: '/login' });
  return res.redirect('/login');
}
function requireAdmin(req, res, next) {
  if (!hydrateSessionFromJwt(req)) {
    if (isApiRequest(req)) return res.status(401).json({ error: 'Session expired. Please log in again.', redirect: '/login' });
    return res.redirect('/login');
  }
  if (req.session.role !== 'admin') {
    if (isApiRequest(req)) return res.status(403).json({ error: 'Admin access required.' });
    return res.redirect('/member');
  }
  next();
}

// ── API ROUTES ──
app.use('/api/health',      healthController.router);
app.use('/api/curriculum',  curriculumController.router);
app.use('/api/resources',   repositoryResourceController.router);
app.use('/api/progression', progressionRouter);
app.use('/api/profile',     profileRouter);

app.get('/api/programs', (_req, res) => {
  res.json({ programs: getCurriculumIndex() });
});
app.get('/api/programs/:slug', (req, res) => {
  const program = getProgramBySlug(req.params.slug);
  if (!program) return res.status(404).json({ error: 'Program not found' });
  return res.json(program);
});

// GET /api/programs/:slug/lessons — full lesson data (weeks array) for program hub page
app.get('/api/programs/:slug/lessons', requireMember, (req, res) => {
  const slug = req.params.slug;
  if (!VALID_SLUGS.includes(slug)) return res.status(404).json({ error: 'Program not found' });
  const lessonPath = path.join(__dirname, 'src', 'config', 'curriculum', 'lessons', `${slug}.json`);
  const fullCurrPath = path.join(__dirname, 'src', 'config', 'curriculum', 'full-program-curriculum.json');
  try {
    const data = JSON.parse(require('fs').readFileSync(lessonPath, 'utf8'));
    // Merge required_reading and quiz_questions from full curriculum JSON into each week
    try {
      const fullCurr = JSON.parse(require('fs').readFileSync(fullCurrPath, 'utf8'));
      const program = (fullCurr.programs || []).find((p) => p.slug === slug);
      if (program) {
        // full-program-curriculum.json weeks are stored in order without a week_number field;
        // map by 1-based index so week 1 → index 0, week 2 → index 1, etc.
        const fullWeeks = program.weeks || [];
        const weekMap = {};
        fullWeeks.forEach((w, i) => {
          // Support explicit week_number if present, otherwise use position
          const key = (w.week_number != null) ? Number(w.week_number) : (i + 1);
          weekMap[key] = w;
        });
        data.weeks = (data.weeks || []).map((w) => {
          const full = weekMap[Number(w.week)] || {};
          return {
            ...w,
            required_reading: full.required_reading || [],
            quiz_questions: full.quiz_questions || [],
            passing_score: full.passing_score || 70,
            discussion_questions: full.discussion_questions || []
          };
        });
      }
    } catch (_e) { /* full curriculum merge is best-effort */ }
    // Merge index metadata with lesson content
    const meta = getProgramBySlug(slug) || {};
    res.json({ ...meta, ...data });
  } catch (e) {
    res.status(404).json({ error: 'Lesson data not found', detail: e.message });
  }
});


app.use('/auth', authRouter);

// ── /api/auth — adapter routes for the combined login portal ──
// The new academy-auth.js client posts to /api/auth/login and /api/auth/register
// with the payload shape { fullName, memberId, email?, password }.
// These routes translate that shape to the existing userStore internals so no
// changes are needed to authRouter or userStore.
(function registerApiAuth() {
  const bcrypt = require('bcryptjs');
  const fsSync = require('fs');
  const { ACCOUNTS_FILE, REGISTRY_FILE } = require('./src/config/dataPaths');

  // ── Helpers for private/accounts.json and private/member-registry.json ──
  // These files live outside the main userStore so that registry-validated
  // member accounts are kept separate from the seeded admin account.
  const ACCOUNTS_PATH = ACCOUNTS_FILE;
  const REGISTRY_PATH = REGISTRY_FILE;

  function readAccounts() {
    if (!fsSync.existsSync(ACCOUNTS_PATH)) return [];
    return JSON.parse(fsSync.readFileSync(ACCOUNTS_PATH, 'utf8'));
  }

  function writeAccounts(accounts) {
    fsSync.mkdirSync(path.dirname(ACCOUNTS_PATH), { recursive: true });
    fsSync.writeFileSync(ACCOUNTS_PATH, JSON.stringify(accounts, null, 2), 'utf8');
  }

  function readRegistry() {
    if (!fsSync.existsSync(REGISTRY_PATH)) return [];
    return JSON.parse(fsSync.readFileSync(REGISTRY_PATH, 'utf8'));
  }

  // ── POST /api/auth/login  { fullName, memberId, password } ──
  // Member login: validates against private/accounts.json using memberId + fullName + password.
  // Issues a signed JWT stored in the HttpOnly 'academy_session' cookie (8 h, no server-side session).
  // Schoolmaster admin login continues to use req.session via the existing /auth/login route.
  app.post('/api/auth/login', async (req, res) => {
    const { fullName, memberId, password } = req.body || {};

    if (!fullName || !password) {
      return res.status(400).json({ error: 'Full name and password are required.' });
    }

    // ── Schoolmaster fast-path ──
    // memberId KTKC-0000 (or no memberId supplied) + name matches SM → use userStore.
    const normalizedId   = String(memberId || '').trim().toUpperCase();
    const normalizedName = String(fullName).trim().toUpperCase();
    const { findByUsername, findById } = require('./src/auth/userStore');
    const smCandidate = (normalizedId === 'KTKC-0000' || !normalizedId)
      ? findByUsername(fullName.trim())
      : null;

    if (smCandidate && smCandidate.role === 'admin') {
      const match = await bcrypt.compare(password, smCandidate.password);
      if (!match) {
        return res.status(401).json({ error: 'Incorrect password.' });
      }
      // Set express-session
      req.session.userId   = smCandidate.id;
      req.session.role     = smCandidate.role;
      req.session.username = smCandidate.username;
      // Also issue JWT cookie so JWT-gated routes work
      const jwt = require('jsonwebtoken');
      const token = jwt.sign(
        { memberId: smCandidate.memberId || 'KTKC-0000', fullName: smCandidate.username, role: 'schoolmaster' },
        process.env.JWT_SECRET || 'templar-jwt-secret-2026',
        { expiresIn: '8h' }
      );
      res.setHeader('Set-Cookie', SESSION_COOKIE(token));
      return res.json({ ok: true, redirect: '/schoolmaster' });
    }

    // ── userStore member path ──
    // Existing members registered through the original system live in data/users.json.
    // Two sub-cases:
    //   A) SM has assigned a memberId — match on memberId + name + password.
    //   B) SM has NOT yet assigned a memberId (null) — match on name + password only,
    //      allowing the member to enter any memberId (or none) to sign in.
    //      Once the SM assigns an ID, case A takes over automatically.
    const { findById: _findById, getAllUsers, findByUsername: _findByUsername } = require('./src/auth/userStore');
    const allUsers = getAllUsers ? getAllUsers() : [];

    // Case A: memberId provided and matches a stored member record
    const existingMember = normalizedId
      ? allUsers.find(u =>
          u.role === 'member' &&
          u.memberId &&
          u.memberId.trim().toUpperCase() === normalizedId
        )
      : null;

    if (existingMember) {
      const rawMember = _findById(existingMember.id);
      if (!rawMember) return res.status(403).json({ error: 'Member account not found.' });
      if (rawMember.username.trim().toUpperCase() !== normalizedName) {
        return res.status(401).json({ error: 'Full name does not match this Member ID.' });
      }
      const match = await bcrypt.compare(password, rawMember.password);
      if (!match) return res.status(401).json({ error: 'Incorrect password.' });
      req.session.userId   = rawMember.id;
      req.session.role     = rawMember.role;
      req.session.username = rawMember.username;
      const jwt = require('jsonwebtoken');
      const token = jwt.sign(
        { memberId: rawMember.memberId, fullName: rawMember.username, role: 'member' },
        process.env.JWT_SECRET || 'templar-jwt-secret-2026',
        { expiresIn: '8h' }
      );
      res.setHeader('Set-Cookie', SESSION_COOKIE(token));
      return res.json({ ok: true, redirect: '/member' });
    }

    // Case B: name-based lookup — member exists in userStore but has no memberId yet
    // (SM hasn't assigned one, or member is signing in before ID assignment).
    // Also catches the case where SM assigned an ID but member entered a wrong/different one.
    const nameMatchMember = allUsers.find(u =>
      u.role === 'member' &&
      u.username.trim().toUpperCase() === normalizedName
    );
    if (nameMatchMember) {
      // If this member already has an ID assigned and it doesn't match what was entered → reject
      if (nameMatchMember.memberId &&
          nameMatchMember.memberId.trim().toUpperCase() !== normalizedId) {
        return res.status(401).json({ error: 'Member ID does not match your account.' });
      }
      const rawMember = _findById(nameMatchMember.id);
      if (!rawMember) return res.status(403).json({ error: 'Member account not found.' });
      const match = await bcrypt.compare(password, rawMember.password);
      if (!match) return res.status(401).json({ error: 'Incorrect password.' });
      // If a memberId was provided but none was stored, save it now
      if (normalizedId && !rawMember.memberId) {
        const { updateUser: _updateUser } = require('./src/auth/userStore');
        _updateUser(rawMember.id, { memberId: normalizedId });
        rawMember.memberId = normalizedId;
      }
      req.session.userId   = rawMember.id;
      req.session.role     = rawMember.role;
      req.session.username = rawMember.username;
      const jwt = require('jsonwebtoken');
      const token = jwt.sign(
        { memberId: rawMember.memberId || normalizedId || null, fullName: rawMember.username, role: 'member' },
        process.env.JWT_SECRET || 'templar-jwt-secret-2026',
        { expiresIn: '8h' }
      );
      res.setHeader('Set-Cookie', SESSION_COOKIE(token));
      return res.json({ ok: true, redirect: '/member' });
    }

    // ── No memberId and no name match in userStore — fall through to registry ──
    if (!normalizedId) {
      return res.status(400).json({ error: 'Member ID is required.' });
    }

    const registry = readRegistry();
    const accounts = readAccounts();

    const member = registry.find(m => m.memberId === normalizedId);
    if (!member || !member.portalEligible) {
      return res.status(403).json({ error: 'This Member ID does not have academy access.' });
    }

    const account = accounts.find(a => a.memberId === normalizedId);
    if (!account) {
      return res.status(403).json({ error: 'No account exists for this Member ID. Create one first.' });
    }

    if (account.approvalStatus !== 'approved') {
      return res.status(403).json({ error: 'Your account is still pending Schoolmaster approval.' });
    }

    if (String(account.fullName).trim().toUpperCase() !== normalizedName) {
      return res.status(403).json({ error: 'Full name does not match the approved account.' });
    }

    const valid = await bcrypt.compare(password, account.passwordHash);
    if (!valid) {
      return res.status(401).json({ error: 'Invalid password.' });
    }

    const jwt = require('jsonwebtoken');
    const token = jwt.sign(
      { memberId: account.memberId, fullName: account.fullName, role: account.role || 'member' },
      process.env.JWT_SECRET || 'templar-jwt-secret-2026',
      { expiresIn: '8h' }
    );

    // Hydrate Express session for this registry member so session-gated routes
    // (doc-render, programs/lessons, etc.) work immediately without a page reload.
    // The JWT cookie is also set for client-side guard scripts.
    req.session.userId   = account.memberId;
    req.session.role     = account.role || 'member';
    req.session.username = account.fullName;

    res.setHeader('Set-Cookie', SESSION_COOKIE(token));

    return res.json({ ok: true, redirect: '/member' });
  });

  // ── POST /api/auth/register  { fullName, memberId, email, password } ──
  // Registry-validated registration. Member ID must exist in
  // private/member-registry.json and be marked portalEligible.
  // Full name must match the registry record (case-insensitive).
  // Account is stored in private/accounts.json with approvalStatus: "pending".
  // No session is created — Schoolmaster must approve first.
  app.post('/api/auth/register', async (req, res) => {
    const { fullName, memberId, email, password } = req.body || {};

    if (!fullName || !memberId || !email || !password) {
      return res.status(400).json({ error: 'Full name, Member ID, email, and password are required.' });
    }

    const registry      = readRegistry();
    const accounts      = readAccounts();
    const normalizedId  = String(memberId).trim().toUpperCase();
    const normalizedName = String(fullName).trim().toUpperCase();

    const member = registry.find(m => m.memberId === normalizedId);
    if (!member) {
      return res.status(403).json({ error: 'Member ID not found. Contact the Schoolmaster.' });
    }

    if (!member.portalEligible) {
      return res.status(403).json({ error: 'This Member ID is not eligible for portal access.' });
    }

    if (member.fullName && member.fullName.trim().toUpperCase() !== normalizedName) {
      return res.status(403).json({ error: 'Full name does not match the member registry.' });
    }

    if (accounts.some(a => a.memberId === normalizedId)) {
      return res.status(409).json({ error: 'An account already exists for this Member ID.' });
    }

    const passwordHash = await bcrypt.hash(password, 12);
    accounts.push({
      memberId:       normalizedId,
      fullName:       fullName.trim(),
      email:          String(email).trim().toLowerCase(),
      passwordHash,
      role:           'member',
      approvalStatus: 'pending',
      createdAt:      new Date().toISOString()
    });

    writeAccounts(accounts);
    return res.json({ ok: true, message: 'Account request submitted.' });
  });

  // ── GET /api/auth/pending  — Schoolmaster only (JWT role: schoolmaster) ──
  // Returns all entries in private/accounts.json with approvalStatus === 'pending'.
  // Auth: academy_session JWT cookie, role must be 'schoolmaster'.
  app.get('/api/auth/pending', (req, res) => {
    const jwt = require('jsonwebtoken');
    try {
      const raw = (req.headers.cookie || '').split(';')
        .map(c => c.trim()).find(c => c.startsWith('academy_session='));
      if (!raw) return res.status(401).json({ error: 'Unauthorized.' });
      const token = raw.slice('academy_session='.length);
      const session = jwt.verify(token, process.env.JWT_SECRET || 'templar-jwt-secret-2026');
      if (session.role !== 'schoolmaster') {
        return res.status(403).json({ error: 'Forbidden.' });
      }
    } catch {
      return res.status(401).json({ error: 'Unauthorized.' });
    }
    const items = readAccounts().filter(a => a.approvalStatus === 'pending');
    return res.json({ items });
  });

  // ── POST /api/auth/approve  { memberId, action: "approve" | "reject" }  — Schoolmaster only ──
  // Auth: academy_session JWT cookie, role must be 'schoolmaster'.
  // Sets approvalStatus, approvedAt, and approvedBy (SM's memberId from JWT payload).
  app.post('/api/auth/approve', (req, res) => {
    const jwt = require('jsonwebtoken');
    let smMemberId = null;
    try {
      const raw = (req.headers.cookie || '').split(';')
        .map(c => c.trim()).find(c => c.startsWith('academy_session='));
      if (!raw) return res.status(401).json({ error: 'Unauthorized.' });
      const token = raw.slice('academy_session='.length);
      const session = jwt.verify(token, process.env.JWT_SECRET || 'templar-jwt-secret-2026');
      if (session.role !== 'schoolmaster') {
        return res.status(403).json({ error: 'Forbidden.' });
      }
      smMemberId = session.memberId || null;
    } catch {
      return res.status(401).json({ error: 'Unauthorized.' });
    }

    const { memberId, action } = req.body || {};
    if (!memberId || !action) {
      return res.status(400).json({ error: 'memberId and action are required.' });
    }

    const accounts  = readAccounts();
    const normalizedId = String(memberId).trim().toUpperCase();
    const idx = accounts.findIndex(a => a.memberId === normalizedId);
    if (idx === -1) {
      return res.status(404).json({ error: 'Account not found.' });
    }

    accounts[idx].approvalStatus = action === 'approve' ? 'approved' : 'rejected';
    accounts[idx].approvedAt     = new Date().toISOString();
    accounts[idx].approvedBy     = smMemberId;
    writeAccounts(accounts);

    return res.json({ ok: true });
  });

  // ── helpers shared by registry routes below ──
  function writeRegistry(registry) {
    fsSync.mkdirSync(path.dirname(REGISTRY_PATH), { recursive: true });
    fsSync.writeFileSync(REGISTRY_PATH, JSON.stringify(registry, null, 2), 'utf8');
  }

  function smJwtCheck(req, res) {
    const jwt = require('jsonwebtoken');
    try {
      const raw = (req.headers.cookie || '').split(';')
        .map(c => c.trim()).find(c => c.startsWith('academy_session='));
      if (!raw) { res.status(401).json({ error: 'Unauthorized.' }); return null; }
      const token = raw.slice('academy_session='.length);
      const session = jwt.verify(token, process.env.JWT_SECRET || 'templar-jwt-secret-2026');
      if (session.role !== 'schoolmaster') { res.status(403).json({ error: 'Forbidden.' }); return null; }
      return session;
    } catch { res.status(401).json({ error: 'Unauthorized.' }); return null; }
  }

  // ── GET /api/registry  — list all registry + accounts (SM only) ──
  app.get('/api/registry', (req, res) => {
    if (!smJwtCheck(req, res)) return;
    const registry = readRegistry();
    const accounts = readAccounts();
    const merged = registry.map(r => {
      const acct = accounts.find(a => a.memberId === r.memberId) || null;
      return {
        memberId:       r.memberId,
        fullName:       r.fullName || '',
        portalEligible: r.portalEligible !== false,
        addedAt:        r.addedAt || null,
        account:        acct ? {
          approvalStatus: acct.approvalStatus,
          email:          acct.email || '',
          createdAt:      acct.createdAt || null,
          approvedAt:     acct.approvedAt || null
        } : null
      };
    });
    return res.json({ items: merged });
  });

  // ── POST /api/registry/add  { memberId, fullName, portalEligible? }  — SM only ──
  app.post('/api/registry/add', (req, res) => {
    if (!smJwtCheck(req, res)) return;
    const { memberId, fullName, portalEligible = true } = req.body || {};
    if (!memberId) return res.status(400).json({ error: 'memberId is required.' });
    const normalizedId = String(memberId).trim().toUpperCase();
    const registry = readRegistry();
    if (registry.find(r => r.memberId === normalizedId)) {
      return res.status(409).json({ error: 'Member ID already exists in registry.' });
    }
    registry.push({
      memberId:       normalizedId,
      fullName:       String(fullName || '').trim(),
      portalEligible: portalEligible !== false,
      addedAt:        new Date().toISOString()
    });
    writeRegistry(registry);
    return res.json({ ok: true });
  });

  // ── POST /api/registry/update  { memberId, fullName?, portalEligible? }  — SM only ──
  app.post('/api/registry/update', (req, res) => {
    if (!smJwtCheck(req, res)) return;
    const { memberId, fullName, portalEligible } = req.body || {};
    if (!memberId) return res.status(400).json({ error: 'memberId is required.' });
    const normalizedId = String(memberId).trim().toUpperCase();
    const registry = readRegistry();
    const idx = registry.findIndex(r => r.memberId === normalizedId);
    if (idx === -1) return res.status(404).json({ error: 'Member ID not found in registry.' });
    if (fullName !== undefined) registry[idx].fullName = String(fullName).trim();
    if (portalEligible !== undefined) registry[idx].portalEligible = portalEligible !== false;
    writeRegistry(registry);
    return res.json({ ok: true });
  });

  // ── DELETE /api/registry/:memberId  — SM only ──
  app.delete('/api/registry/:memberId', (req, res) => {
    if (!smJwtCheck(req, res)) return;
    const normalizedId = String(req.params.memberId || '').trim().toUpperCase();
    const registry = readRegistry();
    const next = registry.filter(r => r.memberId !== normalizedId);
    if (next.length === registry.length) return res.status(404).json({ error: 'Not found.' });
    writeRegistry(next);
    return res.json({ ok: true });
  });

})();

// ── GET /api/auth/session ──
// Used by academy-guard.js on every protected page.
// Verifies the 'academy_session' JWT cookie using parseCookie (matches session.mjs exactly).
// Falls back to express-session for the Schoolmaster admin (/auth/login path).
app.get('/api/auth/session', (req, res) => {
  const jwt = require('jsonwebtoken');

  function parseCookie(header) {
    return Object.fromEntries(
      (header || '').split(';').map(v => v.trim()).filter(Boolean).map(v => {
        const i = v.indexOf('=');
        return [v.slice(0, i), decodeURIComponent(v.slice(i + 1))];
      })
    );
  }

  // ── 1. JWT cookie (members + schoolmaster JWT) ──
  const cookies = parseCookie(req.headers.cookie || '');
  const token   = cookies.academy_session;
  if (token) {
    try {
      const payload = jwt.verify(token, process.env.JWT_SECRET || 'templar-jwt-secret-2026');
      return res.json({ authenticated: true, user: payload });
    } catch {
      // Invalid / expired — clear cookie, fall through
      res.setHeader('Set-Cookie',
        CLEAR_COOKIE);
    }
  }

  // ── 2. express-session fallback (Schoolmaster admin via /auth/login) ──
  if (!req.session.userId) {
    return res.status(401).json({ authenticated: false });
  }
  const { findById, safeUser } = require('./src/auth/userStore');
  const raw = findById(req.session.userId);
  if (!raw) {
    req.session.destroy(() => {});
    return res.status(401).json({ authenticated: false });
  }
  const user = { ...safeUser(raw) };
  if (user.role === 'admin') user.role = 'schoolmaster';
  return res.json({ authenticated: true, user });
});

// ── POST /api/auth/logout ──
// Clears the academy_session JWT cookie (member accounts).
// For the SM admin, /auth/logout (express-session destroy) remains available.
app.post('/api/auth/logout', (_req, res) => {
  res.setHeader('Set-Cookie',
    CLEAR_COOKIE);
  res.json({ ok: true });
});

// ── DOCUMENT RENDER ENDPOINT ──
// GET /api/doc-render?path=/documents/squire/squire-reading-stack-2-historical-timeline.docx
// Serves any file from the public/documents or public/library tree with the correct
// Content-Type so browsers render it natively (HTML → text/html, PDF → application/pdf,
// real .docx Word binary → converted to HTML via mammoth).
// Requires an active session so members-only documents aren't publicly accessible.
(function registerDocRender () {
  const fs      = require('fs');
  const mammoth = require('mammoth');

  // Allowed root directories (relative to __dirname)
  const ALLOWED_ROOTS = [
    path.join(__dirname, 'public', 'documents'),
    path.join(__dirname, 'public', 'library'),
    path.join(__dirname, 'public', 'handouts'),
  ];

  function isAllowed(absPath) {
    return ALLOWED_ROOTS.some(root => absPath.startsWith(root + path.sep) || absPath === root);
  }

  app.get('/api/doc-render', requireMember, async (req, res) => {
    const docPath = req.query.path;
    if (!docPath) return res.status(400).send('Missing ?path=');

    // Normalise to an absolute path inside public/
    const abs = path.normalize(path.join(__dirname, 'public', docPath));
    if (!isAllowed(abs)) return res.status(403).send('Access denied');

    if (!fs.existsSync(abs)) return res.status(404).send('Document not found');

    const raw = fs.readFileSync(abs);

    // --- Sniff real format from magic bytes / content ---
    const isPDF  = raw[0] === 0x25 && raw[1] === 0x50 && raw[2] === 0x44 && raw[3] === 0x46; // %PDF
    const isZip  = raw[0] === 0x50 && raw[1] === 0x4B; // PK — real .docx/.xlsx ZIP
    const isHTML = raw.toString('utf8', 0, 100).trimStart().toLowerCase().startsWith('<!doctype html') ||
                   raw.toString('utf8', 0, 100).trimStart().toLowerCase().startsWith('<html');

    if (isPDF) {
      res.setHeader('Content-Type', 'application/pdf');
      return res.send(raw);
    }

    if (isHTML) {
      res.setHeader('Content-Type', 'text/html; charset=utf-8');
      return res.send(raw);
    }

    if (isZip) {
      // Real Office Open XML — convert via mammoth
      try {
        const result = await mammoth.convertToHtml({ buffer: raw });
        const title  = path.basename(abs, path.extname(abs)).replace(/[-_]/g, ' ');
        const html = `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width,initial-scale=1">
  <title>${title}</title>
  <style>
    body { max-width:820px; margin:0 auto; padding:40px 32px; font-family:'Times New Roman',Times,serif;
           font-size:12pt; color:#111; background:#fff; line-height:1.7; }
    h1,h2,h3,h4 { font-family:Arial,Helvetica,sans-serif; margin:1.4em 0 .5em; }
    h1 { font-size:1.6rem; border-bottom:2px solid #333; padding-bottom:.3em; }
    h2 { font-size:1.25rem; } h3 { font-size:1.05rem; }
    p  { margin:.6em 0; }
    table { border-collapse:collapse; width:100%; margin:1em 0; }
    th,td { border:1px solid #999; padding:6px 10px; vertical-align:top; }
    th { background:#eee; font-family:Arial,sans-serif; font-size:.9rem; }
    ul,ol { padding-left:1.6em; margin:.5em 0; }
    li { margin:.25em 0; }
    strong,b { font-weight:700; }
  </style>
</head>
<body>
${result.value}
</body>
</html>`;
        res.setHeader('Content-Type', 'text/html; charset=utf-8');
        return res.send(html);
      } catch (err) {
        return res.status(500).send('Could not convert document: ' + err.message);
      }
    }

    // Unknown format — serve as plain download fallback
    res.setHeader('Content-Type', 'application/octet-stream');
    res.setHeader('Content-Disposition', `attachment; filename="${path.basename(abs)}"`);
    return res.send(raw);
  });
})();

// ── ADMIN API ──
app.get('/admin/members', requireAdmin, (_req, res) => {
  res.json({ members: getAllUsers() });
});

// ── PAGE ROUTES ──
app.get('/', (_req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'index.html'));
});

// /viewer  → in-browser document viewer (no auth guard — viewer only wraps external URLs
//            in an iframe; no private server data is exposed by this page itself)
app.get('/viewer', (_req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'viewer', 'index.html'));
});
// /viewer/index.html  → same, for direct HTML path references
app.get('/viewer/index.html', (_req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'viewer', 'index.html'));
});
app.get('/login', (_req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'login-portal.html'));
});
app.get('/register', (_req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'register.html'));
});
app.get('/member', requireMember, (req, res) => {
  if (req.session.role === 'admin') return res.redirect('/schoolmaster');
  res.sendFile(path.join(__dirname, 'public', 'member-dashboard.html'));
});
app.get('/profile', requireMember, (req, res) => {
  if (req.session.role === 'admin') return res.redirect('/schoolmaster');
  res.sendFile(path.join(__dirname, 'public', 'member-profile.html'));
});
app.get('/schoolmaster', requireAdmin, (_req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'schoolmaster-dashboard.html'));
});
app.get('/lesson', requireMember, (req, res) => {
  if (req.session.role === 'admin') return res.redirect('/schoolmaster');
  res.sendFile(path.join(__dirname, 'public', 'lesson.html'));
});
// ── READING LOG PAGES ──
app.get('/reading-log', requireMember, (_req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'reading-log', 'index.html'));
});
app.get('/schoolmaster/reading-log', requireAdmin, (_req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'schoolmaster', 'reading-log', 'index.html'));
});

// ── PROGRAM PAGES (universal reading guide + test pages) ──
const VALID_SLUGS = ['levie','squire','corporal','sergeant','sfc','knight-aspirant',
                     'knight','lieutenant','captain','major','commander','chaplain'];


// /programs/{slug}/test  → test hub (dynamic, week selector)
app.get('/programs/:slug/test', requireMember, (req, res) => {
  if (!VALID_SLUGS.includes(req.params.slug)) return res.redirect('/member');
  if (req.session.role === 'admin') return res.redirect('/schoolmaster');
  res.sendFile(path.join(__dirname, 'public', 'program-test.html'));
});

// /programs/{slug}/test/week/{n}  → specific week test
app.get('/programs/:slug/test/week/:week', requireMember, (req, res) => {
  if (!VALID_SLUGS.includes(req.params.slug)) return res.redirect('/member');
  if (req.session.role === 'admin') return res.redirect('/schoolmaster');
  res.sendFile(path.join(__dirname, 'public', 'program-test.html'));
});

// /programs/{slug}/hub  → full program hub (universal for all 11 programs)
// Admins can view the hub (e.g. from SM page "Member Hub" link) — no bounce
app.get('/programs/:slug/hub', requireMember, (req, res) => {
  if (!VALID_SLUGS.includes(req.params.slug)) return res.redirect('/member');
  res.sendFile(path.join(__dirname, 'public', 'program-hub.html'));
});

// /programs/{slug}/schoolmaster  → SM resource page (admin only)
app.get('/programs/:slug/schoolmaster', requireAdmin, (req, res) => {
  if (!VALID_SLUGS.includes(req.params.slug)) return res.redirect('/schoolmaster');
  res.sendFile(path.join(__dirname, 'public', 'program-schoolmaster.html'));
});


// ── FULL CURRICULUM COURSE API (patch bundle — 10-question quizzes, progression gating) ──
// /api/course/library                         — shared library index
// /api/course/:slug/course                    — full program with weeks + quiz questions
// /api/course/:slug/progress                  — student progress (query: studentName, studentEmail)
// /api/course/:slug/submit                    — POST quiz submission
// /api/course/schoolmaster/:slug/records      — all submissions (admin)
// /api/course/schoolmaster/:slug/retest       — POST retest approval (admin)
app.use('/api/course', assessmentController.router);

// ── ASSESSMENT API (existing per-week JSON files) ──

// POST /api/assessment/:slug/submit — called by program-hub.html when a member
// submits a week exam.  Delegates to the same submitWeekWork service used by
// /api/course/:slug/submit so scoring, progression gating, and the submission
// log all work identically.
app.post('/api/assessment/:slug/submit', requireMember, async (req, res) => {
  const { submitWeekWork } = require('./src/services/submissionStoreService');
  try {
    const result = submitWeekWork(req.params.slug, req.body || {});
    return res.status(201).json(result);
  } catch (err) {
    return res.status(400).json({ error: err.message });
  }
});

// GET /api/assessment/:slug/progress — returns the current student's submission
// history for the given program, keyed by their session profile (email from
// localStorage is not available server-side, so we use the session user's email).
// program-hub.html calls this on load to restore exam result banners for weeks
// the member has already submitted.
app.get('/api/assessment/:slug/progress', requireMember, (req, res) => {
  const { getStudentProgress } = require('./src/services/submissionStoreService');
  const { findById } = require('./src/auth/userStore');
  try {
    const user = findById(req.session.userId);
    if (!user) return res.status(401).json({ error: 'Session expired' });
    const progress = getStudentProgress(req.params.slug, user.username, user.email);
    return res.json(progress);
  } catch (err) {
    return res.status(400).json({ error: err.message });
  }
});

// GET /api/assessment/:slug/test/:week
app.get('/api/assessment/:slug/test/:week', requireMember, (req, res) => {
  const data = assessmentService.getWeekTest(req.params.slug, parseInt(req.params.week, 10));
  if (!data) return res.status(404).json({ error: 'Not found' });
  res.json(data);
});

// GET /api/assessment/:slug/answer-key/:week  (admin only)
app.get('/api/assessment/:slug/answer-key/:week', requireAdmin, (req, res) => {
  const data = assessmentService.getWeekAnswerKey(req.params.slug, parseInt(req.params.week, 10));
  if (!data) return res.status(404).json({ error: 'Not found' });
  res.json(data);
});

// GET /api/assessment/:slug/discussion/:week
app.get('/api/assessment/:slug/discussion/:week', requireMember, (req, res) => {
  const data = assessmentService.getWeekDiscussion(req.params.slug, parseInt(req.params.week, 10));
  if (!data) return res.status(404).json({ error: 'Not found' });
  res.json(data);
});

// GET /api/assessment/:slug/combined  (admin only)
app.get('/api/assessment/:slug/combined', requireAdmin, (req, res) => {
  const data = assessmentService.getCombinedAssessment(req.params.slug);
  if (!data) return res.status(404).json({ error: 'Not found' });
  res.json(data);
});

// ── PAPER SUBMISSIONS API ──
const paperUpload        = require('./api/papers/upload');
const paperMySubmissions = require('./api/papers/my-submissions');
const paperList          = require('./api/papers/list');
const paperGrade         = require('./api/papers/grade');
const paperDownload      = require('./api/papers/download');

// Members: upload a paper
app.post('/api/papers/upload', (req, res) => paperUpload.handler(req, res));
// Members: view own submissions
app.get('/api/papers/my-submissions', (req, res) => paperMySubmissions.handler(req, res));
// Schoolmaster: list all submissions (with optional filters)
app.get('/api/papers/list', (req, res) => paperList.handler(req, res));
// Schoolmaster: grade a submission
app.post('/api/papers/grade', (req, res) => paperGrade.handler(req, res));
// Members + schoolmaster: download a stored paper file
// Supports both /api/papers/download/:submissionId (path param) and
//              /api/papers/download?submissionId=  (query param, used by hub JS)
app.get('/api/papers/download',              (req, res) => paperDownload.handler(req, res));
app.get('/api/papers/download/:submissionId', (req, res) => paperDownload.handler(req, res));

// ── PAPER SUBMISSION PAGES ──
// Member submission hub — requires valid member session
app.get('/member/questionnaire-hub', requireMember, (_req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'member', 'questionnaire-hub', 'index.html'));
});
// Schoolmaster grading page — schoolmaster session checked by the API; serve the page to any logged-in user
app.get('/schoolmaster/paper-grading', requireMember, (_req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'schoolmaster', 'paper-grading', 'index.html'));
});

// ── READING LOG API ──
const readingLogMine   = require('./api/reading-log/mine');
const readingLogSave   = require('./api/reading-log/save');
const readingLogSubmit = require('./api/reading-log/submit');
const readingLogList   = require('./api/reading-log/list');

app.get('/api/reading-log/mine',   (req, res) => readingLogMine.handler(req, res));
app.post('/api/reading-log/save',  (req, res) => readingLogSave.handler(req, res));
app.post('/api/reading-log/submit',(req, res) => readingLogSubmit.handler(req, res));
app.get('/api/reading-log/list',   (req, res) => readingLogList.handler(req, res));

// ── LIBRARY PAGE ──
app.get('/library', requireMember, (_req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'library', 'index.html'));
});

// Legacy
app.get('/dashboard', (_req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'dashboard.html'));
});

// ── STATIC FILES ──
app.use('/uploads', express.static(path.join(__dirname, 'data', 'uploads')));
// All files under /programs/ (reading.html, site/*, resources/*) require a valid session.
// This one middleware line replaces the need to add auth checks to every static HTML file.
app.use('/programs', requireMember, express.static(path.join(__dirname, 'public', 'programs')));

// ── SMART /documents/ SERVE ──
// Intercepts all /documents/* requests BEFORE the catch-all express.static so that
// files with misleading extensions (e.g. .docx files that actually contain HTML) are
// served with the correct Content-Type determined by content sniffing rather than
// by the file extension.  This prevents browsers from showing raw HTML source when
// clicking a link to a .docx file that is really an HTML document.
(function registerDocumentsSmartServe () {
  const fs = require('fs');

  app.use('/documents', function smartDocumentsServe (req, res, next) {
    // Only handle GET/HEAD requests for actual files (no query strings needed)
    if (req.method !== 'GET' && req.method !== 'HEAD') return next();

    const docsRoot = path.join(__dirname, 'public', 'documents');
    const rel      = req.path; // e.g. /squire/squire-required-reading-list.docx
    const abs      = path.normalize(path.join(docsRoot, rel));

    // Security: ensure the resolved path stays inside public/documents
    if (!abs.startsWith(docsRoot + path.sep) && abs !== docsRoot) return next();

    if (!fs.existsSync(abs) || fs.statSync(abs).isDirectory()) return next();

    const raw = fs.readFileSync(abs);

    // Content sniff (same logic as /api/doc-render)
    const isPDF  = raw[0] === 0x25 && raw[1] === 0x50 && raw[2] === 0x44 && raw[3] === 0x46; // %PDF
    const isZip  = raw[0] === 0x50 && raw[1] === 0x4B; // PK — real OOXML binary
    const head   = raw.toString('utf8', 0, 200).trimStart().toLowerCase();
    const isHTML = head.startsWith('<!doctype html') || head.startsWith('<html');

    if (isPDF) {
      res.setHeader('Content-Type', 'application/pdf');
      return res.send(raw);
    }

    if (isHTML) {
      res.setHeader('Content-Type', 'text/html; charset=utf-8');
      return res.send(raw);
    }

    if (isZip) {
      // Real binary OOXML — let the browser download it (correct docx MIME type)
      res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.wordprocessingml.document');
      res.setHeader('Content-Disposition', 'attachment; filename="' + path.basename(abs) + '"');
      return res.send(raw);
    }

    // Fallback: let express.static handle anything else (images, css, etc.)
    next();
  });
})();

app.use(express.static(path.join(__dirname, 'public')));

// ── GLOBAL ERROR HANDLER ──
// Catches any unhandled synchronous or async errors thrown in route handlers.
// Without this, Express sends its default HTML error page (which causes
// "Unexpected token '<'" when API callers try to JSON-parse the response).
// eslint-disable-next-line no-unused-vars
app.use((err, req, res, next) => {
  console.error('Unhandled server error:', err);
  const status = err.status || err.statusCode || 500;
  if (req.path.startsWith('/api/') || req.path.startsWith('/auth/') ||
      (req.headers['accept'] && req.headers['accept'].includes('application/json')) ||
      req.xhr) {
    return res.status(status).json({ error: err.message || 'Internal server error' });
  }
  res.status(status).sendFile(path.join(__dirname, 'public', '404.html'));
});

// ── GLOBAL ERROR HANDLER ──
// Must be declared with 4 parameters so Express treats it as an error-handling middleware.
// Catches errors thrown by any middleware (e.g. express.json() body-parser SyntaxError when
// the client sends malformed JSON) and returns a clean JSON response instead of the default
// Express HTML error page.  Without this, `res.json()` in the frontend would receive
// '<!DOCTYPE html>...' and throw "Unexpected token '<'" in the catch block.
// eslint-disable-next-line no-unused-vars
app.use((err, req, res, next) => {
  // Body-parser sends a SyntaxError with status 400 for malformed JSON payloads
  if (err instanceof SyntaxError && err.status === 400 && 'body' in err) {
    return res.status(400).json({ error: 'Invalid JSON in request body.' });
  }
  // Log unexpected server errors but don't leak stack traces to the client
  console.error('Unhandled server error:', err.message || err);
  const status = err.status || err.statusCode || 500;
  if (req.path.startsWith('/api/') || req.path.startsWith('/auth/')) {
    return res.status(status).json({ error: err.message || 'Internal server error.' });
  }
  res.status(status).sendFile(path.join(__dirname, 'public', '404.html'));
});

// ── 404 HANDLER ──
// Must be after all routes and static middleware.
// API paths get a JSON 404; page paths get the 404.html page.
app.use((req, res) => {
  if (req.path.startsWith('/api/') || req.path.startsWith('/auth/')) {
    return res.status(404).json({ error: 'Not found.', path: req.path });
  }
  res.status(404).sendFile(path.join(__dirname, 'public', '404.html'));
});

// ── BOOT ──
async function start() {
  // Seed / sync the one Schoolmaster account
  await seedSchoolmaster();
  console.log(`✠ Schoolmaster account ready: ${process.env.SM_USERNAME || 'Schoolmaster26'}`);

  if (require.main === module) {
    app.listen(PORT, () => {
      console.log(`KTKC Templar Forge Academy running on http://localhost:${PORT}`);
    });
  }
}

start().catch(err => {
  console.error('Startup error:', err);
  process.exit(1);
});

module.exports = app;
