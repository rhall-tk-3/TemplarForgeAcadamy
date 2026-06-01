'use strict';

/**
 * mailerService.js — shared, Railway-hardened email transport
 *
 * Priority order:
 *   1. RESEND_API_KEY  → Resend.com REST API (most reliable on Railway; no SMTP port issues)
 *   2. SMTP_HOST       → nodemailer SMTP with hardened TLS/timeout config
 *   3. Neither         → Ethereal test-catch (dev only; preview URL logged)
 *
 * Railway note:
 *   Railway's network commonly blocks outbound SMTP on port 587/465.
 *   Resend (HTTPS port 443) is the recommended path for production.
 *   Sign up free at https://resend.com → API Keys → add RESEND_API_KEY to Railway.
 *   Also set RESEND_FROM to your verified sender, e.g.:
 *     RESEND_FROM=Templar Forge Academy <noreply@templarforge.academy>
 *
 * Exports:
 *   sendMail({ from, to, subject, text, html })
 *   → Promise<{ messageId, preview: url|null }>
 *   Throws on failure (caller should catch and handle).
 */

const nodemailer = require('nodemailer');
const https      = require('https');

// ── 1. Resend REST transport (no SMTP port; uses HTTPS 443) ─────────────────

function sendViaResend({ from, to, subject, text, html }) {
  return new Promise((resolve, reject) => {
    const apiKey = process.env.RESEND_API_KEY;
    const fromAddr = from
      || process.env.RESEND_FROM
      || process.env.SMTP_FROM
      || 'Templar Forge Academy <noreply@templarforge.academy>';

    const body = JSON.stringify({ from: fromAddr, to: [to], subject, text, html });

    const options = {
      hostname: 'api.resend.com',
      port:     443,
      path:     '/emails',
      method:   'POST',
      headers: {
        'Authorization': `Bearer ${apiKey}`,
        'Content-Type':  'application/json',
        'Content-Length': Buffer.byteLength(body),
      },
    };

    const req = https.request(options, (res) => {
      let data = '';
      res.on('data', chunk => { data += chunk; });
      res.on('end', () => {
        try {
          const parsed = JSON.parse(data);
          if (res.statusCode >= 200 && res.statusCode < 300) {
            resolve({ messageId: parsed.id || 'resend-ok', preview: null });
          } else {
            reject(new Error(`Resend API error ${res.statusCode}: ${parsed.message || data}`));
          }
        } catch (e) {
          reject(new Error(`Resend parse error: ${e.message}`));
        }
      });
    });

    req.on('error', (e) => reject(new Error(`Resend network error: ${e.message}`)));
    req.setTimeout(15000, () => { req.destroy(); reject(new Error('Resend request timed out')); });
    req.write(body);
    req.end();
  });
}

// ── 2. Nodemailer SMTP transport (hardened for Railway) ──────────────────────

async function buildSmtpTransporter() {
  const host = process.env.SMTP_HOST;
  const port = Number(process.env.SMTP_PORT) || 587;

  // Gmail-specific: port 465 = SSL (secure:true), port 587 = STARTTLS (secure:false + requireTLS:true)
  const isSSL = port === 465;

  return nodemailer.createTransport({
    host,
    port,
    secure: isSSL,
    requireTLS: !isSSL,           // force STARTTLS on port 587; never allow plain-text fallback
    auth: {
      user: process.env.SMTP_USER,
      pass: process.env.SMTP_PASS,
    },
    tls: {
      // Accept self-signed or intermediate certs (common on Railway proxies)
      rejectUnauthorized: false,
      minVersion: 'TLSv1.2',
    },
    // Explicit timeouts — Railway default is very short; 30s is safe for Gmail
    connectionTimeout: 30000,   // 30 s to establish TCP connection
    greetingTimeout:   20000,   // 20 s to receive SMTP greeting
    socketTimeout:     60000,   // 60 s max for entire transaction
    // Pooling off — each send is independent; avoids stale-connection errors
    pool: false,
    // Disable SMTP pipelining (some Railway egress proxies strip PIPELINING capability)
    disableFileAccess: true,
  });
}

// ── 3. Ethereal fallback (dev only) ─────────────────────────────────────────

async function buildEtherealTransporter() {
  const testAccount = await nodemailer.createTestAccount();
  return nodemailer.createTransport({
    host: 'smtp.ethereal.email',
    port: 587,
    secure: false,
    auth: { user: testAccount.user, pass: testAccount.pass },
    connectionTimeout: 20000,
    greetingTimeout:   15000,
    socketTimeout:     30000,
  });
}

// ── Public: sendMail ─────────────────────────────────────────────────────────

/**
 * sendMail(opts)
 *
 * opts: { from?, to, subject, text, html }
 *
 * Returns { messageId, preview }  — preview is an Ethereal URL or null.
 * Throws a descriptive Error on failure.
 */
async function sendMail({ from, to, subject, text, html }) {
  // ── Path 1: Resend API ──
  if (process.env.RESEND_API_KEY) {
    console.log(`✠ Mailer: sending via Resend API to ${to}`);
    const result = await sendViaResend({ from, to, subject, text, html });
    console.log(`✠ Mailer: Resend accepted (id: ${result.messageId})`);
    return result;
  }

  // ── Path 2: SMTP ──
  if (process.env.SMTP_HOST) {
    console.log(`✠ Mailer: sending via SMTP ${process.env.SMTP_HOST}:${process.env.SMTP_PORT || 587} to ${to}`);
    const transporter = await buildSmtpTransporter();

    // Verify connection before attempting send — gives a clean error instead of timeout
    try {
      await transporter.verify();
      console.log('✠ Mailer: SMTP connection verified');
    } catch (verifyErr) {
      // Common Railway issue: SMTP port blocked by egress firewall
      throw new Error(
        `SMTP connection failed: ${verifyErr.message}. ` +
        `Check SMTP_HOST/PORT in Railway env vars, or switch to Resend (add RESEND_API_KEY).`
      );
    }

    const info    = await transporter.sendMail({ from, to, subject, text, html });
    const preview = nodemailer.getTestMessageUrl(info) || null;
    console.log(`✠ Mailer: SMTP sent (id: ${info.messageId})${preview ? ' preview: ' + preview : ''}`);
    transporter.close();
    return { messageId: info.messageId, preview };
  }

  // ── Path 3: Ethereal (dev fallback) ──
  console.log('✠ Mailer: no SMTP/Resend config — using Ethereal test account');
  const transporter = await buildEtherealTransporter();
  const info        = await transporter.sendMail({ from, to, subject, text, html });
  const preview     = nodemailer.getTestMessageUrl(info) || null;
  console.log(`✠ Mailer: Ethereal preview → ${preview}`);
  transporter.close();
  return { messageId: info.messageId, preview };
}

module.exports = { sendMail };
