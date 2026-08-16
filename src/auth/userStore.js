/**
 * JSON file-based user store.
 * Stores users in data/users.json — no database required.
 *
 * Schoolmaster26 is the ONE hardcoded admin account.
 * It is seeded on every startup; its credentials come from env vars
 * (or the fixed defaults below) and cannot be changed via the API.
 *
 * Performance: an in-process cache avoids re-reading the file on every
 * request. The cache is populated on first read and invalidated on every
 * write so all callers within the same Node process share one parsed copy.
 * File mtime is checked on cache hits so external edits (e.g. direct volume
 * writes) are still picked up within one request cycle.
 */
const fs    = require('fs');
const path  = require('path');
const bcrypt = require('bcryptjs');
const { USERS_FILE } = require('../config/dataPaths');

// ── Reserved names that members cannot register ──
const RESERVED_NAMES = ['schoolmaster26', 'schoolmaster', 'admin', 'administrator'];

// ── Seeded admin credentials (change via env) ──
const SM_USERNAME = process.env.SM_USERNAME || 'Schoolmaster26';
// SM_PASSWORD is guaranteed non-empty by assertSecrets() in server.js at startup.
const SM_PASSWORD = process.env.SM_PASSWORD;

// ── In-process cache ──────────────────────────────────────────────────────────
// _cache   : the parsed users array (null until first read)
// _cacheMtime : mtime (ms) of the file when _cache was last populated
// On every write we bump _cacheMtime to the new mtime so the next read
// doesn't hit the disk unnecessarily.
let _cache     = null;
let _cacheMtime = 0;

function _invalidateCache() {
  _cache     = null;
  _cacheMtime = 0;
}
// ─────────────────────────────────────────────────────────────────────────────

// ── Ensure data dir + file exist ──
function init() {
  // dataPaths.js already ensures the directory exists on require
  if (!fs.existsSync(USERS_FILE)) {
    fs.writeFileSync(USERS_FILE, JSON.stringify([], null, 2));
    _invalidateCache();
  }
}

function readAll() {
  init();
  try {
    const mtime = fs.statSync(USERS_FILE).mtimeMs;
    if (_cache && mtime === _cacheMtime) return _cache;
    _cache     = JSON.parse(fs.readFileSync(USERS_FILE, 'utf8'));
    _cacheMtime = mtime;
    return _cache;
  } catch (_e) {
    // Fallback: read fresh on any stat/parse error
    _cache     = JSON.parse(fs.readFileSync(USERS_FILE, 'utf8'));
    _cacheMtime = 0;
    return _cache;
  }
}

function writeAll(users) {
  init();
  fs.writeFileSync(USERS_FILE, JSON.stringify(users, null, 2));
  // Update cache immediately — avoids a redundant disk read on the very next call
  _cache     = users;
  _cacheMtime = fs.statSync(USERS_FILE).mtimeMs;
}

// ── Seed the single Schoolmaster account ──
async function seedSchoolmaster() {
  init();
  const users = readAll();
  const existing = users.find(u => u.role === 'admin');

  if (existing) {
    // Ensure username + password + memberId stay in sync with env/defaults
    let changed = false;
    if (existing.username !== SM_USERNAME) { existing.username = SM_USERNAME; changed = true; }
    const passwordMatch = await bcrypt.compare(SM_PASSWORD, existing.password);
    if (!passwordMatch) {
      existing.password = await bcrypt.hash(SM_PASSWORD, 12);
      changed = true;
    }
    if (!existing.memberId) { existing.memberId = 'KTKC-0000'; changed = true; }
    if (changed) writeAll(users);
    return existing;
  }

  // No admin yet — create one
  const hashed = await bcrypt.hash(SM_PASSWORD, 12);
  const admin = {
    id:         '1000000000000',   // fixed ID so it never shifts
    username:   SM_USERNAME,
    salutation: null,
    role:       'admin',
    memberId:   'KTKC-0000',
    password:   hashed,
    createdAt:  new Date().toISOString()
  };
  users.unshift(admin);
  writeAll(users);
  return admin;
}

// ── Basic finders ──
function findByUsername(username) {
  return readAll().find(u => u.username.toLowerCase() === username.toLowerCase()) || null;
}

function findById(id) {
  return readAll().find(u => u.id === id) || null;
}

// ── Create a member account ──
function createUser({ username, hashedPassword, salutation, role }) {
  // Block reserved names
  if (RESERVED_NAMES.includes(username.toLowerCase())) {
    throw new Error('RESERVED_NAME');
  }
  // Block duplicate names
  if (findByUsername(username)) throw new Error('NAME_TAKEN');

  const users = readAll();
  const user = {
    id:           Date.now().toString(),
    username,
    salutation:   salutation || null,
    role:         role || 'member',
    password:     hashedPassword,
    createdAt:    new Date().toISOString(),
    // ── Profile info ──
    temple:       null,   // "Temple of [State]" — e.g. "Texas"
    email:        null,   // for certificates + schoolmaster contact
    phone:        null,   // contact number
    birthday:     null,   // ISO date string "YYYY-MM-DD" — drives age-based program unlock
    photoPath:    null,   // relative path under /uploads/
    // ── Progression tracking ──
    assignedProgram:  null,   // slug of assigned program
    programHistory:   [],     // [{ slug, assignedAt, completedAt, grade }]
    currentWeek:      null,   // 1-based week number within active program
    examSubmissions:  [],     // [{ programSlug, week, answers, submittedAt, reviewedAt, grade, notes }]
    progressNotes:    [],     // [{ date, note }] — schoolmaster notes
    unlockedSlugs:    ['levie','squire','corporal','sergeant','sfc','knight-aspirant','knight','lieutenant','captain','major','commander','chaplain'],  // all programs unlocked by default
    // ── Rank system ──
    rank:             null,   // slug of formally assigned rank (e.g. "corporal")
    rankName:         null,   // optional custom display name override (e.g. "Sir James")
    rankAssignedAt:   null,   // ISO timestamp of last rank assignment
    rankHistory:      [],     // [{ rank, rankName, assignedAt, assignedBy }]
    // ── Member status ──
    programStatus:    'active',  // 'active' | 'paused' | 'deleted'
    statusNote:       null,      // reason / note set when pausing or deleting
    statusChangedAt:  null       // ISO timestamp of last status change
  };
  users.push(user);
  writeAll(users);
  return user;
}

// ── Update any top-level field(s) on a user by id ──
function updateUser(id, fields) {
  const users = readAll();
  const idx = users.findIndex(u => u.id === id);
  if (idx === -1) throw new Error('USER_NOT_FOUND');
  users[idx] = { ...users[idx], ...fields };
  writeAll(users);
  return users[idx];
}

// ── Permanently delete a member by id (admin accounts are protected) ──
function deleteUser(id) {
  const users = readAll();
  const idx = users.findIndex(u => u.id === id);
  if (idx === -1) throw new Error('USER_NOT_FOUND');
  if (users[idx].role === 'admin') throw new Error('CANNOT_DELETE_ADMIN');
  users.splice(idx, 1);
  writeAll(users);
}

// ── Safe public view (strips password) ──
function safeUser(u) {
  const { password, ...safe } = u;
  return safe;
}

function getAllUsers() {
  return readAll().map(safeUser);
}

function getMemberUsers() {
  return readAll().filter(u => u.role === 'member').map(safeUser);
}

// ── Add a fully-formed user object (used when promoting registry accounts) ──
// Unlike createUser(), this bypasses name-uniqueness checks and accepts a
// pre-hashed password so approved portal accounts can be promoted without
// re-hashing. The caller is responsible for deduplication checks.
function addRawUser(userObj) {
  const users = readAll();
  // Tag every SM-approved member so the volume-seed migration can distinguish
  // runtime-registered users from old pre-seeded records.
  const tagged = { ...userObj, source: 'registered' };
  users.push(tagged);
  writeAll(users);
  return tagged;
}

module.exports = {
  seedSchoolmaster,
  findByUsername,
  findById,
  createUser,
  updateUser,
  deleteUser,
  getAllUsers,
  getMemberUsers,
  addRawUser,
  safeUser,
  RESERVED_NAMES
};
