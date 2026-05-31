'use strict';

/**
 * certificateService.js
 *
 * Builds a styled HTML completion certificate and sends it to the member's
 * email address via the shared SMTP transporter (same one used by
 * authRouter reset-password emails).
 *
 * Uses:
 *   SMTP_HOST / SMTP_PORT / SMTP_USER / SMTP_PASS — real SMTP (e.g. Gmail, SendGrid)
 *   SMTP_FROM  — optional friendly sender address
 *
 * Falls back to Ethereal (test catches) when SMTP is not configured, so
 * you can verify the cert looks right in dev without a real mail server.
 * The preview URL is returned in the result object.
 */

const nodemailer = require('nodemailer');

// ── Reuse the same transporter pattern as authRouter ──
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
  const testAccount = await nodemailer.createTestAccount();
  return nodemailer.createTransport({
    host:   'smtp.ethereal.email',
    port:   587,
    secure: false,
    auth: { user: testAccount.user, pass: testAccount.pass },
  });
}

// ── Format a date as "May 31, 2026" ──
function fmtDate(isoString) {
  return new Date(isoString).toLocaleDateString('en-US', {
    year: 'numeric', month: 'long', day: 'numeric'
  });
}

// ── Build the certificate HTML email ──
function buildCertHtml(member, programTitle, completedAt, grade) {
  const name     = `${member.salutation ? member.salutation + ' ' : ''}${member.username}`;
  const dateStr  = fmtDate(completedAt);
  const gradeStr = grade ? ` with a grade of <strong>${grade}</strong>` : '';

  return `<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width,initial-scale=1">
<title>Certificate of Completion</title>
</head>
<body style="margin:0;padding:0;background:#0a0305;font-family:Georgia,serif;">

<table width="100%" cellpadding="0" cellspacing="0" style="background:#0a0305;padding:40px 20px;">
  <tr><td align="center">

    <!-- Certificate card -->
    <table width="600" cellpadding="0" cellspacing="0" style="
      background:linear-gradient(160deg,#120608 0%,#0e0305 60%,#160408 100%);
      border:1px solid #3a1010;
      border-radius:4px;
      max-width:600px;
      width:100%;
    ">

      <!-- Top ornament bar -->
      <tr>
        <td style="background:linear-gradient(90deg,#1a0608,#3a0a10,#1a0608);
                   padding:4px 0;border-bottom:1px solid #4a1818;">&nbsp;</td>
      </tr>

      <!-- Header -->
      <tr>
        <td align="center" style="padding:36px 40px 0;">
          <div style="font-size:2rem;color:#c0282a;margin-bottom:6px;">✠</div>
          <div style="font-family:Georgia,serif;font-size:0.65rem;color:#6a4a30;
                      letter-spacing:0.22em;text-transform:uppercase;margin-bottom:4px;">
            Templar Forge Academy
          </div>
          <div style="font-family:Georgia,serif;font-size:0.58rem;color:#4a3020;
                      letter-spacing:0.18em;text-transform:uppercase;">
            Knights of the Templar Cross
          </div>
        </td>
      </tr>

      <!-- Thin rule -->
      <tr>
        <td align="center" style="padding:18px 60px 0;">
          <div style="border-top:1px solid #3a1010;border-bottom:1px solid #3a1010;
                      height:3px;background:transparent;"></div>
        </td>
      </tr>

      <!-- Certificate title -->
      <tr>
        <td align="center" style="padding:24px 40px 8px;">
          <div style="font-family:Georgia,serif;font-size:0.62rem;color:#8a7050;
                      letter-spacing:0.28em;text-transform:uppercase;">
            Certificate of Completion
          </div>
        </td>
      </tr>

      <!-- Presented to -->
      <tr>
        <td align="center" style="padding:4px 40px;">
          <div style="font-size:0.78rem;color:#5a4030;letter-spacing:0.08em;">
            This certifies that
          </div>
        </td>
      </tr>

      <!-- Member name -->
      <tr>
        <td align="center" style="padding:10px 40px 6px;">
          <div style="font-family:Georgia,serif;font-size:1.9rem;color:#e8d0a0;
                      font-style:italic;letter-spacing:0.04em;line-height:1.2;">
            ${name}
          </div>
        </td>
      </tr>

      <!-- Body text -->
      <tr>
        <td align="center" style="padding:8px 60px 20px;">
          <div style="font-size:0.88rem;color:#a09070;line-height:1.7;text-align:center;">
            has successfully completed the<br>
            <span style="color:#c9a84c;font-size:1.05rem;font-style:italic;">
              ${programTitle}
            </span><br>
            training program${gradeStr}<br>
            on <strong style="color:#c8b890;">${dateStr}</strong>.
          </div>
        </td>
      </tr>

      <!-- Ornament divider -->
      <tr>
        <td align="center" style="padding:0 60px 20px;">
          <div style="font-size:1.1rem;color:#3a1a10;letter-spacing:0.6em;">✠ ✠ ✠</div>
        </td>
      </tr>

      <!-- Quote / motto -->
      <tr>
        <td align="center" style="padding:0 60px 24px;">
          <div style="font-size:0.78rem;color:#5a4030;font-style:italic;line-height:1.6;">
            &ldquo;Non nobis, Domine, non nobis, sed Nomini Tuo da gloriam.&rdquo;<br>
            <span style="font-size:0.7rem;color:#3a2818;font-style:normal;">
              Not unto us, O Lord, not unto us, but unto Thy Name give glory.
            </span>
          </div>
        </td>
      </tr>

      <!-- Signature line -->
      <tr>
        <td align="center" style="padding:0 60px 30px;">
          <table width="60%" cellpadding="0" cellspacing="0">
            <tr>
              <td style="border-top:1px solid #3a2010;padding-top:8px;text-align:center;">
                <div style="font-size:0.62rem;color:#5a4030;letter-spacing:0.14em;
                            text-transform:uppercase;">
                  Schoolmaster
                </div>
                <div style="font-size:0.58rem;color:#3a2010;letter-spacing:0.1em;">
                  Templar Forge Academy
                </div>
              </td>
            </tr>
          </table>
        </td>
      </tr>

      <!-- Bottom ornament bar -->
      <tr>
        <td style="background:linear-gradient(90deg,#1a0608,#3a0a10,#1a0608);
                   padding:4px 0;border-top:1px solid #4a1818;">&nbsp;</td>
      </tr>

    </table>

    <!-- Footer note -->
    <table width="600" cellpadding="0" cellspacing="0" style="max-width:600px;width:100%;">
      <tr>
        <td align="center" style="padding:18px 20px 0;">
          <div style="font-size:0.7rem;color:#3a2818;line-height:1.5;">
            This certificate was issued by Templar Forge Academy.<br>
            You may save or print this email for your records.<br>
            <a href="https://templarforge.academy" style="color:#5a3820;text-decoration:none;">
              templarforge.academy
            </a>
          </div>
        </td>
      </tr>
    </table>

  </td></tr>
</table>

</body>
</html>`;
}

// ── Plain-text fallback ──
function buildCertText(member, programTitle, completedAt, grade) {
  const name    = `${member.salutation ? member.salutation + ' ' : ''}${member.username}`;
  const dateStr = fmtDate(completedAt);
  const gradeStr = grade ? ` with a grade of ${grade}` : '';
  return [
    '✠ TEMPLAR FORGE ACADEMY — CERTIFICATE OF COMPLETION',
    '',
    `This certifies that ${name}`,
    `has successfully completed the ${programTitle} training program${gradeStr}`,
    `on ${dateStr}.`,
    '',
    '"Non nobis, Domine, non nobis, sed Nomini Tuo da gloriam."',
    '',
    'Templar Forge Academy',
    'https://templarforge.academy',
  ].join('\n');
}

/**
 * sendCertificate(member, programTitle, completedAt, grade)
 *
 * member      — userStore record (needs .username, .email, .salutation)
 * programTitle — display title of the completed program
 * completedAt  — ISO date string of completion
 * grade        — optional grade string (e.g. "Pass", "Distinction")
 *
 * Returns { sent: bool, preview: url|null, error: string|null }
 */
async function sendCertificate(member, programTitle, completedAt, grade) {
  if (!member.email) {
    return { sent: false, preview: null, error: 'No email address on file for this member.' };
  }

  try {
    const transporter = await buildTransporter();
    const fromAddr    = process.env.SMTP_FROM || process.env.SMTP_USER || 'noreply@templarforge.academy';
    const name        = `${member.salutation ? member.salutation + ' ' : ''}${member.username}`;

    const info = await transporter.sendMail({
      from:    `"Templar Forge Academy" <${fromAddr}>`,
      to:      member.email,
      subject: `✠ Certificate of Completion — ${programTitle}`,
      text:    buildCertText(member, programTitle, completedAt, grade),
      html:    buildCertHtml(member, programTitle, completedAt, grade),
    });

    const preview = nodemailer.getTestMessageUrl(info) || null;
    console.log(`✠ Certificate sent to ${name} <${member.email}> for ${programTitle}${preview ? ' — preview: ' + preview : ''}`);
    return { sent: true, preview, error: null };
  } catch (err) {
    console.error(`✠ Certificate email failed for ${member.username}:`, err.message);
    return { sent: false, preview: null, error: err.message };
  }
}

module.exports = { sendCertificate, buildCertHtml, fmtDate };
