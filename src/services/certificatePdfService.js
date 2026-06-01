'use strict';

/**
 * certificatePdfService.js
 *
 * Renders a certificate HTML string to a landscape PDF buffer using Puppeteer.
 * The PDF is generated server-side on demand and streamed directly to the member
 * as a download — nothing is stored on disk.
 *
 * Railway deployment: chromium system libs are installed via nixpacks.toml.
 * The PUPPETEER_SKIP_DOWNLOAD env var can be set to skip bundled-chrome download
 * when the system chromium (from nixpacks) is used instead.
 */

let puppeteer;
try {
  puppeteer = require('puppeteer');
} catch (e) {
  puppeteer = null;
}

// Browser instance is reused across requests (singleton) to avoid cold-start
// overhead on every download. It is recreated if it crashes.
let _browser = null;

async function getBrowser() {
  if (_browser) {
    try {
      // Quick health check — throws if browser has crashed
      await _browser.version();
      return _browser;
    } catch (_) {
      _browser = null;
    }
  }

  if (!puppeteer) {
    throw new Error('puppeteer is not installed. Run: npm install puppeteer');
  }

  // Prefer system Chromium (set by nixpacks on Railway) over bundled one
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
      '--single-process',          // lighter on Railway
      '--no-zygote',
    ],
  });

  _browser.on('disconnected', () => { _browser = null; });
  return _browser;
}

/**
 * renderCertificatePdf(html)
 *
 * Takes the full certificate HTML string (from buildCertHtml) and returns
 * a Buffer containing a landscape A4 PDF ready to send as a download.
 */
async function renderCertificatePdf(html) {
  const browser = await getBrowser();
  const page    = await browser.newPage();

  try {
    // Landscape A4: 297mm × 210mm  (width > height)
    await page.setViewport({ width: 1123, height: 795, deviceScaleFactor: 2 });

    // Inject @page rule BEFORE setContent so Puppeteer respects the page size
    const landscapeHtml = html.replace(
      '</head>',
      `<style>
        @page { size: 297mm 210mm landscape; margin: 0; }
        html, body { width: 297mm; height: 210mm; margin: 0; padding: 0; }
      </style></head>`
    );

    await page.setContent(landscapeHtml, { waitUntil: 'networkidle0', timeout: 15000 });

    const pdf = await page.pdf({
      width:           '297mm',   // explicit landscape A4 width
      height:          '210mm',   // explicit landscape A4 height
      printBackground: true,      // essential — renders background colours
      margin:          { top: '0', right: '0', bottom: '0', left: '0' },
    });

    return pdf; // Buffer
  } finally {
    await page.close();
  }
}

/**
 * closeBrowser()
 * Gracefully shuts down the shared browser. Call on process exit.
 */
async function closeBrowser() {
  if (_browser) {
    try { await _browser.close(); } catch (_) {}
    _browser = null;
  }
}

// Clean up browser on server shutdown
process.on('exit',    () => { if (_browser) _browser.close().catch(() => {}); });
process.on('SIGTERM', () => closeBrowser().finally(() => process.exit(0)));

module.exports = { renderCertificatePdf, closeBrowser };
