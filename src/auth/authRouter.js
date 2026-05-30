const express    = require('express');
const bcrypt     = require('bcryptjs');
const nodemailer = require('nodemailer');
const fs         = require('fs');
const path       = require('path');
const {
  findByUsername,
  findById,
  createUser,
  updateUser,
  RESERVED_NAMES
} = require('./userStore');
const { RESET_LOG_FILE }          = require('../config/dataPaths');
const { hydrateSessionFromJwt }   = require('../config/jwtSession');

const router = express.Router();

// ── Reset-passcode mailer ──
// Uses SMTP_HOST / SMTP_PORT / SMTP_USER / SMTP_PASS env vars if set.
// Falls back to Ethereal (catches test mail) when env is absent so the
// password reset still works in dev/sandbox — SM is shown a preview URL.
async function buildTransporter() {
  if (process.env.SMTP_HOST) {
    return nodemailer.createTransport({
      host:   process.env.SMTP_HOST,
      port:   Number(process.env.SMTP_PORT) || 587,
      secure: Number(process.env.SMTP_PORT) === 465,
      auth: {
        user: process.env.SMTP_USER,
        pass: process.env.SMTP_PASS,
      },
    });
  }
  // No real SMTP configured — create a one-time Ethereal test account
  const testAccount = await nodemailer.createTestAccount();
  return nodemailer.createTransport({
    host:   'smtp.ethereal.email',
    port:   587,
    secure: false,
    auth: { user: testAccount.user, pass: testAccount.pass },
  });
}

// ── Reset-log (file in data/) ──
const RESET_LOG = RESET_LOG_FILE;
function appendResetLog(entry) {
  let log = [];
  try { log = JSON.parse(fs.readFileSync(RESET_LOG, 'utf8')); } catch (_) {}
  log.push(entry);
  fs.writeFileSync(RESET_LOG, JSON.stringify(log, null, 2));
}

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

  // For admin accounts, also issue an academy_session JWT cookie so that
  // JWT-gated API routes (/api/auth/pending, /api/auth/approve, etc.) work
  // without a separate login flow.
  if (user.role === 'admin') {
    try {
      const jwt = require('jsonwebtoken');
      const token = jwt.sign(
        {
          memberId: user.memberId || 'KTKC-0000',
          fullName: user.username,
          role:     'schoolmaster'
        },
        process.env.JWT_SECRET || 'templar-jwt-secret-2026',
        { expiresIn: '8h' }
      );
      res.setHeader('Set-Cookie',
        `academy_session=${token}; HttpOnly; Path=/; SameSite=Lax; Max-Age=28800`);
    } catch (_) { /* jwt not available — session-only fallback still works */ }
  }

  const redirect = user.role === 'admin' ? '/schoolmaster' : '/member';
  return res.json({ ok: true, redirect });
});

// ── LOGOUT ──
router.get('/logout', (req, res) => {
  req.session.destroy(() => res.redirect('/login'));
});

// ── CURRENT USER ──
// Used by member-dashboard.html on every load to fetch the session user.
// Must hydrate from JWT first — Railway restarts wipe the express-session store,
// so req.session may be empty even though the JWT cookie is still valid.
router.get('/me', (req, res) => {
  // Hydrate from JWT if express-session is cold (e.g. after Railway restart).
  // hydrateSessionFromJwt returns false when the JWT owner is not in userStore
  // (i.e. member not yet approved) — session will remain empty in that case.
  hydrateSessionFromJwt(req);

  if (!req.session.userId) {
    return res.status(401).json({ error: 'Not signed in.' });
  }

  // Look up the full userStore record — this is the single source of truth.
  // A valid JWT for a non-approved member will not have a userStore entry,
  // so findById returns null and we fall through to 401.
  const user = findById(req.session.userId);
  if (user) {
    const { password, ...safe } = user;
    return res.json(safe);
  }

  // No userStore entry — session is stale or member was removed/not yet approved.
  return res.status(401).json({ error: 'Session expired.' });
});

// ── RESET PASSCODE  (admin only) ──
// POST /auth/reset-password/:id
// Resets the member's password to the fixed passcode "ktkcuser",
// sends a notification email to the address on the member's profile,
// and logs the action to data/reset-log.json.
router.post('/reset-password/:id', async (req, res) => {
  // Guard: must be signed in as admin — hydrate JWT first
  hydrateSessionFromJwt(req);
  if (!req.session.userId || req.session.role !== 'admin') {
    return res.status(403).json({ error: 'Schoolmaster access required.' });
  }

  const target = findById(req.params.id);
  if (!target || target.role === 'admin') {
    return res.status(404).json({ error: 'Member not found.' });
  }

  const RESET_PASSCODE = 'ktkcuser';

  // 1. Hash and save the new password
  const hashed = await bcrypt.hash(RESET_PASSCODE, 12);
  updateUser(target.id, { password: hashed });

  // 2. Log the reset
  const logEntry = {
    memberId:   target.id,
    username:   target.username,
    resetAt:    new Date().toISOString(),
    resetBy:    req.session.username,
    emailSent:  false,
    emailAddr:  target.email || null,
    preview:    null,
  };

  // 3. Try to send email
  let emailResult = { sent: false, preview: null, error: null };
  if (target.email) {
    try {
      const transporter = await buildTransporter();
      const fromAddr = process.env.SMTP_FROM || process.env.SMTP_USER || 'noreply@templarforge.academy';
      const info = await transporter.sendMail({
        from:    `"Templar Forge Academy" <${fromAddr}>`,
        to:      target.email,
        subject: '✠ KTKC — Your Passcode Has Been Reset',
        text: [
          `Brother/Sister ${target.username},`,
          '',
          'Your Templar Forge Academy passcode has been reset by the Schoolmaster.',
          '',
          `  New passcode: ${RESET_PASSCODE}`,
          '',
          'Sign in at: https://templarforge.academy/login',
          '',
          'You may change your passcode from your member profile after signing in.',
          '',
          'Ad Maiorem Dei Gloriam,',
          'Templar Forge Academy',
        ].join('\n'),
        html: `
          <div style="font-family:Georgia,serif;max-width:520px;margin:0 auto;background:#0c0608;color:#d4c5a0;padding:32px;border:1px solid #2a1210;">
            <div style="font-family:'Cinzel',Georgia,serif;font-size:1.1rem;color:#e8c040;letter-spacing:.1em;margin-bottom:20px;">✠ TEMPLAR FORGE ACADEMY</div>
            <p>Brother/Sister <strong>${target.username}</strong>,</p>
            <p>Your passcode has been reset by the Schoolmaster.</p>
            <div style="margin:24px 0;padding:16px 24px;background:#18080a;border-left:3px solid #c0282a;">
              <span style="font-family:'Cinzel',Georgia,serif;font-size:.75rem;color:#8a7a58;letter-spacing:.12em;display:block;margin-bottom:6px;">NEW PASSCODE</span>
              <span style="font-size:1.4rem;font-weight:bold;color:#e8c040;letter-spacing:.12em;">${RESET_PASSCODE}</span>
            </div>
            <p><a href="https://templarforge.academy/login" style="color:#c0282a;">Sign in here</a> — you may update your passcode from your member profile at any time.</p>
            <p style="margin-top:28px;font-size:.85rem;color:#6a5a40;"><em>Ad Maiorem Dei Gloriam</em></p>
          </div>`,
      });
      const preview = nodemailer.getTestMessageUrl(info);
      emailResult = { sent: true, preview: preview || null, error: null };
    } catch (err) {
      emailResult = { sent: false, preview: null, error: err.message };
    }
  }

  // 4. Update and write log
  logEntry.emailSent = emailResult.sent;
  logEntry.preview   = emailResult.preview;
  appendResetLog(logEntry);

  return res.json({
    ok:       true,
    username: target.username,
    email:    target.email || null,
    sent:     emailResult.sent,
    preview:  emailResult.preview,   // Ethereal URL for dev/sandbox viewing
    noEmail:  !target.email,
    message:  target.email
      ? (emailResult.sent
          ? `Passcode reset and email sent to ${target.email}.`
          : `Passcode reset. Email delivery failed: ${emailResult.error}`)
      : `Passcode reset. No email on file — inform ${target.username} directly.`,
  });
});

module.exports = router;
