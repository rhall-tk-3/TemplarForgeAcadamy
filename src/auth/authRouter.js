const express = require('express');
const bcrypt  = require('bcryptjs');
const {
  findByUsername,
  findById,
  createUser,
  RESERVED_NAMES
} = require('./userStore');

const router = express.Router();

// ── REGISTER (members only — schoolmaster account is seeded server-side) ──
router.post('/register', async (req, res) => {
  const { username, password, salutation } = req.body;

  if (!username || !password) {
    return res.status(400).json({ error: 'Name and passcode are required.' });
  }
  if (password.length < 4) {
    return res.status(400).json({ error: 'Passcode must be at least 4 characters.' });
  }

  try {
    const hashedPassword = await bcrypt.hash(password, 10);
    const user = createUser({ username, hashedPassword, salutation, role: 'member' });

    req.session.userId   = user.id;
    req.session.role     = user.role;
    req.session.username = user.username;

    return res.json({ ok: true, redirect: '/profile?new=1' });
  } catch (err) {
    if (err.message === 'RESERVED_NAME') {
      return res.status(409).json({ error: 'That name is reserved. Please choose another.' });
    }
    if (err.message === 'NAME_TAKEN') {
      return res.status(409).json({ error: 'That name is already taken. Choose another.' });
    }
    return res.status(500).json({ error: 'Could not create account. Try again.' });
  }
});

// ── LOGIN ──
// There is exactly ONE admin account (Schoolmaster26).
// Members simply use name + passcode.
// The "Schoolmaster" tab on the login page is hidden from the public UI —
// the schoolmaster logs in via the standard form; the server detects role automatically.
router.post('/login', async (req, res) => {
  const { username, password } = req.body;

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

  req.session.userId   = user.id;
  req.session.role     = user.role;
  req.session.username = user.username;

  const redirect = user.role === 'admin' ? '/schoolmaster' : '/member';
  return res.json({ ok: true, redirect });
});

// ── LOGOUT ──
router.get('/logout', (req, res) => {
  req.session.destroy(() => res.redirect('/login'));
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
