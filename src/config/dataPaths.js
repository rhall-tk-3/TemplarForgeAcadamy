/**
 * dataPaths.js
 *
 * Single source of truth for all writable data file paths.
 *
 * On Railway (production):  set the env var RAILWAY_VOLUME_MOUNT_PATH
 *   e.g. RAILWAY_VOLUME_MOUNT_PATH=/data
 *   All files are written to /data/... on the persistent volume.
 *
 * Locally (development): files stay in the repo's existing
 *   data/ and private/ folders — no change to local behaviour.
 */

const path = require('path');
const fs   = require('fs');

const ROOT = path.join(__dirname, '..', '..');

// If Railway volume is mounted, use it — otherwise fall back to local dirs
const VOLUME = process.env.RAILWAY_VOLUME_MOUNT_PATH || null;

const DATA_DIR    = VOLUME ? path.join(VOLUME, 'data')    : path.join(ROOT, 'data');
const PRIVATE_DIR = VOLUME ? path.join(VOLUME, 'private') : path.join(ROOT, 'private');

// Ensure both directories exist on startup
fs.mkdirSync(DATA_DIR,    { recursive: true });
fs.mkdirSync(PRIVATE_DIR, { recursive: true });

module.exports = {
  DATA_DIR,
  PRIVATE_DIR,

  // ── data/ files ──
  USERS_FILE:       path.join(DATA_DIR, 'users.json'),
  SUBMISSIONS_FILE: path.join(DATA_DIR, 'curriculum-submissions.json'),
  RESET_LOG_FILE:   path.join(DATA_DIR, 'reset-log.json'),

  // ── private/ files ──
  ACCOUNTS_FILE:    path.join(PRIVATE_DIR, 'accounts.json'),
  REGISTRY_FILE:    path.join(PRIVATE_DIR, 'member-registry.json'),
};
