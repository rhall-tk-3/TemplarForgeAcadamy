/**
 * Simple JSON file-based user store.
 * Stores users in data/users.json — no database required.
 */
const fs   = require('fs');
const path = require('path');

const DATA_DIR  = path.join(__dirname, '..', '..', 'data');
const USERS_FILE = path.join(DATA_DIR, 'users.json');

// Ensure data directory and file exist
function init() {
  if (!fs.existsSync(DATA_DIR)) fs.mkdirSync(DATA_DIR, { recursive: true });
  if (!fs.existsSync(USERS_FILE)) fs.writeFileSync(USERS_FILE, JSON.stringify([], null, 2));
}

function readAll() {
  init();
  return JSON.parse(fs.readFileSync(USERS_FILE, 'utf8'));
}

function writeAll(users) {
  init();
  fs.writeFileSync(USERS_FILE, JSON.stringify(users, null, 2));
}

function findByUsername(username) {
  return readAll().find(u => u.username.toLowerCase() === username.toLowerCase()) || null;
}

function findById(id) {
  return readAll().find(u => u.id === id) || null;
}

function createUser({ username, hashedPassword, salutation, role }) {
  const users = readAll();
  if (findByUsername(username)) throw new Error('Name already taken');
  const user = {
    id:         Date.now().toString(),
    username,
    salutation: salutation || null,
    role:       role || 'member',
    password:   hashedPassword,
    createdAt:  new Date().toISOString()
  };
  users.push(user);
  writeAll(users);
  return user;
}

function getAllUsers() {
  return readAll().map(({ password, ...safe }) => safe); // strip passwords
}

module.exports = { findByUsername, findById, createUser, getAllUsers };
