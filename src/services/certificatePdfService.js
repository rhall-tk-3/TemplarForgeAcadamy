'use strict';

/**
 * certificatePdfService.js  — v2.0
 *
 * Renders a certificate PDF from the static template at
 * public/certificate-template.html using Puppeteer.
 *
 * The template contains four placeholders:
 *   {{MEMBER_NAME}}      — member display name (salutation + username)
 *   {{PROGRAM_TITLE}}    — short program title + " Program"
 *   {{COMPLETION_DATE}}  — formatted date string
 *   {{MEMBER_ID}}        — member ID
 *   {{CERT_ID}}          — certificate ID
 *
 * Seal images are referenced via file:// URLs pointing to
 * public/images/seal-*.png  — Puppeteer loads them directly from disk,
 * so they always render regardless of DNS or network issues.
 *
 * Railway deployment: chromium system libs are installed via nixpacks.toml.
 */

const fs   = require('fs');
const path = require('path');
const os   = require('os');

// puppeteer-core has no bundled browser — it uses the system Chromium
// installed via nixpacks on Railway (set via PUPPETEER_EXECUTABLE_PATH).
let puppeteer;
try {
  puppeteer = require('puppeteer-core');
} catch (e) {
  puppeteer = null;
}

// Paths
const TEMPLATE_PATH = path.join(__dirname, '../../public/certificate-template.html');
const SEAL_DIR      = path.join(__dirname, '../../public/images');

// Browser singleton — reused across requests
let _browser = null;

/**
 * Locate the system Chromium binary.
 * Priority:
 *   1. PUPPETEER_EXECUTABLE_PATH env var (Railway Variables panel override)
 *   2. `which chromium`        (Nix package name on Railway)
 *   3. `which chromium-browser` (Debian/Ubuntu fallback)
 *   4. undefined — let puppeteer-core throw a useful error
 */
function getChromiumPath() {
  if (process.env.PUPPETEER_EXECUTABLE_PATH) {
    return process.env.PUPPETEER_EXECUTABLE_PATH;
  }
  const { execSync } = require('child_process');
  for (const cmd of ['which chromium', 'which chromium-browser']) {
    try {
      const p = execSync(cmd, { stdio: ['pipe', 'pipe', 'ignore'] }).toString().trim();
      if (p) return p;
    } catch (_) {}
  }
  return undefined; // puppeteer-core will surface a clear error
}

async function getBrowser() {
  if (_browser) {
    try {
      await _browser.version(); // health-check
      return _browser;
    } catch (_) {
      _browser = null;
    }
  }

  if (!puppeteer) {
    throw new Error('puppeteer-core is not installed. Run: npm install puppeteer-core');
  }

  const executablePath = getChromiumPath();

  _browser = await puppeteer.launch({
    headless: true,
    executablePath,
    args: [
      '--no-sandbox',
      '--disable-setuid-sandbox',
      '--disable-dev-shm-usage',
      '--disable-gpu',
      '--disable-extensions',
      '--no-zygote',
      '--font-render-hinting=none',
      '--disable-web-security',
      '--run-all-compositor-stages-before-draw',
    ],
  });

  _browser.on('disconnected', () => { _browser = null; });
  return _browser;
}

/**
 * renderCertificatePdf({ memberName, programTitle, completionDate, memberId, certId })
 *
 * Fills the static template with the five data fields and renders a
 * landscape A4 PDF Buffer.  Seals are served from the local filesystem
 * via file:// — they always appear regardless of domain/DNS state.
 */
async function renderCertificatePdf({ memberName, programTitle, completionDate, memberId, certId }) {
  // Attempt once; if the browser crashes during the run, reset and retry once.
  for (let attempt = 1; attempt <= 2; attempt++) {
    try {
      return await _renderOnce({ memberName, programTitle, completionDate, memberId, certId });
    } catch (err) {
      console.error(`✠ PDF render attempt ${attempt} failed:`, err.message);
      // Force-reset the browser singleton so the next attempt gets a fresh one
      _browser = null;
      if (attempt === 2) throw err; // re-throw on second failure
    }
  }
}

async function _renderOnce({ memberName, programTitle, completionDate, memberId, certId }) {
  // Read the static template
  let html = fs.readFileSync(TEMPLATE_PATH, 'utf8');

  // Inject the absolute file:// path for seal images
  // On all platforms: file:///absolute/path/to/public/images
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

  // Write filled HTML to a temp file so Puppeteer loads it as file://
  // This is critical — page.goto('file://...') allows the browser to load
  // sibling file:// images, whereas page.setContent() blocks them.
  const tmpFile = path.join(os.tmpdir(), `tfa-cert-${Date.now()}.html`);
  fs.writeFileSync(tmpFile, html);

  const browser = await getBrowser();
  const page    = await browser.newPage();

  try {
    // No viewport needed — page.pdf() is driven by @page CSS and preferCSSPageSize.
    await page.goto('file://' + tmpFile, {
      waitUntil: 'networkidle0',
      timeout:   45000,
    });

    const pdf = await page.pdf({
      // preferCSSPageSize lets the @page { size: 297mm 210mm landscape } rule
      // in the template take full control — no JS dimension override needed.
      preferCSSPageSize: true,
      printBackground:   true,
      margin:            { top: '0', right: '0', bottom: '0', left: '0' },
    });

    return pdf; // Buffer
  } finally {
    await page.close();
    // Clean up temp file
    try { fs.unlinkSync(tmpFile); } catch (_) {}
  }
}

/**
 * closeBrowser()
 * Gracefully shuts down the shared browser instance.
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
