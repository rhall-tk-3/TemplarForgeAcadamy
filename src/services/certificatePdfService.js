'use strict';

/**
 * certificatePdfService.js  — v3.0
 *
 * Renders a certificate PDF from the static template at
 * public/certificate-template.html using Puppeteer.
 *
 * Uses the full `puppeteer` package (not puppeteer-core) which downloads
 * and manages its own bundled Chromium — no system browser required.
 *
 * The template contains five placeholders:
 *   {{MEMBER_NAME}}      — member display name (salutation + username)
 *   {{PROGRAM_TITLE}}    — short program title + " Program"
 *   {{COMPLETION_DATE}}  — formatted date string
 *   {{MEMBER_ID}}        — member ID
 *   {{CERT_ID}}          — certificate ID
 *   __SEAL_DIR__         — absolute file:// URL prefix for seal PNGs
 */

const fs   = require('fs');
const path = require('path');
const os   = require('os');

// Full puppeteer — bundles its own Chromium, no executablePath needed
let puppeteer;
try {
  puppeteer = require('puppeteer');
} catch (e) {
  // Fallback to puppeteer-core if somehow only that is installed
  try { puppeteer = require('puppeteer-core'); } catch (_) {}
}

// Paths
const TEMPLATE_PATH = path.join(__dirname, '../../public/certificate-template.html');
const SEAL_DIR      = path.join(__dirname, '../../public/images');

// Browser singleton — reused across requests
let _browser = null;

async function getBrowser() {
  if (_browser) {
    try {
      await _browser.version(); // health-check — throws if disconnected
      return _browser;
    } catch (_) {
      _browser = null;
    }
  }

  if (!puppeteer) {
    throw new Error('puppeteer is not installed. Run: npm install puppeteer');
  }

  // With full `puppeteer`, executablePath() always resolves to the bundled browser.
  // No env var or `which` lookup needed.
  _browser = await puppeteer.launch({
    headless: true,
    args: [
      '--no-sandbox',
      '--disable-setuid-sandbox',
      '--disable-dev-shm-usage',
      '--disable-gpu',
      '--disable-extensions',
      '--no-zygote',
      '--font-render-hinting=none',
      '--disable-web-security',
    ],
  });

  _browser.on('disconnected', () => { _browser = null; });
  return _browser;
}

/**
 * renderCertificatePdf({ memberName, programTitle, completionDate, memberId, certId })
 *
 * Fills the static template and renders a landscape A4 PDF Buffer.
 * Retries once on browser crash, resetting the singleton.
 */
async function renderCertificatePdf({ memberName, programTitle, completionDate, memberId, certId }) {
  for (let attempt = 1; attempt <= 2; attempt++) {
    try {
      return await _renderOnce({ memberName, programTitle, completionDate, memberId, certId });
    } catch (err) {
      console.error(`✠ PDF render attempt ${attempt} failed:`, err.message);
      _browser = null; // force fresh browser on retry
      if (attempt === 2) throw err;
    }
  }
}

async function _renderOnce({ memberName, programTitle, completionDate, memberId, certId }) {
  // Read the static template
  let html = fs.readFileSync(TEMPLATE_PATH, 'utf8');

  // Inject the absolute file:// path for seal images
  const sealDirUrl = 'file://' + SEAL_DIR.replace(/\\/g, '/');
  html = html.replace(/__SEAL_DIR__/g, sealDirUrl);

  // Substitute the five data placeholders
  function esc(str) {
    return String(str || '—')
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;');
  }

  html = html
    .replace(/\{\{MEMBER_NAME\}\}/g,     esc(memberName))
    .replace(/\{\{PROGRAM_TITLE\}\}/g,   esc(programTitle))
    .replace(/\{\{COMPLETION_DATE\}\}/g, esc(completionDate))
    .replace(/\{\{MEMBER_ID\}\}/g,       esc(memberId))
    .replace(/\{\{CERT_ID\}\}/g,         esc(certId));

  // Write to temp file — page.goto('file://...') lets Puppeteer load
  // sibling file:// seal images; page.setContent() blocks them.
  const tmpFile = path.join(os.tmpdir(), `tfa-cert-${Date.now()}.html`);
  fs.writeFileSync(tmpFile, html);

  const browser = await getBrowser();
  const page    = await browser.newPage();

  try {
    await page.goto('file://' + tmpFile, {
      waitUntil: 'networkidle0',
      timeout:   45000,
    });

    const pdf = await page.pdf({
      preferCSSPageSize: true,   // honours @page { size: 297mm 210mm landscape }
      printBackground:   true,
      margin:            { top: '0', right: '0', bottom: '0', left: '0' },
    });

    return pdf; // Buffer
  } finally {
    await page.close();
    try { fs.unlinkSync(tmpFile); } catch (_) {}
  }
}

/**
 * closeBrowser() — graceful shutdown of the shared browser instance.
 */
async function closeBrowser() {
  if (_browser) {
    try { await _browser.close(); } catch (_) {}
    _browser = null;
  }
}

process.on('exit',    () => { if (_browser) _browser.close().catch(() => {}); });
process.on('SIGTERM', () => closeBrowser().finally(() => process.exit(0)));

module.exports = { renderCertificatePdf, closeBrowser };
