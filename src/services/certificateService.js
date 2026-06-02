'use strict';

/**
 * certificateService.js  — v3.3
 *
 * HTML email certificate that faithfully matches the official TFA PDF:
 *
 *  Colors (extracted directly from PDF content streams):
 *    Background:  rgb(1, 1, 0.8)   → #FFFFCC  (cream)
 *    Bands:       rgb(1, 1, 0.6)   → #FFFF99  (yellow)
 *    Title/heads: rgb(0.933,0,0)   → #EE0000  (red)
 *    Body text:   0 g              → #000000  (black)
 *    Sub-labels:  rgb(0.753,0,0)   → #C00000  (dark red)
 *    Gold border: rgb(0.8,0.6,0)   → #CC9900  (gold)
 *
 *  Fonts (extracted from PDF font table):
 *    Algerian         → title "CERTIFICATE OF COMPLETION", section headers
 *    ImprintMT-Shadow → sub-labels ("this certificate is proudly presented to:" etc.)
 *    BrushScriptMT    → student name, "MICHAEL G. DYNAK"
 *    Parchment        → decorative "Knights Templar Journey of Knowledge"
 *    Aptos            → body copy
 *
 *  Layout: landscape 792×612pt, gold corner ornaments, dual sig block
 */

const { sendMail } = require('./mailerService');
const crypto       = require('crypto');


// ── Seal images — served as absolute HTTPS URLs ─────────────────────────────
// data: URI base64 images are blocked by Gmail, Outlook, and most email clients.
// seal-*.png are in public/images/ and served statically by Express.
function getSealUrl(filename) { return getSiteUrl() + '/images/' + filename; }

// ── Helpers ──────────────────────────────────────────────────────────────────

/**
 * getSiteUrl()
 * Returns the base URL of the site at runtime — never hardcoded.
 * Priority: SITE_URL env var → RAILWAY_PUBLIC_DOMAIN → fallback to templarforge.academy
 * Set SITE_URL=https://your-domain.railway.app in Railway env vars if the
 * custom domain isn't set up yet.
 */
function getSiteUrl() {
  if (process.env.SITE_URL) return process.env.SITE_URL.replace(/\/$/, '');
  if (process.env.RAILWAY_PUBLIC_DOMAIN) return `https://${process.env.RAILWAY_PUBLIC_DOMAIN}`;
  return 'https://templarforge.academy';
}

function fmtDate(iso) {
  return new Date(iso).toLocaleDateString('en-US', {
    year: 'numeric', month: 'long', day: 'numeric'
  });
}

/**
 * Certificate ID format: TFA-{MEMBERID}-{SLUG}-{YYYYMMDD}-{HEX4}
 * Example: TFA-KTKC-1042-KNIGHT-20260601-A3F7
 */
function generateCertId(member, programSlug, completedAt) {
  const dateTag = new Date(completedAt).toISOString().slice(0, 10).replace(/-/g, '');
  const slugTag = (programSlug || 'PROG').toUpperCase().replace(/[^A-Z0-9]/g, '-').slice(0, 16);
  const idTag   = member.memberId
    ? String(member.memberId).toUpperCase().replace(/[^A-Z0-9\-]/g, '')
    : crypto.createHash('sha1').update(member.username || '').digest('hex').slice(0, 6).toUpperCase();
  const hex4    = crypto.randomBytes(2).toString('hex').toUpperCase();
  return `TFA-${idTag}-${slugTag}-${dateTag}-${hex4}`;
}

function esc(str) {
  return String(str || '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

// ── Corner ornament SVG (gold, matches PDF corner squares + diamond) ──────────
// Inline SVG so it renders in all email clients that support it;
// falls back gracefully in clients that don't.
function cornerSvg(flip) {
  const t = flip ? 'transform="scale(-1,1) translate(-32,0)"' : '';
  return `<svg width="32" height="32" viewBox="0 0 32 32" xmlns="http://www.w3.org/2000/svg" ${t}>
    <rect x="0" y="0" width="32" height="32" fill="#FFFFCC"/>
    <rect x="2" y="2" width="28" height="28" fill="none" stroke="#CC9900" stroke-width="1.5"/>
    <rect x="6" y="6" width="8" height="8" fill="#CC9900"/>
    <line x1="10" y1="6" x2="10" y2="2" stroke="#CC9900" stroke-width="1.5"/>
    <line x1="6" y1="10" x2="2" y2="10" stroke="#CC9900" stroke-width="1.5"/>
    <polygon points="10,14 14,18 10,22 6,18" fill="#CC9900"/>
  </svg>`;
}

// ── Main HTML builder ─────────────────────────────────────────────────────────

function buildCertHtml(member, programTitle, completedAt, grade, certId, programSlug) {
  const displayName = (member.salutation ? member.salutation + ' ' : '') + member.username;
  const dateStr     = fmtDate(completedAt);
  const memberId    = member.memberId || '—';
  const gradeRow    = grade
    ? `<tr><td colspan="2" style="font-family:Georgia,serif;font-size:0.78rem;color:#000;text-align:center;padding:4px 4px 0;"><strong>Final Grade: ${esc(grade)}</strong></td></tr>`
    : '';

  return `<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width,initial-scale=1">
<title>Certificate of Completion — ${esc(programTitle)}</title>
</head>
<body style="margin:0;padding:0;background:#2a1800;">

<!-- ═══════════════════════════════════════════════════════════
     OUTER MAILER WRAPPER  (dark brown — matches PDF envelope)
     ═══════════════════════════════════════════════════════════ -->
<table width="100%" cellpadding="0" cellspacing="0" border="0"
       style="background:#2a1800;padding:28px 12px;">
<tr><td align="center">

<!-- ═══════════════════════════════════════════════════════════
     CERTIFICATE CARD  — 792×612 landscape proportion
     Background: #FFFFCC  (PDF: 1 1 0.8 rg)
     ═══════════════════════════════════════════════════════════ -->
<table cellpadding="0" cellspacing="0" border="0"
  style="width:100%;max-width:760px;background:#FFFFCC;
         border:3px solid #CC9900;border-collapse:collapse;">

  <!-- ══ THICK GOLD TOP BAR ══ -->
  <tr>
    <td colspan="3" style="background:#CC9900;height:8px;font-size:0;line-height:0;padding:0;">&nbsp;</td>
  </tr>

  <!-- ══ YELLOW TOP BAND  (PDF: 1 1 0.6 rg band at top) ══ -->
  <tr>
    <td colspan="3" style="background:#FFFF99;height:28px;font-size:0;line-height:0;
        border-bottom:1.5px solid #CC9900;padding:0;">&nbsp;</td>
  </tr>

  <!-- ══ TITLE ROW: corner ornaments + CERTIFICATE OF COMPLETION ══ -->
  <tr>
    <!-- Left corner ornament -->
    <td width="38" style="background:#FFFFCC;padding:0;vertical-align:top;">${cornerSvg(false)}</td>

    <!-- Title -->
    <td style="background:#FFFFCC;padding:18px 20px 10px;text-align:center;">
      <!-- Gold rule above title -->
      <div style="height:2px;background:linear-gradient(90deg,transparent,#CC9900 20%,#CC9900 80%,transparent);margin-bottom:12px;"></div>

      <!-- CERTIFICATE OF COMPLETION  — Algerian-style -->
      <div style="
        font-family:'Palatino Linotype','Book Antiqua',Palatino,Georgia,serif;
        font-size:26px;
        font-weight:900;
        color:#EE0000;
        letter-spacing:0.18em;
        text-transform:uppercase;
        line-height:1;
      ">Certificate of Completion</div>

      <!-- Red underline rule -->
      <div style="height:2px;background:#EE0000;width:72%;margin:10px auto 0;opacity:0.7;"></div>
    </td>

    <!-- Right corner ornament (mirrored) -->
    <td width="38" style="background:#FFFFCC;padding:0;vertical-align:top;">${cornerSvg(true)}</td>
  </tr>

  <!-- ══ YELLOW BAND: "this certificate is proudly presented to:" ══ -->
  <tr>
    <td colspan="3" style="background:#FFFF99;padding:7px 40px;
        border-top:1.5px solid #CC9900;border-bottom:1.5px solid #CC9900;text-align:center;">
      <span style="
        font-family:'Palatino Linotype','Book Antiqua',Palatino,Georgia,serif;
        font-size:13px;
        font-style:italic;
        color:#C00000;
        letter-spacing:0.06em;
      ">this certificate is proudly presented to:</span>
    </td>
  </tr>

  <!-- ══ STUDENT NAME  — BrushScript style ══ -->
  <tr>
    <td colspan="3" style="background:#FFFFCC;padding:20px 40px 8px;text-align:center;">
      <div style="
        font-family:'Brush Script MT','Segoe Script','Palatino Linotype',Georgia,cursive;
        font-size:46px;
        font-weight:400;
        color:#000000;
        line-height:1.1;
        letter-spacing:0.02em;
      ">${esc(displayName)}</div>
    </td>
  </tr>

  <!-- ══ YELLOW BAND: "for successfully completing the" ══ -->
  <tr>
    <td colspan="3" style="background:#FFFF99;padding:7px 40px;
        border-top:1.5px solid #CC9900;border-bottom:1.5px solid #CC9900;text-align:center;">
      <span style="
        font-family:'Palatino Linotype','Book Antiqua',Palatino,Georgia,serif;
        font-size:13px;
        font-style:italic;
        color:#C00000;
        letter-spacing:0.06em;
      ">for successfully completing the</span>
    </td>
  </tr>

  <!-- ══ PROGRAM NAME + BADGE ══ -->
  <tr>
    <td colspan="3" style="background:#FFFFCC;padding:16px 60px 14px;text-align:center;">
      <!-- Short program name (strip ' — Templar Forge Academy' suffix if present) + "Program" -->
      <div style="
        font-family:'Palatino Linotype','Book Antiqua',Palatino,Georgia,serif;
        font-size:22px;
        font-weight:900;
        color:#000000;
        letter-spacing:0.08em;
        text-transform:uppercase;
        line-height:1.2;
      ">${esc((programTitle.includes(' — ') ? programTitle.split(' — ')[0] : programTitle).trim())} Program</div>
      <!-- Decorative order badge — stacked below the name -->
      <div style="
        font-family:'Palatino Linotype','Book Antiqua',Palatino,Georgia,serif;
        font-size:11px;
        color:#C00000;
        letter-spacing:0.22em;
        text-transform:uppercase;
        font-style:italic;
        margin-top:6px;
      ">&#10022; Knights Templar Journey of Knowledge &#10022;</div>
    </td>
  </tr>

  <!-- ══ YELLOW BAND: body copy ══ -->
  <tr>
    <td colspan="3" style="background:#FFFF99;padding:12px 70px;
        border-top:1.5px solid #CC9900;border-bottom:1.5px solid #CC9900;text-align:center;">
      <p style="
        font-family:'Palatino Linotype','Book Antiqua',Palatino,Georgia,serif;
        font-size:12.5px;
        color:#000000;
        line-height:1.75;
        margin:0;
      ">at Templar Forge Academy.<br>
      through dedication, discipline, and commitment to excellence, this student has fulfilled the<br>
      requirements of the program and demonstrated meaningful achievement in their course of study.</p>
    </td>
  </tr>

  <!-- ══ DATE · MEMBER ID · CERT ID ══ -->
  <tr>
    <td colspan="3" style="background:#FFFFCC;padding:14px 50px 12px;">
      <table width="100%" cellpadding="0" cellspacing="0" border="0">
        <tr>
          <td style="font-family:'Palatino Linotype',Georgia,serif;font-size:12px;
              color:#000;text-align:left;vertical-align:top;">
            <span style="color:#C00000;font-weight:700;letter-spacing:0.05em;">Date of Completion:</span><br>
            ${esc(dateStr)}
          </td>
          <td style="font-family:'Palatino Linotype',Georgia,serif;font-size:12px;
              color:#000;text-align:right;vertical-align:top;">
            <span style="color:#C00000;font-weight:700;letter-spacing:0.05em;">Member ID:</span><br>
            ${esc(memberId)}
          </td>
        </tr>
        ${gradeRow}
        <tr>
          <td colspan="2" style="font-family:'Palatino Linotype',Georgia,serif;font-size:11px;
              color:#4a3000;text-align:center;padding-top:8px;letter-spacing:0.07em;">
            <span style="color:#C00000;font-weight:700;">Certificate ID:</span>&nbsp;${esc(certId)}
          </td>
        </tr>
      </table>
    </td>
  </tr>

  <!-- ══ GOLD TRIPLE RULE ══ -->
  <tr>
    <td colspan="3" style="background:#FFFFCC;padding:0 40px;">
      <div style="border-top:3px solid #CC9900;"></div>
      <div style="border-top:1px solid #CC9900;margin-top:3px;"></div>
    </td>
  </tr>

  <!-- ══ KNIGHTS TEMPLAR BADGE LINE ══ -->
  <tr>
    <td colspan="3" style="background:#FFFFCC;padding:10px 60px 4px;text-align:center;">
      <div style="
        font-family:'Palatino Linotype','Book Antiqua',Palatino,Georgia,serif;
        font-size:13px;
        font-weight:900;
        color:#EE0000;
        letter-spacing:0.2em;
        text-transform:uppercase;
      ">&#10022; Knights Templar Journey of Knowledge &#10022;</div>
      <div style="
        font-family:'Palatino Linotype','Book Antiqua',Palatino,Georgia,serif;
        font-size:11px;
        color:#EE0000;
        letter-spacing:0.28em;
        text-transform:uppercase;
        margin-top:2px;
      ">Program</div>
    </td>
  </tr>

  <!-- ══ DUAL SIGNATURE BLOCK ══ -->
  <tr>
    <td colspan="3" style="background:#FFFFCC;padding:16px 50px 8px;">
      <table width="100%" cellpadding="0" cellspacing="0" border="0">

        <!-- Row 1: Signature names + lines + titles -->
        <tr>

          <!-- ── LEFT: Schoolmaster Hall / Academy Director ── -->
          <td width="38%" style="text-align:center;vertical-align:bottom;padding:0 6px 0;">
            <div style="
              font-family:'Brush Script MT','Segoe Script',Georgia,cursive;
              font-size:24px;
              color:#000;
              line-height:1;
              margin-bottom:4px;
            ">Schoolmaster Hall</div>
            <div style="border-top:1.5px solid #8a7000;padding-top:5px;">
              <div style="
                font-family:'Palatino Linotype',Georgia,serif;
                font-size:10.5px;
                font-weight:700;
                color:#000;
                letter-spacing:0.14em;
                text-transform:uppercase;
              ">Academy Director</div>
            </div>
          </td>

          <!-- ── CENTRE spacer (title row) ── -->
          <td width="24%" style="text-align:center;vertical-align:bottom;padding:0 4px 0;">
            &nbsp;
          </td>

          <!-- ── RIGHT: Michael G. Dynak / Grand Master ── -->
          <td width="38%" style="text-align:center;vertical-align:bottom;padding:0 6px 0;">
            <div style="
              font-family:'Brush Script MT','Segoe Script',Georgia,cursive;
              font-size:24px;
              color:#000;
              line-height:1;
              margin-bottom:4px;
            ">Michael G. Dynak</div>
            <div style="border-top:1.5px solid #8a7000;padding-top:5px;">
              <div style="
                font-family:'Palatino Linotype',Georgia,serif;
                font-size:10.5px;
                font-weight:700;
                color:#000;
                letter-spacing:0.14em;
                text-transform:uppercase;
              ">Grand Master</div>
            </div>
          </td>

        </tr>

        <!-- Row 2: Seal images — side seals + large TFA centre seal -->
        <tr>

          <!-- Schoolmaster seal -->
          <td width="38%" style="text-align:center;vertical-align:top;padding:10px 6px 0;">
            <img src="${getSealUrl('seal-schoolmaster.png')}"
                 alt="Schoolmaster Seal"
                 width="120" height="120"
                 style="display:inline-block;max-width:120px;height:auto;"
            />
          </td>

          <!-- TFA main seal — centred, larger, fills the space -->
          <td width="24%" style="text-align:center;vertical-align:top;padding:6px 4px 0;">
            <img src="${getSealUrl('seal-tfa.png')}"
                 alt="Templar Forge Academy Seal"
                 width="160" height="160"
                 style="display:inline-block;max-width:160px;height:auto;"
            />
          </td>

          <!-- Grand Master seal -->
          <td width="38%" style="text-align:center;vertical-align:top;padding:10px 6px 0;">
            <img src="${getSealUrl('seal-grandmaster.png')}"
                 alt="Grand Master Seal"
                 width="120" height="120"
                 style="display:inline-block;max-width:120px;height:auto;"
            />
          </td>

        </tr>

      </table>
    </td>
  </tr>

  <!-- ══ YELLOW BOTTOM BAND ══ -->
  <tr>
    <td colspan="3" style="background:#FFFF99;height:28px;font-size:0;line-height:0;
        border-top:1.5px solid #CC9900;padding:0;">&nbsp;</td>
  </tr>

  <!-- ══ THICK GOLD BOTTOM BAR ══ -->
  <tr>
    <td colspan="3" style="background:#CC9900;height:8px;font-size:0;line-height:0;padding:0;">&nbsp;</td>
  </tr>

</table>
<!-- ═══ END CERTIFICATE CARD ═══ -->

<!-- Small footer below card -->
<table width="100%" cellpadding="0" cellspacing="0" border="0"
       style="max-width:760px;width:100%;margin-top:0;">
  <tr>
    <td align="center" style="padding:16px 20px 4px;">
      ${programSlug ? `
      <!-- ── DOWNLOAD BUTTON ── -->
      <table cellpadding="0" cellspacing="0" border="0" style="margin:0 auto 14px;">
        <tr>
          <td align="center"
              style="background:#8a2000;border-radius:6px;padding:0;
                     border:1px solid #6a1800;">
            <a href="${getSiteUrl()}/member/certificate/${programSlug}/download"
               style="display:inline-block;padding:10px 28px;
                      font-family:'Palatino Linotype',Georgia,serif;
                      font-size:13px;font-weight:700;color:#f8e4b0;
                      letter-spacing:0.08em;text-decoration:none;
                      white-space:nowrap;">
              &#8659; Download Certificate PDF
            </a>
          </td>
        </tr>
      </table>` : ''}
      <p style="font-family:Georgia,serif;font-size:10.5px;color:#8a6030;
                line-height:1.6;margin:0;text-align:center;">
        This certificate was issued by Templar Forge Academy &middot; Knights Templar of the Kingdom of Christ.<br>
        Save or print this message for your records. &nbsp;|&nbsp; Certificate ID: ${esc(certId)}<br>
        <a href="${getSiteUrl()}"
           style="color:#b08040;text-decoration:none;">${getSiteUrl().replace('https://','').replace('http://','')}</a>
      </p>
    </td>
  </tr>
</table>

</td></tr>
</table>
</body>
</html>`;
}

// ── Plain-text fallback ───────────────────────────────────────────────────────

function buildCertText(member, programTitle, completedAt, grade, certId) {
  const displayName = (member.salutation ? member.salutation + ' ' : '') + member.username;
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
    `  ${(programTitle.includes(' — ') ? programTitle.split(' — ')[0] : programTitle).trim()} Program`,
    '  ✦ Knights Templar Journey of Knowledge ✦',
    '',
    'at Templar Forge Academy.',
    'through dedication, discipline, and commitment to excellence, this student',
    'has fulfilled the requirements of the program and demonstrated meaningful',
    'achievement in their course of study.' + gradeStr,
    '',
    `Date of Completion:  ${dateStr}`,
    `Member ID:           ${memberId}`,
    `Certificate ID:      ${certId}`,
    '',
    '────────────────────────────────────────',
    '  Schoolmaster Hall       Michael G. Dynak',
    '  Academy Director        Grand Master',
    '────────────────────────────────────────',
    '',
    'Templar Forge Academy · Knights Templar of the Kingdom of Christ',
    getSiteUrl(),
  ].join('\n');
}

// ── Public API ────────────────────────────────────────────────────────────────

/**
 * sendCertificate(member, programTitle, completedAt, grade, programSlug)
 *
 * member       — userStore record (.username, .email, .salutation, .memberId)
 * programTitle — full display title of the completed program
 * completedAt  — ISO date string
 * grade        — optional final grade string
 * programSlug  — optional; used in Certificate ID (defaults to 'PROG')
 *
 * Returns { sent, preview, certId, error }
 */
async function sendCertificate(member, programTitle, completedAt, grade, programSlug) {
  if (!member.email) {
    return { sent: false, preview: null, certId: null,
      error: 'No email address on file for this member.' };
  }

  const certId = generateCertId(member, programSlug || 'PROG', completedAt);

  // Smart from-address builder: use env var as-is if it already has Name <email>,
  // otherwise wrap bare email in display name.
  const rawFrom  = process.env.RESEND_FROM
                   || process.env.SMTP_FROM
                   || process.env.SMTP_USER
                   || null;
  const fromAddr = rawFrom
    ? (rawFrom.includes('<') ? rawFrom : `Templar Forge Academy <${rawFrom}>`)
    : `Templar Forge Academy <noreply@${getSiteUrl().replace(/^https?:\/\//, '').split('/')[0]}>`;
  // Strip path from domain for email address (e.g. myapp.railway.app → noreply@myapp.railway.app)

  try {
    const result = await sendMail({
      from:    fromAddr,
      to:      member.email,
      subject: `✠ Certificate of Completion — ${programTitle}`,
      text:    buildCertText(member, programTitle, completedAt, grade, certId),
      html:    buildCertHtml(member, programTitle, completedAt, grade, certId, programSlug),
    });

    const preview = result.preview || null;
    const displayName = (member.salutation ? member.salutation + ' ' : '') + member.username;
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

module.exports = { sendCertificate, buildCertHtml, buildCertText, generateCertId, fmtDate };
