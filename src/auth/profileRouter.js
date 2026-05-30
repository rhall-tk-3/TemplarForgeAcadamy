/**
 * Profile API
 *
 * Member-facing:
 *   GET  /api/profile/me            — own full profile (safe, no password)
 *   POST /api/profile/me            — update temple / email / phone / birthday
 *   POST /api/profile/me/photo      — upload profile photo (multipart)
 *   DELETE /api/profile/me/photo    — remove profile photo
 *
 * Schoolmaster:
 *   GET  /api/profile/:id           — any member's profile
 *
 * Age-based auto-unlock rules (triggered on every profile save when birthday changes):
 *   Age 5–17  → squire unlocked as primary;  levie also unlocked (available as extra)
 *   Age 18+   → levie unlocked as primary;   squire also unlocked (available as extra)
 *   All programs remain GUARDED until profile is complete (temple + email + phone + birthday).
 */

const express = require('express');
const multer  = require('multer');
const path    = require('path');
const fs      = require('fs');
const { findById, updateUser } = require('./userStore');
const { getCurriculumIndex }   = require('../services/curriculumService');

const router = express.Router();

// ── Upload directory ──
const UPLOADS_DIR = path.join(__dirname, '..', '..', 'data', 'uploads');
if (!fs.existsSync(UPLOADS_DIR)) fs.mkdirSync(UPLOADS_DIR, { recursive: true });

// ── Multer: store as <userId>-<timestamp>.<ext>, accept images only ──
const storage = multer.diskStorage({
  destination: (_req, _file, cb) => cb(null, UPLOADS_DIR),
  filename: (req, file, cb) => {
    const ext = path.extname(file.originalname).toLowerCase() || '.jpg';
    cb(null, `${req.session.userId}-${Date.now()}${ext}`);
  }
});
const upload = multer({
  storage,
  limits: { fileSize: 5 * 1024 * 1024 },
  fileFilter: (_req, file, cb) => {
    const allowed = /jpeg|jpg|png|gif|webp/;
    const ok = allowed.test(file.mimetype) &&
               allowed.test(path.extname(file.originalname).toLowerCase().slice(1));
    ok ? cb(null, true) : cb(new Error('Only image files are allowed (jpg, png, gif, webp).'));
  }
});

// ── Guards ──
function requireMember(req, res, next) {
  if (!req.session.userId) return res.status(401).json({ error: 'Not signed in.' });
  next();
}
function requireAdmin(req, res, next) {
  if (!req.session.userId) return res.status(401).json({ error: 'Not signed in.' });
  if (req.session.role !== 'admin') return res.status(403).json({ error: 'Schoolmaster access required.' });
  next();
}

// ── GET /api/profile/me ──
router.get('/me', requireMember, (req, res) => {
  const user = findById(req.session.userId);
  if (!user) return res.status(401).json({ error: 'Session expired.' });
  res.json(profileView(user));
});

// ── POST /api/profile/me  { temple, email, phone, birthday } ──
router.post('/me', requireMember, (req, res) => {
  const user = findById(req.session.userId);
  if (!user) return res.status(401).json({ error: 'Session expired.' });

  const { temple, email, phone, birthday, memberId } = req.body;

  // Validate email
  if (email && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
    return res.status(400).json({ error: 'Invalid email address.' });
  }
  // Validate phone
  if (phone && !/^[\d\s\-\+\(\)\.]{7,20}$/.test(phone)) {
    return res.status(400).json({ error: 'Invalid phone number.' });
  }
  // Validate birthday: must be a real past date, member must be at least 5 years old
  if (birthday !== undefined && birthday) {
    const bDate = new Date(birthday);
    if (isNaN(bDate.getTime())) {
      return res.status(400).json({ error: 'Invalid birthday date.' });
    }
    if (bDate > new Date()) {
      return res.status(400).json({ error: 'Birthday cannot be in the future.' });
    }
    const ageYears = calcAge(birthday);
    if (ageYears < 5) {
      return res.status(400).json({ error: 'Members must be at least 5 years old.' });
    }
  }

  const updates = {};
  if (temple   !== undefined) updates.temple   = temple   ? temple.trim().slice(0, 80)   : null;
  if (email    !== undefined) updates.email    = email    ? email.trim().slice(0, 120)   : null;
  if (phone    !== undefined) updates.phone    = phone    ? phone.trim().slice(0, 30)    : null;
  if (birthday !== undefined) updates.birthday = birthday ? birthday.trim().slice(0, 10) : null;
  if (memberId !== undefined) updates.memberId = memberId ? memberId.trim().toUpperCase().slice(0, 40) : null;

  // Apply field updates first so completeness check sees the new values
  let updated = updateUser(user.id, updates);

  // Re-compute age-based auto-unlocks whenever profile is saved
  updated = applyAgeUnlocks(updated);

  res.json({ ok: true, profile: profileView(updated) });
});

// ── POST /api/profile/me/photo  (multipart field: "photo") ──
router.post('/me/photo', requireMember, (req, res) => {
  upload.single('photo')(req, res, err => {
    if (err) return res.status(400).json({ error: err.message });
    if (!req.file) return res.status(400).json({ error: 'No file received.' });

    const user = findById(req.session.userId);
    if (!user) return res.status(401).json({ error: 'Session expired.' });

    // Delete old photo if present
    if (user.photoPath) {
      const old = path.join(UPLOADS_DIR, path.basename(user.photoPath));
      if (fs.existsSync(old)) fs.unlinkSync(old);
    }

    const relativePath = `/uploads/${req.file.filename}`;
    const updated = updateUser(user.id, { photoPath: relativePath });
    res.json({ ok: true, photoPath: relativePath, profile: profileView(updated) });
  });
});

// ── DELETE /api/profile/me/photo ──
router.delete('/me/photo', requireMember, (req, res) => {
  const user = findById(req.session.userId);
  if (!user) return res.status(401).json({ error: 'Session expired.' });
  if (!user.photoPath) return res.json({ ok: true, message: 'No photo to remove.' });

  const filePath = path.join(UPLOADS_DIR, path.basename(user.photoPath));
  if (fs.existsSync(filePath)) fs.unlinkSync(filePath);

  const updated = updateUser(user.id, { photoPath: null });
  res.json({ ok: true, profile: profileView(updated) });
});

// ── GET /api/profile/:id  (schoolmaster only) ──
router.get('/:id', requireAdmin, (req, res) => {
  const user = findById(req.params.id);
  if (!user || user.role === 'admin') return res.status(404).json({ error: 'Member not found.' });
  res.json(profileView(user));
});

// ── PUT /api/profile/:id  (schoolmaster only — edit any member's core fields) ──
// Editable: username (full name), birthday, memberId, phone, email
// Age is computed from birthday — never stored directly.
router.put('/:id', requireAdmin, (req, res) => {
  const user = findById(req.params.id);
  if (!user || user.role === 'admin') return res.status(404).json({ error: 'Member not found.' });

  const { username, birthday, memberId, phone, email } = req.body;

  // Validate email
  if (email && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
    return res.status(400).json({ error: 'Invalid email address.' });
  }
  // Validate phone
  if (phone && !/^[\d\s\-\+\(\)\.]{7,20}$/.test(phone)) {
    return res.status(400).json({ error: 'Invalid phone number.' });
  }
  // Validate birthday
  if (birthday !== undefined && birthday) {
    const bDate = new Date(birthday);
    if (isNaN(bDate.getTime())) {
      return res.status(400).json({ error: 'Invalid birthday date.' });
    }
    if (bDate > new Date()) {
      return res.status(400).json({ error: 'Birthday cannot be in the future.' });
    }
    const ageYears = calcAge(birthday);
    if (ageYears < 5) {
      return res.status(400).json({ error: 'Members must be at least 5 years old.' });
    }
  }

  const updates = {};
  if (username !== undefined) updates.username = username ? username.trim().slice(0, 80)             : user.username;
  if (birthday !== undefined) updates.birthday = birthday ? birthday.trim().slice(0, 10)             : null;
  if (memberId !== undefined) updates.memberId = memberId ? memberId.trim().toUpperCase().slice(0, 40) : null;
  if (phone    !== undefined) updates.phone    = phone    ? phone.trim().slice(0, 30)                : null;
  if (email    !== undefined) updates.email    = email    ? email.trim().slice(0, 120)               : null;

  let updated = updateUser(user.id, updates);
  // Re-run age-based auto-unlocks in case birthday changed
  updated = applyAgeUnlocks(updated);

  res.json({ ok: true, profile: profileView(updated) });
});

// ─────────────────────────────────────────────────────────────────────────────
//  Age-based auto-unlock logic
//
//  Rules:
//  1. Profile must be complete (temple + email + phone + birthday all filled).
//     If incomplete → no auto-unlocks happen.
//  2. Age 5–17  → squire is primary (auto-unlocked); levie also unlocked as extra.
//  3. Age 18+   → levie is primary (auto-unlocked); squire also unlocked as extra.
//  4. This function only ever ADDS to unlockedSlugs — it never removes slugs
//     that a Schoolmaster explicitly added.
// ─────────────────────────────────────────────────────────────────────────────
function applyAgeUnlocks(user) {
  // Profile completeness check — photo NOT required
  const isComplete = !!(user.temple && user.email && user.phone && user.birthday);
  if (!isComplete) return user;

  const age     = calcAge(user.birthday);
  const unlocked = new Set(user.unlockedSlugs || []);

  if (age >= 5 && age <= 17) {
    // Youth: squire is the entry program, levie available as extra
    unlocked.add('squire');
    unlocked.add('levie');
  } else if (age >= 18) {
    // Adult: levie is the entry program, squire available as extra
    unlocked.add('levie');
    unlocked.add('squire');
  }

  const newUnlocked = [...unlocked];

  // Only write if something actually changed
  const current = JSON.stringify((user.unlockedSlugs || []).slice().sort());
  const next    = JSON.stringify(newUnlocked.slice().sort());
  if (current === next) return user;

  return updateUser(user.id, { unlockedSlugs: newUnlocked });
}

// ── Calculate age in full years from YYYY-MM-DD string ──
function calcAge(birthdayStr) {
  const today = new Date();
  const bDate  = new Date(birthdayStr);
  let age = today.getFullYear() - bDate.getFullYear();
  const mDiff = today.getMonth() - bDate.getMonth();
  if (mDiff < 0 || (mDiff === 0 && today.getDate() < bDate.getDate())) {
    age--;
  }
  return age;
}

// ── Check whether a member's profile is complete (same rules as applyAgeUnlocks) ──
function isProfileComplete(user) {
  return !!(user.temple && user.email && user.phone && user.birthday);
}

// ── Profile view (strips password, adds computed fields) ──
function profileView(u) {
  const { password, ...safe } = u;
  const age       = safe.birthday ? calcAge(safe.birthday) : null;
  const complete  = isProfileComplete(safe);
  return {
    id:         safe.id,
    username:   safe.username,
    salutation: safe.salutation,
    role:       safe.role,
    createdAt:  safe.createdAt,
    temple:     safe.temple    || null,
    email:      safe.email     || null,
    phone:      safe.phone     || null,
    birthday:   safe.birthday  || null,
    age:        age,
    photoPath:  safe.photoPath || null,
    photoUrl:   safe.photoPath ? safe.photoPath : null,
    profileComplete: complete,
    // ── Rank fields (read-only here; assigned by SM via progressionRouter) ──
    rank:            safe.rank            || null,
    rankName:        safe.rankName        || null,
    rankAssignedAt:  safe.rankAssignedAt  || null,
    // ── Member ID ──
    memberId:        safe.memberId        || null,
    // ── Member status ──
    programStatus:   safe.programStatus   || 'active',
    statusNote:      safe.statusNote      || null
  };
}

module.exports = router;
