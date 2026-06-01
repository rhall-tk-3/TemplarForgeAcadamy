'use strict';

/**
 * mailerService.js — shared, Railway-hardened email transport  v3
 *
 * Priority order:
 *   1. RESEND_API_KEY  → Resend.com REST API over HTTPS 443 (never blocked by Railway)
 *   2. SMTP_HOST       → SMTP with:
 *                          - SMTP_PASS spaces stripped (App Passwords copy with spaces)
 *                          - Port 465 (SMTPS/SSL) tried first; auto-falls back to 587 (STARTTLS)
 *                          - requireTLS on 587, secure:true on 465, TLS options, explicit timeouts
 *                          - transporter.verify() before send for clean error messages
 *   3. Neither set     → Ethereal test-catch (dev only; preview URL in logs)
 *
 * ── Resend (REQUIRED on Railway — SMTP ports 465/587 are blocked by Railway) ──
 *   RESEND_API_KEY   re_xxxxxxxxxxxx          ← from resend.com dashboard
 *   RESEND_FROM      Templar Forge Academy <noreply@templarforge.academy>
 *
 * ── SMTP (local dev / non-Railway only — Railway blocks all outbound SMTP) ──
 *   SMTP_HOST   smtp.gmail.com
 *   SMTP_PORT   465
 *   SMTP_USER   rhall@tkkc.info
 *   SMTP_PASS   mhqe fyjq vqfq ahuk   ← spaces OK, stripped automatically
 *   SMTP_FROM   Templar Forge Academy <noreply@templarforge.academy>
 */

const nodemailer = require('nodemailer');
const https      = require('https');

// ─────────────────────────────────────────────────────────────────────────────
// 1. Resend REST transport
// ─────────────────────────────────────────────────────────────────────────────

function sendViaResend({ from, to, subject, text, html }) {
  return new Promise((resolve, reject) => {
    const apiKey   = process.env.RESEND_API_KEY;
    const fromAddr = from
      || process.env.RESEND_FROM
      || process.env.SMTP_FROM
      || 'Templar Forge Academy <noreply@templarforge.academy>';

    const body = JSON.stringify({ from: fromAddr, to: [to], subject, text, html });

    const req = https.request({
      hostname: 'api.resend.com',
      port:     443,
      path:     '/emails',
      method:   'POST',
      headers: {
        'Authorization':  `Bearer ${apiKey}`,
        'Content-Type':   'application/json',
        'Content-Length': Buffer.byteLength(body),
      },
    }, (res) => {
      let data = '';
      res.on('data', chunk => { data += chunk; });
      res.on('end', () => {
        try {
          const parsed = JSON.parse(data);
          if (res.statusCode >= 200 && res.statusCode < 300) {
            resolve({ messageId: parsed.id || 'resend-ok', preview: null });
          } else {
            reject(new Error(`Resend API ${res.statusCode}: ${parsed.message || parsed.name || data}`));
          }
        } catch (e) {
          reject(new Error(`Resend parse error: ${e.message} — raw: ${data.slice(0,200)}`));
        }
      });
    });

    req.on('error', e => reject(new Error(`Resend network error: ${e.message}`)));
    req.setTimeout(15000, () => { req.destroy(); reject(new Error('Resend request timed out after 15s')); });
    req.write(body);
    req.end();
  });
}

// ─────────────────────────────────────────────────────────────────────────────
// 2. Gmail/SMTP transport  (hardened for Railway)
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Gmail App Passwords are displayed with spaces every 4 chars (e.g. "mhqe fyjq vqfq ahuk").
 * Railway stores the value as-is. Stripping spaces gives the real 16-char password.
 */
function cleanPass(raw) {
  return String(raw || '').replace(/\s+/g, '');
}

function makeSmtpConfig(port) {
  const isSSL = port === 465;
  return {
    host:       process.env.SMTP_HOST,
    port,
    secure:     isSSL,
    requireTLS: !isSSL,          // force STARTTLS on 587; no plain-text fallback
    auth: {
      user: process.env.SMTP_USER,
      pass: cleanPass(process.env.SMTP_PASS),   // ← strip spaces from App Password
    },
    tls: {
      rejectUnauthorized: false, // tolerate Railway's egress TLS proxy
      minVersion: 'TLSv1.2',
    },
    connectionTimeout: 30000,    // 30 s TCP connect
    greetingTimeout:   20000,    // 20 s SMTP greeting
    socketTimeout:     60000,    // 60 s full transaction
    pool:              false,    // independent connection per send
    disableFileAccess: true,
  };
}

/**
 * Try a transporter config, verify the connection, send the mail.
 * Returns { messageId, preview: null } on success.
 * Throws descriptive Error on failure.
 */
async function trySend(config, mailOpts) {
  const t = nodemailer.createTransport(config);
  try {
    await t.verify();
  } catch (err) {
    t.close();
    throw err;
  }
  const info = await t.sendMail(mailOpts);
  t.close();
  return { messageId: info.messageId || 'smtp-ok', preview: null };
}

async function sendViaSmtp(mailOpts) {
  const configuredPort = Number(process.env.SMTP_PORT) || 465;  // default: 465 (SMTPS)

  // Try configured port first
  try {
    console.log(`✠ Mailer: SMTP attempt on port ${configuredPort}`);
    return await trySend(makeSmtpConfig(configuredPort), mailOpts);
  } catch (firstErr) {
    console.warn(`✠ Mailer: port ${configuredPort} failed — ${firstErr.message}`);
  }

  // Auto-fallback to the other port (465 → 587 or 587 → 465)
  const fallbackPort = configuredPort === 465 ? 587 : 465;
  try {
    console.log(`✠ Mailer: SMTP fallback attempt on port ${fallbackPort}`);
    return await trySend(makeSmtpConfig(fallbackPort), mailOpts);
  } catch (secondErr) {
    console.error(`✠ Mailer: port ${fallbackPort} also failed — ${secondErr.message}`);
    // Both ports failed — give SM a clear actionable error
    throw new Error(
      `SMTP failed on ports ${configuredPort} and ${fallbackPort}: ${secondErr.message}. ` +
      `Railway may be blocking outbound SMTP. ` +
      `To fix: add RESEND_API_KEY to Railway env vars (free at resend.com).`
    );
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// 3. Ethereal fallback  (dev / no credentials configured)
// ─────────────────────────────────────────────────────────────────────────────

async function sendViaEthereal(mailOpts) {
  const testAccount = await nodemailer.createTestAccount();
  const t = nodemailer.createTransport({
    host: 'smtp.ethereal.email', port: 587, secure: false,
    auth: { user: testAccount.user, pass: testAccount.pass },
    connectionTimeout: 20000, greetingTimeout: 15000, socketTimeout: 30000,
  });
  const info    = await t.sendMail(mailOpts);
  const preview = nodemailer.getTestMessageUrl(info) || null;
  t.close();
  console.log(`✠ Mailer: Ethereal preview → ${preview}`);
  return { messageId: info.messageId, preview };
}

// ─────────────────────────────────────────────────────────────────────────────
// Public API
// ─────────────────────────────────────────────────────────────────────────────

/**
 * sendMail({ from?, to, subject, text, html })
 * Returns { messageId, preview }
 * Throws on failure — caller wraps in try/catch and returns { sent:false, error }
 */
async function sendMail({ from, to, subject, text, html }) {
  const fromAddr = from
    || process.env.RESEND_FROM
    || process.env.SMTP_FROM
    || process.env.SMTP_USER
    || 'Templar Forge Academy <noreply@templarforge.academy>';

  const mailOpts = { from: fromAddr, to, subject, text, html };

  // ── Resend (preferred on Railway) ──
  if (process.env.RESEND_API_KEY) {
    console.log(`✠ Mailer: Resend → ${to}`);
    const r = await sendViaResend(mailOpts);
    console.log(`✠ Mailer: Resend OK (${r.messageId})`);
    return r;
  }

  // ── SMTP (with space-stripped password + port fallback) ──
  if (process.env.SMTP_HOST) {
    console.log(`✠ Mailer: SMTP → ${to} (user: ${process.env.SMTP_USER}, pass length: ${cleanPass(process.env.SMTP_PASS).length})`);
    const r = await sendViaSmtp(mailOpts);
    console.log(`✠ Mailer: SMTP OK (${r.messageId})`);
    return r;
  }

  // ── Ethereal dev fallback ──
  console.log(`✠ Mailer: no credentials — Ethereal dev catch → ${to}`);
  return sendViaEthereal(mailOpts);
}

module.exports = { sendMail };
