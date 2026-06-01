'use strict';

/**
 * certificateService.js  — v2.0
 *
 * Sends a styled HTML certificate of completion that faithfully replicates
 * the official Templar Forge Academy PDF design:
 *
 *   • Landscape letter proportion (792×612 pt equivalent)
 *   • Light cream/yellow background (#FFFFD0) with gold-yellow horizontal bands
 *   • "CERTIFICATE OF COMPLETION" in Algerian / all-caps serif, red (#EE0000)
 *   • "this certificate is proudly presented to:" sub-label in red
 *   • Student name in large black bold serif
 *   • Program name and body copy in black/dark text
 *   • Date of completion and Certificate ID fields
 *   • "{{knights templar journey of knowledge}}" program badge line in red
 *   • Dual signature block: Schoolmaster (left) + Academy Director / Grandmaster (right)
 *   • Certificate ID generated as  TFA-{MEMBERID}-{SLUG}-{YYYYMMDD}-{HEX4}
 *
 * Env vars:
 *   SMTP_HOST / SMTP_PORT / SMTP_USER / SMTP_PASS  — live SMTP
 *   SMTP_FROM                                       — friendly sender
 *   Falls back to Ethereal test-catch in dev.
 */

const nodemailer = require('nodemailer');
const crypto     = require('crypto');

// ── Transporter ──────────────────────────────────────────────────────────────

async function buildTransporter() {
  if (process.env.SMTP_HOST) {
    return nodemailer.createTransport({
      host:   process.env.SMTP_HOST,
      port:   Number(process.env.SMTP_PORT) || 587,
      secure: Number(process.env.SMTP_PORT) === 465,
      auth: { user: process.env.SMTP_USER, pass: process.env.SMTP_PASS },
    });
  }
  const testAccount = await nodemailer.createTestAccount();
  return nodemailer.createTransport({
    host: 'smtp.ethereal.email', port: 587, secure: false,
    auth: { user: testAccount.user, pass: testAccount.pass },
  });
}

// ── Helpers ──────────────────────────────────────────────────────────────────

function fmtDate(iso) {
  return new Date(iso).toLocaleDateString('en-US', {
    year: 'numeric', month: 'long', day: 'numeric'
  });
}

/**
 * generateCertId(member, programSlug, completedAt)
 *
 * Format: TFA-{MEMBERID}-{SLUG_UPPER}-{YYYYMMDD}-{HEX4}
 * Example: TFA-KTKC-1042-KNIGHT-20260531-A3F7
 *
 * If member has no memberId we fall back to a 6-char hex derived from their username.
 */
function generateCertId(member, programSlug, completedAt) {
  const dateTag  = new Date(completedAt).toISOString().slice(0, 10).replace(/-/g, '');
  const slugTag  = (programSlug || 'PROG').toUpperCase().replace(/[^A-Z0-9]/g, '-').slice(0, 16);
  const idTag    = member.memberId
    ? String(member.memberId).toUpperCase().replace(/[^A-Z0-9\-]/g, '')
    : crypto.createHash('sha1').update(member.username || '').digest('hex').slice(0, 6).toUpperCase();
  const hex4     = crypto.randomBytes(2).toString('hex').toUpperCase();
  return `TFA-${idTag}-${slugTag}-${dateTag}-${hex4}`;
}

// ── HTML certificate (landscape email, matches PDF layout) ───────────────────

function buildCertHtml(member, programTitle, completedAt, grade, certId) {
  const displayName = `${member.salutation ? member.salutation + ' ' : ''}${member.username}`;
  const dateStr     = fmtDate(completedAt);
  const memberId    = member.memberId || '—';

  // PDF colors extracted from stream:
  //   background fill:  rgb(255,255,204)  → #FFFFD0  (1 1 0.8 rg)
  //   band fill:        rgb(255,255,153)  → #FFFF99  (1 1 0.6 rg)
  //   header red:       rgb(238,0,0)      → #EE0000  (0.933 0 0 rg)
  //   body text:        rgb(0,0,0)        → #000000  (0 g)
  //   academy red:      rgb(192,0,0)      → #C00000  (0.753 0 0 rg)
  //   border/accent:    rgb(204,153,0)    → #CC9900  (gold)

  return `<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width,initial-scale=1">
<title>Certificate of Completion — ${programTitle}</title>
</head>
<body style="margin:0;padding:0;background:#1a0a00;font-family:Georgia,'Times New Roman',serif;">

<!-- Outer wrapper -->
<table width="100%" cellpadding="0" cellspacing="0"
       style="background:#1a0a00;padding:30px 16px;">
<tr><td align="center">

<!-- ══════════ CERTIFICATE CARD (landscape proportion) ══════════ -->
<table cellpadding="0" cellspacing="0"
       style="width:100%;max-width:720px;
              background:#FFFFD0;
              border:2px solid #CC9900;
              border-radius:3px;">

  <!-- ── GOLD TOP BAND ── -->
  <tr>
    <td style="background:#CC9900;height:6px;font-size:0;line-height:0;">&nbsp;</td>
  </tr>
  <tr>
    <td style="background:#FFFF99;height:22px;font-size:0;line-height:0;">&nbsp;</td>
  </tr>

  <!-- ── RED HEADER BAND: CERTIFICATE OF COMPLETION ── -->
  <tr>
    <td align="center"
        style="background:#FFFF99;padding:6px 40px 8px;border-top:1px solid #CC9900;border-bottom:1px solid #CC9900;">
      <div style="font-family:Georgia,serif;font-size:1.55rem;font-weight:900;
                  color:#EE0000;letter-spacing:0.12em;text-transform:uppercase;
                  text-shadow:1px 1px 0 rgba(0,0,0,.08);">
        Certificate of Completion
      </div>
      <div style="width:80%;margin:5px auto 0;height:1px;background:#EE0000;opacity:.4;"></div>
    </td>
  </tr>

  <!-- ── LIGHT BAND ── -->
  <tr>
    <td style="background:#FFFFD0;height:16px;">&nbsp;</td>
  </tr>

  <!-- ── "this certificate is proudly presented to:" ── -->
  <tr>
    <td align="center" style="background:#FFFF99;padding:6px 40px;
        border-top:1px solid #CC9900;border-bottom:1px solid #CC9900;">
      <div style="font-family:Georgia,serif;font-size:0.82rem;color:#EE0000;
                  letter-spacing:0.08em;font-style:italic;">
        this certificate is proudly presented to:
      </div>
    </td>
  </tr>

  <!-- ── STUDENT NAME ── -->
  <tr>
    <td align="center" style="background:#FFFFD0;padding:14px 40px 4px;">
      <div style="font-family:Georgia,serif;font-size:2.1rem;font-weight:900;
                  color:#000000;letter-spacing:0.04em;line-height:1.15;">
        ${esc(displayName)}
      </div>
    </td>
  </tr>

  <!-- ── LIGHT BAND ── -->
  <tr>
    <td style="background:#FFFFD0;height:10px;">&nbsp;</td>
  </tr>

  <!-- ── "for successfully completing the" ── -->
  <tr>
    <td align="center" style="background:#FFFF99;padding:6px 40px;
        border-top:1px solid #CC9900;border-bottom:1px solid #CC9900;">
      <div style="font-family:Georgia,serif;font-size:0.82rem;color:#EE0000;
                  letter-spacing:0.08em;font-style:italic;">
        for successfully completing the
      </div>
    </td>
  </tr>

  <!-- ── PROGRAM NAME ── -->
  <tr>
    <td align="center" style="background:#FFFFD0;padding:12px 40px 4px;">
      <div style="font-family:Georgia,serif;font-size:1.45rem;font-weight:900;
                  color:#000000;letter-spacing:0.05em;line-height:1.2;">
        ${esc(programTitle)}
      </div>
    </td>
  </tr>

  <!-- ── PROGRAM BADGE LINE ── -->
  <tr>
    <td align="center" style="background:#FFFFD0;padding:2px 40px 10px;">
      <div style="font-family:Georgia,serif;font-size:0.68rem;color:#C00000;
                  letter-spacing:0.18em;text-transform:uppercase;">
        Knights Templar Journey of Knowledge · Program
      </div>
    </td>
  </tr>

  <!-- ── BODY COPY ── -->
  <tr>
    <td style="background:#FFFF99;padding:10px 60px;border-top:1px solid #CC9900;border-bottom:1px solid #CC9900;">
      <p style="font-family:Georgia,serif;font-size:0.82rem;color:#1a1a00;
                line-height:1.7;margin:0;text-align:center;">
        at Templar Forge Academy.<br>
        through dedication, discipline, and commitment to excellence, this student has fulfilled the<br>
        requirements of the program and demonstrated meaningful achievement in their course of study.${
          grade ? `<br><strong>Final Grade: ${esc(grade)}</strong>` : ''
        }
      </p>
    </td>
  </tr>

  <!-- ── DATE + CERT ID ── -->
  <tr>
    <td style="background:#FFFFD0;padding:12px 60px 10px;">
      <table width="100%" cellpadding="0" cellspacing="0">
        <tr>
          <td style="font-family:Georgia,serif;font-size:0.78rem;color:#1a1a00;text-align:left;padding:0 4px;">
            <strong>Date of Completion:</strong> ${dateStr}
          </td>
          <td style="font-family:Georgia,serif;font-size:0.78rem;color:#1a1a00;text-align:right;padding:0 4px;">
            <strong>Member ID:</strong> ${esc(memberId)}
          </td>
        </tr>
        <tr>
          <td colspan="2" style="font-family:Georgia,serif;font-size:0.72rem;
              color:#4a3a00;text-align:center;padding-top:4px;letter-spacing:0.06em;">
            <strong>Certificate ID:</strong> ${esc(certId)}
          </td>
        </tr>
      </table>
    </td>
  </tr>

  <!-- ── GOLD DIVIDER ── -->
  <tr>
    <td style="background:#FFFFD0;padding:0 40px;">
      <div style="border-top:1px solid #CC9900;border-bottom:1px solid #CC9900;
                  height:3px;background:#FFFF99;margin:0;"></div>
    </td>
  </tr>

  <!-- ── DUAL SIGNATURE BLOCK ── -->
  <tr>
    <td style="background:#FFFFD0;padding:16px 60px 20px;">
      <table width="100%" cellpadding="0" cellspacing="0">
        <tr>
          <!-- Left: Schoolmaster -->
          <td width="45%" style="text-align:center;vertical-align:bottom;padding:0 10px;">
            <div style="border-top:1px solid #8a7000;padding-top:6px;margin-top:20px;">
              <div style="font-family:Georgia,serif;font-size:0.75rem;font-weight:700;
                          color:#1a1a00;letter-spacing:0.1em;text-transform:uppercase;">
                Schoolmaster
              </div>
            </div>
          </td>
          <!-- Spacer -->
          <td width="10%"></td>
          <!-- Right: Academy Director / Grandmaster -->
          <td width="45%" style="text-align:center;vertical-align:bottom;padding:0 10px;">
            <div style="font-family:Georgia,serif;font-size:0.82rem;font-weight:700;
                        color:#1a1a00;margin-bottom:4px;">
              MICHAEL G. DYNAK
            </div>
            <div style="border-top:1px solid #8a7000;padding-top:6px;">
              <div style="font-family:Georgia,serif;font-size:0.75rem;font-weight:700;
                          color:#1a1a00;letter-spacing:0.1em;text-transform:uppercase;">
                Academy Director / Grandmaster
              </div>
            </div>
          </td>
        </tr>
      </table>
    </td>
  </tr>

  <!-- ── GOLD BOTTOM BAND ── -->
  <tr>
    <td style="background:#FFFF99;height:22px;font-size:0;line-height:0;">&nbsp;</td>
  </tr>
  <tr>
    <td style="background:#CC9900;height:6px;font-size:0;line-height:0;">&nbsp;</td>
  </tr>

</table>
<!-- ══════════ END CERTIFICATE ══════════ -->

<!-- Footer -->
<table width="100%" cellpadding="0" cellspacing="0" style="max-width:720px;width:100%;">
  <tr>
    <td align="center" style="padding:14px 20px 0;">
      <div style="font-family:Georgia,serif;font-size:0.68rem;color:#5a4020;line-height:1.6;">
        This certificate was issued by Templar Forge Academy · Knights of the Templar Cross.<br>
        Save or print this message for your records. Certificate ID: ${esc(certId)}<br>
        <a href="https://templarforge.academy"
           style="color:#8a6030;text-decoration:none;">templarforge.academy</a>
      </div>
    </td>
  </tr>
</table>

</td></tr>
</table>

</body>
</html>`;
}

function esc(str) {
  return String(str || '').replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;');
}

// ── Plain-text fallback ──────────────────────────────────────────────────────

function buildCertText(member, programTitle, completedAt, grade, certId) {
  const displayName = `${member.salutation ? member.salutation + ' ' : ''}${member.username}`;
  const dateStr     = fmtDate(completedAt);
  const memberId    = member.memberId || '—';
  const gradeStr    = grade ? `\nFinal Grade: ${grade}` : '';
  return [
    '✠ TEMPLAR FORGE ACADEMY — CERTIFICATE OF COMPLETION',
    '════════════════════════════════════════════════════',
    '',
    'this certificate is proudly presented to:',
    '',
    `  ${displayName}`,
    '',
    'for successfully completing the',
    '',
    `  ${programTitle}`,
    '  Knights Templar Journey of Knowledge · Program',
    '',
    'at Templar Forge Academy.',
    'through dedication, discipline, and commitment to excellence, this student',
    'has fulfilled the requirements of the program and demonstrated meaningful',
    'achievement in their course of study.' + gradeStr,
    '',
    `Date of Completion: ${dateStr}`,
    `Member ID:          ${memberId}`,
    `Certificate ID:     ${certId}`,
    '',
    '────────────────────────────────────────────────────',
    '  Schoolmaster                  MICHAEL G. DYNAK',
    '  Templar Forge Academy         Academy Director / Grandmaster',
    '────────────────────────────────────────────────────',
    '',
    'Templar Forge Academy · Knights of the Templar Cross',
    'https://templarforge.academy',
  ].join('\n');
}

// ── Public API ───────────────────────────────────────────────────────────────

/**
 * sendCertificate(member, programTitle, completedAt, grade)
 *
 * member       — userStore record (needs .username, .email, .salutation, .memberId)
 * programTitle — full display title of the completed program
 * completedAt  — ISO date string
 * grade        — optional final grade string
 * programSlug  — optional; used to build the Certificate ID (defaults to 'PROG')
 *
 * Returns { sent, preview, certId, error }
 */
async function sendCertificate(member, programTitle, completedAt, grade, programSlug) {
  if (!member.email) {
    return { sent: false, preview: null, certId: null,
      error: 'No email address on file for this member.' };
  }

  const certId = generateCertId(member, programSlug || 'PROG', completedAt);

  try {
    const transporter = await buildTransporter();
    const fromAddr    = process.env.SMTP_FROM || process.env.SMTP_USER
                        || 'noreply@templarforge.academy';
    const displayName = `${member.salutation ? member.salutation + ' ' : ''}${member.username}`;

    const info = await transporter.sendMail({
      from:    `"Templar Forge Academy" <${fromAddr}>`,
      to:      member.email,
      subject: `✠ Certificate of Completion — ${programTitle}`,
      text:    buildCertText(member, programTitle, completedAt, grade, certId),
      html:    buildCertHtml(member, programTitle, completedAt, grade, certId),
    });

    const preview = nodemailer.getTestMessageUrl(info) || null;
    console.log(
      `✠ Certificate [${certId}] sent to ${displayName} <${member.email}> ` +
      `for "${programTitle}"${preview ? ' — preview: ' + preview : ''}`
    );
    return { sent: true, preview, certId, error: null };

  } catch (err) {
    console.error(`✠ Certificate email failed for ${member.username}:`, err.message);
    return { sent: false, preview: null, certId, error: err.message };
  }
}

module.exports = { sendCertificate, buildCertHtml, generateCertId, fmtDate };
