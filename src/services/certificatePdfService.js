'use strict';

/**
 * certificatePdfService.js  — v5.0 (PDFKit — no browser required)
 *
 * Generates a landscape A4 certificate PDF using PDFKit.
 * All layout is relative to the card bounds — nothing overflows.
 */

const fs   = require('fs');
const path = require('path');

let PDFDocument;
try { PDFDocument = require('pdfkit'); } catch (e) {
  throw new Error('pdfkit is not installed. Run: npm install pdfkit');
}

const SEAL_DIR = path.join(__dirname, '../../public/images');
const SEAL_SM  = path.join(SEAL_DIR, 'seal-schoolmaster.png');
const SEAL_TFA = path.join(SEAL_DIR, 'seal-tfa.png');
const SEAL_GM  = path.join(SEAL_DIR, 'seal-grandmaster.png');

// A4 landscape in points
const PW = 841.89;
const PH = 595.28;

// Colours
const BROWN   = '#2a1800';
const CREAM   = '#FFFFCC';
const BAND    = '#FFFF99';
const GOLD    = '#CC9900';
const RED     = '#EE0000';
const CRIMSON = '#C00000';
const DKGOLD  = '#8a7000';
const BLACK   = '#000000';
const MIDGOLD = '#4a3000';

function mm(v) { return v * 2.8346; }

function rect(doc, x, y, w, h, fill) {
  doc.save().rect(x, y, w, h).fill(fill).restore();
}
function hline(doc, x, y, w, color, lw) {
  doc.save().moveTo(x, y).lineTo(x + w, y)
     .lineWidth(lw || 1).strokeColor(color).stroke().restore();
}
function ctext(doc, str, y, x, w, font, size, color, opts) {
  doc.save()
     .font(font).fontSize(size).fillColor(color)
     .text(str, x, y, Object.assign({ width: w, align: 'center', lineBreak: false }, opts || {}))
     .restore();
}

/**
 * renderCertificatePdf({ memberName, programTitle, completionDate, memberId, certId })
 * Returns Promise<Buffer>.
 */
function renderCertificatePdf({ memberName, programTitle, completionDate, memberId, certId }) {
  return new Promise((resolve, reject) => {
    try {
      const doc = new PDFDocument({
        size: [PW, PH], margin: 0,
        info: { Title: 'Certificate of Completion — Templar Forge Academy', Author: 'TFA' },
      });
      const chunks = [];
      doc.on('data', c => chunks.push(c));
      doc.on('end',  () => resolve(Buffer.concat(chunks)));
      doc.on('error', reject);
      _draw(doc, { memberName, programTitle, completionDate, memberId, certId });
      doc.end();
    } catch (e) { reject(e); }
  });
}

function _draw(doc, { memberName, programTitle, completionDate, memberId, certId }) {

  // ── Envelope ─────────────────────────────────────────────────────────────
  const PAD = mm(5.5);
  rect(doc, 0, 0, PW, PH, BROWN);

  // ── Card ──────────────────────────────────────────────────────────────────
  const cx = PAD, cy = PAD, cw = PW - PAD * 2, ch = PH - PAD * 2;
  rect(doc, cx, cy, cw, ch, CREAM);
  doc.save().rect(cx, cy, cw, ch).lineWidth(2.5).strokeColor(GOLD).stroke().restore();

  // shorthand helpers scoped to card
  const CH  = (str, y, font, size, color, extraOpts) =>
    ctext(doc, str, y, cx, cw, font, size, color, extraOpts);
  const HL  = (y, lw, inset) =>
    hline(doc, cx + (inset||0), y, cw - (inset||0)*2, GOLD, lw||1);
  const R   = (y, h, fill) => rect(doc, cx, y, cw, h, fill);

  let y = cy;

  // ── Gold top bar ──────────────────────────────────────────────────────────
  const BAR = mm(2.8);
  R(y, BAR, GOLD); y += BAR;

  // ── Yellow top band ───────────────────────────────────────────────────────
  const BH = mm(7);
  R(y, BH, BAND); HL(y + BH, 1.2); y += BH;

  // ── Title block ───────────────────────────────────────────────────────────
  const TH = mm(20);
  R(y, TH, CREAM);
  HL(y + mm(3.5), 1.5, mm(18));                          // gold rule above title
  CH('CERTIFICATE OF COMPLETION', y + mm(7), 'Helvetica-Bold', 21, RED, { characterSpacing: 1.8 });
  // red underline rule
  hline(doc, cx + cw*0.14, y + TH - mm(3), cw * 0.72, RED, 1.5);
  y += TH;

  // ── Presented-to band ────────────────────────────────────────────────────
  const PBH = mm(8.5);
  R(y, PBH, BAND); HL(y, 1.2); HL(y + PBH, 1.2);
  CH('this certificate is proudly presented to:', y + mm(2.8), 'Helvetica-Oblique', 10.5, CRIMSON);
  y += PBH;

  // ── Member name ───────────────────────────────────────────────────────────
  const NH = mm(21);
  R(y, NH, CREAM);
  CH(memberName || '—', y + mm(4), 'Times-BoldItalic', 42, BLACK);
  y += NH;

  // ── Completing-the band ───────────────────────────────────────────────────
  R(y, PBH, BAND); HL(y, 1.2); HL(y + PBH, 1.2);
  CH('for successfully completing the', y + mm(2.8), 'Helvetica-Oblique', 10.5, CRIMSON);
  y += PBH;

  // ── Programme name ────────────────────────────────────────────────────────
  const PRGH = mm(16);
  R(y, PRGH, CREAM);
  CH((programTitle || '').toUpperCase(), y + mm(2.5), 'Helvetica-Bold', 16, BLACK, { characterSpacing: 1.2 });
  CH('* Knights Templar Journey of Knowledge *', y + mm(10), 'Helvetica-Oblique', 9, CRIMSON, { characterSpacing: 1.5 });
  y += PRGH;

  // ── Body copy band ────────────────────────────────────────────────────────
  const BCH = mm(17);
  R(y, BCH, BAND); HL(y, 1.2); HL(y + BCH, 1.2);
  const bodyLine1 = 'at Templar Forge Academy.';
  const bodyLine2 = 'Through dedication, discipline, and commitment to excellence, this student has fulfilled the';
  const bodyLine3 = 'requirements of the program and demonstrated meaningful achievement in their course of study.';
  const bx = cx + mm(15), bw = cw - mm(30);
  doc.save().font('Helvetica').fontSize(9.5).fillColor(BLACK)
     .text(bodyLine1, bx, y + mm(3),   { width: bw, align: 'center', lineBreak: false })
     .text(bodyLine2, bx, y + mm(7),   { width: bw, align: 'center', lineBreak: false })
     .text(bodyLine3, bx, y + mm(10.5),{ width: bw, align: 'center', lineBreak: false })
     .restore();
  y += BCH;

  // ── Data row ─────────────────────────────────────────────────────────────
  const DH = mm(15);
  R(y, DH, CREAM);
  const lpx = cx + mm(18), rpx = cx + cw - mm(18);
  // Left: Date
  doc.save().font('Helvetica-Bold').fontSize(9.5).fillColor(CRIMSON)
     .text('Date of Completion:', lpx, y + mm(2.5), { lineBreak: false }).restore();
  doc.save().font('Helvetica').fontSize(9.5).fillColor(BLACK)
     .text(completionDate || '—', lpx, y + mm(7.5), { lineBreak: false }).restore();
  // Right: Member ID
  const midW = mm(50);
  doc.save().font('Helvetica-Bold').fontSize(9.5).fillColor(CRIMSON)
     .text('Member ID:', rpx - midW, y + mm(2.5), { width: midW, align: 'right', lineBreak: false }).restore();
  doc.save().font('Helvetica').fontSize(9.5).fillColor(BLACK)
     .text(memberId || '—', rpx - midW, y + mm(7.5), { width: midW, align: 'right', lineBreak: false }).restore();
  // Centre: Cert ID
  doc.save().font('Helvetica-Bold').fontSize(8).fillColor(CRIMSON)
     .text('Certificate ID:  ' + (certId || '—'), cx, y + mm(11), { width: cw, align: 'center', lineBreak: false }).restore();
  y += DH;

  // ── Triple gold rule ──────────────────────────────────────────────────────
  hline(doc, cx + mm(12), y + mm(1.2), cw - mm(24), GOLD, 2.5);
  hline(doc, cx + mm(12), y + mm(3.5), cw - mm(24), GOLD, 1);
  y += mm(6);

  // ── KT badge line ─────────────────────────────────────────────────────────
  CH('* KNIGHTS TEMPLAR OF THE KINGDOM OF CHRIST *', y + mm(0.5), 'Helvetica-Bold', 10.5, RED, { characterSpacing: 1.8 });
  y += mm(8);

  // ── Signature + seal block ────────────────────────────────────────────────
  // Remaining vertical space before bottom bands
  const BOT_BANDS = BAR + BH;
  const botStart  = cy + ch - BOT_BANDS;
  const sigH      = botStart - y;

  // Three equal columns across full card width
  const col = cw / 3;

  // Signature names — positioned at top of sig block
  const sigNameY = y + mm(2);
  doc.save().font('Times-BoldItalic').fontSize(17).fillColor(BLACK)
     .text('Schoolmaster Hall', cx, sigNameY, { width: col, align: 'center', lineBreak: false })
     .restore();
  hline(doc, cx + mm(6), sigNameY + mm(9), col - mm(12), DKGOLD, 1.2);
  doc.save().font('Helvetica-Bold').fontSize(7).fillColor(BLACK)
     .text('ACADEMY DIRECTOR', cx, sigNameY + mm(11), { width: col, align: 'center', lineBreak: false, characterSpacing: 1.5 })
     .restore();

  doc.save().font('Times-BoldItalic').fontSize(17).fillColor(BLACK)
     .text('Michael G. Dynak', cx + col * 2, sigNameY, { width: col, align: 'center', lineBreak: false })
     .restore();
  hline(doc, cx + col * 2 + mm(6), sigNameY + mm(9), col - mm(12), DKGOLD, 1.2);
  doc.save().font('Helvetica-Bold').fontSize(7).fillColor(BLACK)
     .text('GRAND MASTER', cx + col * 2, sigNameY + mm(11), { width: col, align: 'center', lineBreak: false, characterSpacing: 1.5 })
     .restore();

  // Seals — centred in each column, sized to fit remaining space
  const sealAreaH  = sigH - mm(16);        // space below sig lines
  const sealSmSz   = Math.min(mm(28), sealAreaH);
  const sealTfaSz  = Math.min(mm(33), sealAreaH + mm(3));
  const sealY      = y + mm(16);

  if (fs.existsSync(SEAL_SM)) {
    doc.image(SEAL_SM,
      cx + col / 2 - sealSmSz / 2,
      sealY,
      { width: sealSmSz, height: sealSmSz }
    );
  }
  if (fs.existsSync(SEAL_TFA)) {
    doc.image(SEAL_TFA,
      cx + col + col / 2 - sealTfaSz / 2,
      sealY - mm(2),
      { width: sealTfaSz, height: sealTfaSz }
    );
  }
  if (fs.existsSync(SEAL_GM)) {
    doc.image(SEAL_GM,
      cx + col * 2 + col / 2 - sealSmSz / 2,
      sealY,
      { width: sealSmSz, height: sealSmSz }
    );
  }

  // ── Yellow bottom band ────────────────────────────────────────────────────
  R(botStart, BH, BAND);
  HL(botStart, 1.2);

  // ── Gold bottom bar ───────────────────────────────────────────────────────
  R(botStart + BH, BAR, GOLD);
}

async function closeBrowser() { /* no-op */ }

module.exports = { renderCertificatePdf, closeBrowser };
