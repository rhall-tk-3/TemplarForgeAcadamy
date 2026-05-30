/**
 * jwtSession.js
 *
 * Shared JWT-cookie session helpers used by every Express router.
 *
 * Railway (and any stateless deployment) loses the express-session store on
 * every restart.  The academy_session JWT cookie is the authoritative source
 * of truth for all member sessions.  Routers must call
 * hydrateSessionFromJwt(req) BEFORE checking req.session.userId so that cold
 * requests (where the express-session is empty) still authenticate correctly.
 */

'use strict';

const jwt  = require('jsonwebtoken');
const JWT_SECRET = process.env.JWT_SECRET || 'templar-jwt-secret-2026';

/**
 * Parse and verify the academy_session JWT cookie from the request.
 * Returns the decoded payload on success, or null on failure / absence.
 */
function verifyJwtCookie(req) {
  const raw   = req.headers.cookie || '';
  const match = raw.match(/(?:^|;\s*)academy_session=([^;]+)/);
  if (!match) return null;
  try {
    return jwt.verify(match[1], JWT_SECRET);
  } catch (_) {
    return null;
  }
}

/**
 * Populate req.session from a valid JWT cookie when the express-session store
 * has no entry for this request (e.g. after a Railway restart or on first hit).
 *
 * Returns true  — session is (or was already) populated.
 * Returns false — no valid JWT and no existing session → treat as unauthenticated.
 *
 * Must be called at the top of every guard that checks req.session.userId.
 */
function hydrateSessionFromJwt(req) {
  if (req.session && req.session.userId) return true; // already set

  const payload = verifyJwtCookie(req);
  if (!payload) return false;

  // Lazy-require userStore to avoid circular-dependency issues at module load
  // time (userStore itself requires dataPaths which may not be ready yet).
  let allUsers = [];
  try {
    const { getAllUsers } = require('../auth/userStore');
    allUsers = getAllUsers ? getAllUsers() : [];
  } catch (_) {}

  let user = null;
  if (payload.fullName) {
    user = allUsers.find(
      u => u.username && u.username.trim().toUpperCase() === payload.fullName.trim().toUpperCase()
    );
  }
  if (!user && payload.memberId) {
    user = allUsers.find(
      u => u.memberId && u.memberId.trim().toUpperCase() === payload.memberId.trim().toUpperCase()
    );
  }

  if (!user) {
    // Valid JWT for a registry-only account (not in userStore).
    // Grant a lightweight session so JWT-gated routes work.
    req.session.userId   = payload.memberId || payload.fullName || 'jwt-user';
    req.session.role     = payload.role || 'member';
    req.session.username = payload.fullName || '';
    return true;
  }

  req.session.userId   = user.id;
  req.session.role     = user.role;       // 'admin' or 'member' (from userStore)
  req.session.username = user.username;
  return true;
}

module.exports = { verifyJwtCookie, hydrateSessionFromJwt };
