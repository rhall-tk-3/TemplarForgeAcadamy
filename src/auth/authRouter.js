const express  = require('express');
const bcrypt   = require('bcryptjs');
const { findByUsername, findById, createUser, getAllUsers } = require('./userStore');

const router = express.Router();

// ── Admin key (set via env or fallback for dev) ──
const ADMIN_KEY = process.env.ADMIN_KEY || 'forge-master-2026';

// ── REGISTER ──
router.post('/register', async (req, res) => {
  const { username, password, salutation } = req.body;

  if (!username || !password) {
    return res.status(400).json({ error: 'Name and passcode are required.' });
  }
  if (password.length < 4) {
    return res.status(400).json({ error: 'Passcode must be at least 4 characters.' });
  }
  if (findByUsername(username)) {
    return res.status(409).json({ error: 'That name is already taken. Choose another.' });
  }

  try {
    const hashedPassword = await bcrypt.hash(password, 10);
    const user = createUser({ username, hashedPassword, salutation, role: 'member' });

    // Auto-login after register
    req.session.userId   = user.id;
    req.session.role     = user.role;
    req.session.username = user.username;

    return res.json({ ok: true, redirect: '/member' });
  } catch (err) {
    return res.status(500).json({ error: 'Could not create account. Try again.' });
  }
});

// ── LOGIN ──
router.post('/login', async (req, res) => {
  const { username, password, adminKey, role } = req.body;

  if (!username || !password) {
    return res.status(400).json({ error: 'Name and passcode are required.' });
  }

  const user = findByUsername(username);
  if (!user) {
    return res.status(401).json({ error: 'Name not found. Check spelling or create an account.' });
  }

  const passwordMatch = await bcrypt.compare(password, user.password);
  if (!passwordMatch) {
    return res.status(401).json({ error: 'Incorrect passcode.' });
  }

  // Admin login requires matching admin key AND user must have admin role
  if (role === 'admin') {
    if (adminKey !== ADMIN_KEY) {
      return res.status(403).json({ error: 'Invalid Schoolmaster Key.' });
    }
    if (user.role !== 'admin') {
      return res.status(403).json({ error: 'This account does not have Schoolmaster access.' });
    }
  }

  req.session.userId   = user.id;
  req.session.role     = user.role;
  req.session.username = user.username;

  const redirect = user.role === 'admin' ? '/schoolmaster' : '/member';
  return res.json({ ok: true, redirect });
});

// ── LOGOUT ──
router.get('/logout', (req, res) => {
  req.session.destroy(() => {
    res.redirect('/login');
  });
});

// ── CURRENT USER ──
router.get('/me', (req, res) => {
  if (!req.session.userId) {
    return res.status(401).json({ error: 'Not signed in.' });
  }
  const user = findById(req.session.userId);
  if (!user) {
    return res.status(401).json({ error: 'Session expired.' });
  }
  const { password, ...safe } = user;
  return res.json(safe);
});

module.exports = router;
