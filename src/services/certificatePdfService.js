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

let puppeteer;
try {
  puppeteer = require('puppeteer');
} catch (e) {
  puppeteer = null;
}

// Paths
const TEMPLATE_PATH = path.join(__dirname, '../../public/certificate-template.html');
const SEAL_DIR      = path.join(__dirname, '../../public/images');

// Browser singleton — reused across requests
let _browser = null;

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
    throw new Error('puppeteer is not installed. Run: npm install puppeteer');
  }

  const executablePath = process.env.PUPPETEER_EXECUTABLE_PATH || undefined;

  _browser = await puppeteer.launch({
    headless: true,
    executablePath,
    args: [
      '--no-sandbox',
      '--disable-setuid-sandbox',
      '--disable-dev-shm-usage',
      '--disable-gpu',
      '--disable-extensions',
      '--single-process',
      '--no-zygote',
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

  const browser = await getBrowser();
  const page    = await browser.newPage();

  try {
    await page.setViewport({ width: 1123, height: 795, deviceScaleFactor: 2 });

    // Load HTML with a file:// base URL so relative paths resolve correctly
    await page.setContent(html, {
      waitUntil: 'networkidle0',
      timeout:   20000,
    });

    const pdf = await page.pdf({
      width:           '297mm',
      height:          '210mm',
      printBackground: true,
      margin:          { top: '0', right: '0', bottom: '0', left: '0' },
    });

    return pdf; // Buffer
  } finally {
    await page.close();
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
