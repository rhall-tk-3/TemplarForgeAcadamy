'use strict';

/**
 * certificatePdfService.js  — v4.0 (PDFKit — no browser required)
 *
 * Generates a landscape A4 certificate PDF using PDFKit — a pure Node.js
 * library with no Chromium/Puppeteer dependency. Works on every platform
 * including Railway without any special build configuration.
 *
 * Certificate design matches the approved HTML email certificate:
 *   - Dark brown envelope background (#2a1800)
 *   - Cream card (#FFFFCC) with gold border (#CC9900)
 *   - Gold top/bottom bars and yellow bands
 *   - Red title "Certificate of Completion"
 *   - Brush-script member name (simulated with italic serif at large size)
 *   - Programme name, body copy, date/member/cert fields
 *   - Three seals (Schoolmaster | TFA | Grandmaster) at bottom
 */

const fs   = require('fs');
const path = require('path');

let PDFDocument;
try { PDFDocument = require('pdfkit'); } catch (e) {
  throw new Error('pdfkit is not installed. Run: npm install pdfkit');
}

// Seal image paths
const SEAL_DIR = path.join(__dirname, '../../public/images');
const SEAL_SM  = path.join(SEAL_DIR, 'seal-schoolmaster.png');
const SEAL_TFA = path.join(SEAL_DIR, 'seal-tfa.png');
const SEAL_GM  = path.join(SEAL_DIR, 'seal-grandmaster.png');

// A4 landscape dimensions in points (1mm = 2.8346pt)
const W = 841.89; // 297mm
const H = 595.28; // 210mm

// Colour palette
const C = {
  brown:     '#2a1800',
  cream:     '#FFFFCC',
  band:      '#FFFF99',
  gold:      '#CC9900',
  red:       '#EE0000',
  crimson:   '#C00000',
  darkgold:  '#8a7000',
  nearblack: '#000000',
  midgold:   '#4a3000',
};

// Helpers
function mm(v) { return v * 2.8346; }

function hex2rgb(hex) {
  const h = hex.replace('#', '');
  return [
    parseInt(h.slice(0,2),16)/255,
    parseInt(h.slice(2,4),16)/255,
    parseInt(h.slice(4,6),16)/255,
  ];
}

function fillRect(doc, x, y, w, h, color) {
  doc.save().rect(x, y, w, h).fill(color).restore();
}

function hLine(doc, x, y, w, color, lw = 1) {
  doc.save().moveTo(x, y).lineTo(x + w, y)
    .lineWidth(lw).strokeColor(color).stroke().restore();
}

function centredText(doc, text, y, opts = {}) {
  const {
    font   = 'Helvetica',
    size   = 12,
    color  = C.nearblack,
    indent = 0,
    width  = W,
  } = opts;
  doc.save()
    .font(font).fontSize(size).fillColor(color)
    .text(text, indent, y, {
      width:  width - indent * 2,
      align:  'center',
      lineBreak: false,
    })
    .restore();
}

/**
 * renderCertificatePdf({ memberName, programTitle, completionDate, memberId, certId })
 * Returns a Promise<Buffer> containing the PDF bytes.
 */
function renderCertificatePdf({ memberName, programTitle, completionDate, memberId, certId }) {
  return new Promise((resolve, reject) => {
    try {
      const doc = new PDFDocument({
        size:    [W, H],
        margin:  0,
        layout:  'landscape',
        info: {
          Title:   'Certificate of Completion — Templar Forge Academy',
          Author:  'Templar Forge Academy',
          Creator: 'TFA Certificate Service v4.0',
        },
      });

      const chunks = [];
      doc.on('data',  c => chunks.push(c));
      doc.on('end',   () => resolve(Buffer.concat(chunks)));
      doc.on('error', reject);

      _draw(doc, { memberName, programTitle, completionDate, memberId, certId });

      doc.end();
    } catch (err) {
      reject(err);
    }
  });
}

function _draw(doc, { memberName, programTitle, completionDate, memberId, certId }) {
  // ── Envelope background ──────────────────────────────────────────────────
  const PAD = mm(6); // 6mm padding around card
  fillRect(doc, 0, 0, W, H, C.brown);

  // ── Card ─────────────────────────────────────────────────────────────────
  const CX = PAD, CY = PAD, CW = W - PAD*2, CH = H - PAD*2;
  fillRect(doc, CX, CY, CW, CH, C.cream);
  doc.save().rect(CX, CY, CW, CH)
    .lineWidth(2.5).strokeColor(C.gold).stroke().restore();

  let y = CY; // current vertical cursor (absolute page coords)

  // ── Gold top bar (8px) ───────────────────────────────────────────────────
  const BAR_H = mm(2.8);
  fillRect(doc, CX, y, CW, BAR_H, C.gold);
  y += BAR_H;

  // ── Yellow top band (28px) ───────────────────────────────────────────────
  const BAND_H = mm(9.9);
  fillRect(doc, CX, y, CW, BAND_H, C.band);
  hLine(doc, CX, y + BAND_H, CW, C.gold, 1.5);
  y += BAND_H;

  // ── Title row ────────────────────────────────────────────────────────────
  const TITLE_ROW_H = mm(18);
  fillRect(doc, CX, y, CW, TITLE_ROW_H, C.cream);

  // Gold rule above title text
  hLine(doc, CX + mm(20), y + mm(4), CW - mm(40), C.gold, 1.5);

  // "CERTIFICATE OF COMPLETION"
  const TITLE_Y = y + mm(7);
  doc.save()
    .font('Helvetica-Bold').fontSize(22)
    .fillColor(C.red)
    .text('CERTIFICATE OF COMPLETION', CX, TITLE_Y, {
      width: CW, align: 'center', lineBreak: false,
      characterSpacing: 2,
    })
    .restore();

  // Red rule below title
  const redRuleW = CW * 0.72;
  hLine(doc, CX + (CW - redRuleW)/2, y + TITLE_ROW_H - mm(2.5), redRuleW, C.red, 1.5);

  y += TITLE_ROW_H;

  // ── Yellow band: "this certificate is proudly presented to:" ─────────────
  const PBAND_H = mm(10);
  fillRect(doc, CX, y, CW, PBAND_H, C.band);
  hLine(doc, CX, y,           CW, C.gold, 1.5);
  hLine(doc, CX, y + PBAND_H, CW, C.gold, 1.5);
  doc.save()
    .font('Helvetica-Oblique').fontSize(11).fillColor(C.crimson)
    .text('this certificate is proudly presented to:', CX, y + mm(3.2), {
      width: CW, align: 'center', lineBreak: false,
    })
    .restore();
  y += PBAND_H;

  // ── Member name (large cursive-style italic) ─────────────────────────────
  const NAME_H = mm(22);
  fillRect(doc, CX, y, CW, NAME_H, C.cream);
  doc.save()
    .font('Times-BoldItalic').fontSize(40).fillColor(C.nearblack)
    .text(memberName || '—', CX, y + mm(4), {
      width: CW, align: 'center', lineBreak: false,
    })
    .restore();
  y += NAME_H;

  // ── Yellow band: "for successfully completing the" ───────────────────────
  fillRect(doc, CX, y, CW, PBAND_H, C.band);
  hLine(doc, CX, y,           CW, C.gold, 1.5);
  hLine(doc, CX, y + PBAND_H, CW, C.gold, 1.5);
  doc.save()
    .font('Helvetica-Oblique').fontSize(11).fillColor(C.crimson)
    .text('for successfully completing the', CX, y + mm(3.2), {
      width: CW, align: 'center', lineBreak: false,
    })
    .restore();
  y += PBAND_H;

  // ── Programme name ───────────────────────────────────────────────────────
  const PROG_H = mm(18);
  fillRect(doc, CX, y, CW, PROG_H, C.cream);
  doc.save()
    .font('Helvetica-Bold').fontSize(18).fillColor(C.nearblack)
    .text((programTitle || '—').toUpperCase(), CX, y + mm(3), {
      width: CW, align: 'center', lineBreak: false, characterSpacing: 1.5,
    })
    .restore();
  doc.save()
    .font('Helvetica-Oblique').fontSize(9.5).fillColor(C.crimson)
    .text('\u2736 Knights Templar Journey of Knowledge \u2736', CX, y + mm(11.5), {
      width: CW, align: 'center', lineBreak: false, characterSpacing: 2,
    })
    .restore();
  y += PROG_H;

  // ── Body copy band ───────────────────────────────────────────────────────
  const BODY_H = mm(18);
  fillRect(doc, CX, y, CW, BODY_H, C.band);
  hLine(doc, CX, y,          CW, C.gold, 1.5);
  hLine(doc, CX, y + BODY_H, CW, C.gold, 1.5);
  const bodyText =
    'at Templar Forge Academy.\n' +
    'through dedication, discipline, and commitment to excellence, this student has fulfilled the\n' +
    'requirements of the program and demonstrated meaningful achievement in their course of study.';
  doc.save()
    .font('Helvetica').fontSize(9.5).fillColor(C.nearblack)
    .text(bodyText, CX + mm(20), y + mm(3.5), {
      width: CW - mm(40), align: 'center', lineBreak: true, lineGap: 2,
    })
    .restore();
  y += BODY_H;

  // ── Data row: Date / Member ID / Cert ID ─────────────────────────────────
  const DATA_H = mm(16);
  fillRect(doc, CX, y, CW, DATA_H, C.cream);
  const colPad = mm(18);
  const halfW  = (CW - colPad*2) / 2;

  // Date — left
  doc.save().font('Helvetica-Bold').fontSize(9.5).fillColor(C.crimson)
    .text('Date of Completion:', CX + colPad, y + mm(3), { width: halfW, align: 'left', lineBreak: false })
    .restore();
  doc.save().font('Helvetica').fontSize(9.5).fillColor(C.nearblack)
    .text(completionDate || '—', CX + colPad, y + mm(8.5), { width: halfW, align: 'left', lineBreak: false })
    .restore();

  // Member ID — right
  doc.save().font('Helvetica-Bold').fontSize(9.5).fillColor(C.crimson)
    .text('Member ID:', CX + colPad + halfW, y + mm(3), { width: halfW, align: 'right', lineBreak: false })
    .restore();
  doc.save().font('Helvetica').fontSize(9.5).fillColor(C.nearblack)
    .text(memberId || '—', CX + colPad + halfW, y + mm(8.5), { width: halfW, align: 'right', lineBreak: false })
    .restore();

  // Cert ID — centred below
  doc.save().font('Helvetica-Bold').fontSize(8.5).fillColor(C.crimson)
    .text('Certificate ID: ', CX, y + DATA_H - mm(5.5), {
      width: CW, align: 'center', lineBreak: false, continued: true,
    })
    .font('Helvetica').fillColor(C.midgold)
    .text(certId || '—', { lineBreak: false })
    .restore();
  y += DATA_H;

  // ── Triple gold rule ─────────────────────────────────────────────────────
  fillRect(doc, CX, y, CW, mm(5), C.cream);
  hLine(doc, CX + mm(14), y + mm(1),   CW - mm(28), C.gold, 2.5);
  hLine(doc, CX + mm(14), y + mm(3.5), CW - mm(28), C.gold, 1);
  y += mm(5);

  // ── Knights Templar badge line ───────────────────────────────────────────
  fillRect(doc, CX, y, CW, mm(9), C.cream);
  doc.save()
    .font('Helvetica-Bold').fontSize(11).fillColor(C.red)
    .text('\u2736 KNIGHTS TEMPLAR OF THE KINGDOM OF CHRIST \u2736', CX, y + mm(1.5), {
      width: CW, align: 'center', lineBreak: false, characterSpacing: 2,
    })
    .restore();
  y += mm(9);

  // ── Remaining height for signature + seal block ──────────────────────────
  const bottomY   = CY + CH - BAR_H - BAND_H; // bottom of card before bars
  const sigBlockH = bottomY - y;
  const SIG_H     = Math.min(sigBlockH, mm(32));
  const sealTop   = bottomY - SIG_H;

  fillRect(doc, CX, sealTop, CW, SIG_H, C.cream);

  // Column layout: 3 equal columns
  const col = CW / 3;

  // ── Signature names ──────────────────────────────────────────────────────
  const sigNameY = sealTop + mm(3);

  // Left: Schoolmaster Hall
  doc.save().font('Times-BoldItalic').fontSize(18).fillColor(C.nearblack)
    .text('Schoolmaster Hall', CX, sigNameY, { width: col, align: 'center', lineBreak: false })
    .restore();
  hLine(doc, CX + mm(5), sigNameY + mm(8.5), col - mm(10), C.darkgold, 1.2);
  doc.save().font('Helvetica-Bold').fontSize(7.5).fillColor(C.nearblack)
    .text('ACADEMY DIRECTOR', CX, sigNameY + mm(10), {
      width: col, align: 'center', lineBreak: false, characterSpacing: 1.5,
    })
    .restore();

  // Right: Grand Master
  doc.save().font('Times-BoldItalic').fontSize(18).fillColor(C.nearblack)
    .text('Michael G. Dynak', CX + col*2, sigNameY, { width: col, align: 'center', lineBreak: false })
    .restore();
  hLine(doc, CX + col*2 + mm(5), sigNameY + mm(8.5), col - mm(10), C.darkgold, 1.2);
  doc.save().font('Helvetica-Bold').fontSize(7.5).fillColor(C.nearblack)
    .text('GRAND MASTER', CX + col*2, sigNameY + mm(10), {
      width: col, align: 'center', lineBreak: false, characterSpacing: 1.5,
    })
    .restore();

  // ── Seals ─────────────────────────────────────────────────────────────────
  const sealY    = sealTop + mm(14);
  const sealSmSz = mm(26);   // small seals
  const sealTfaSz = mm(32);  // TFA seal slightly larger

  // Left seal (Schoolmaster)
  if (fs.existsSync(SEAL_SM)) {
    doc.image(SEAL_SM,
      CX + col/2 - sealSmSz/2,
      sealY,
      { width: sealSmSz, height: sealSmSz }
    );
  }

  // Centre seal (TFA)
  if (fs.existsSync(SEAL_TFA)) {
    doc.image(SEAL_TFA,
      CX + col + col/2 - sealTfaSz/2,
      sealY - mm(3),
      { width: sealTfaSz, height: sealTfaSz }
    );
  }

  // Right seal (Grand Master)
  if (fs.existsSync(SEAL_GM)) {
    doc.image(SEAL_GM,
      CX + col*2 + col/2 - sealSmSz/2,
      sealY,
      { width: sealSmSz, height: sealSmSz }
    );
  }

  // ── Yellow bottom band ───────────────────────────────────────────────────
  const botBandY = CY + CH - BAR_H - BAND_H;
  fillRect(doc, CX, botBandY, CW, BAND_H, C.band);
  hLine(doc, CX, botBandY, CW, C.gold, 1.5);

  // ── Gold bottom bar ──────────────────────────────────────────────────────
  fillRect(doc, CX, CY + CH - BAR_H, CW, BAR_H, C.gold);
}

async function closeBrowser() { /* no-op — no browser to close */ }

module.exports = { renderCertificatePdf, closeBrowser };
