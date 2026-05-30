/**
 * sync-members-to-users.mjs
 *
 * Reads private/member-registry.json (produced by import-members-from-xlsx.mjs)
 * and upserts portal accounts in data/users.json.
 *
 * Rules
 * ─────
 * 1. Match on email first, then on memberId stored in user.memberId.
 * 2. If a matching portal account is found → PATCH the membership fields only;
 *    never touch password, role, id, programHistory, examSubmissions, etc.
 * 3. If NO matching account is found AND the row is portalEligible → CREATE a
 *    stub account.  A random temporary passcode is generated; it is printed in
 *    the summary so the Schoolmaster can distribute it to the new member.
 * 4. Rows that are NOT portalEligible (status != ACTIVE) and have no existing
 *    account are skipped — no stub is created.
 * 5. Existing accounts whose registry row is now inactive get their
 *    programStatus set to "paused" (non-destructive — reversible from the SM
 *    dashboard). Their portal account is NOT deleted.
 *
 * Dry-run mode (no changes written):
 *   node scripts/sync-members-to-users.mjs --dry-run
 *
 * Usage:
 *   node scripts/sync-members-to-users.mjs [--dry-run]
 */

import fs        from "fs";
import path      from "path";
import crypto    from "crypto";
import { createRequire } from "module";

const require = createRequire(import.meta.url);
const bcrypt  = require("bcryptjs");

// ── Paths ─────────────────────────────────────────────────────────────────────
const REGISTRY_FILE = path.resolve("private", "member-registry.json");
const USERS_FILE    = path.resolve("data",    "users.json");

// ── CLI flags ─────────────────────────────────────────────────────────────────
const DRY_RUN = process.argv.includes("--dry-run");

// ── Helpers ───────────────────────────────────────────────────────────────────
function readJson(file) {
  if (!fs.existsSync(file)) return null;
  try {
    return JSON.parse(fs.readFileSync(file, "utf8"));
  } catch (err) {
    console.error(`Could not parse ${file}: ${err.message}`);
    process.exit(1);
  }
}

function writeJson(file, data) {
  fs.writeFileSync(file, JSON.stringify(data, null, 2), "utf8");
}

/** Generate a short readable temporary passcode */
function tempPasscode() {
  return crypto.randomBytes(4).toString("hex").toUpperCase(); // e.g. "3F9A2B14"
}

/**
 * Build a username from the registry row.
 * Preference order: FirstName + LastName → FullName word-slug → MemberId
 * Appends a numeric suffix if the chosen name is already taken.
 */
function buildUsername(row, existingUsernames) {
  let base;
  if (row.firstName && row.lastName) {
    base = row.firstName + row.lastName;
  } else if (row.fullName) {
    base = row.fullName.replace(/\s+/g, "");
  } else {
    base = row.memberId;
  }
  // Strip non-alphanumeric characters
  base = base.replace(/[^a-zA-Z0-9]/g, "");

  let candidate = base;
  let counter   = 1;
  const taken   = new Set(existingUsernames.map((u) => u.toLowerCase()));
  while (taken.has(candidate.toLowerCase())) {
    candidate = base + counter;
    counter += 1;
  }
  return candidate;
}

// ── Membership fields that the sync is allowed to write/overwrite ─────────────
function membershipPatch(row) {
  return {
    memberId:       row.memberId       || null,
    email:          row.email          || null,
    membershipType: row.membershipType || null,
    joinDate:       row.joinDate       || null,
    expiryDate:     row.expiryDate     || null,
    memberStatus:   row.status         || null,   // raw ACTIVE/EXPIRED/etc. from roster
  };
}

// ── Main ──────────────────────────────────────────────────────────────────────
async function main() {
  // -- Load registry
  const registry = readJson(REGISTRY_FILE);
  if (!registry) {
    console.error(`Registry not found: ${REGISTRY_FILE}`);
    console.error("Run  node scripts/import-members-from-xlsx.mjs  first.");
    process.exit(1);
  }

  // -- Load users
  const users = readJson(USERS_FILE) || [];

  if (DRY_RUN) {
    console.log("\n⚠  DRY-RUN mode — no files will be written.\n");
  }

  const report = {
    patched:  [],   // { memberId, username, changes[] }
    created:  [],   // { memberId, username, tempPasscode }
    skipped:  [],   // { memberId, reason }
    deactivated: [] // { memberId, username }
  };

  for (const row of registry) {
    // Find existing user by email (preferred) or memberId
    let existing = null;
    if (row.email) {
      existing = users.find(
        (u) => u.email && u.email.toLowerCase() === row.email.toLowerCase()
      );
    }
    if (!existing && row.memberId) {
      existing = users.find((u) => u.memberId === row.memberId);
    }

    if (existing) {
      // ── UPDATE existing account ──────────────────────────────────────────
      const patch  = membershipPatch(row);
      const changes = [];

      for (const [key, val] of Object.entries(patch)) {
        if (existing[key] !== val) {
          changes.push(`${key}: ${JSON.stringify(existing[key])} → ${JSON.stringify(val)}`);
          existing[key] = val;
        }
      }

      // Deactivate if now inactive and currently not already paused/deleted
      if (!row.portalEligible && existing.programStatus === "active") {
        changes.push("programStatus: active → paused (membership inactive)");
        existing.programStatus = "paused";
        existing.statusNote    = `Membership status in registry: ${row.status}`;
        existing.statusChangedAt = new Date().toISOString();
        report.deactivated.push({ memberId: row.memberId, username: existing.username });
      }

      // Re-activate if back to ACTIVE and was paused by a prior sync
      if (row.portalEligible && existing.programStatus === "paused" && existing.statusNote && existing.statusNote.startsWith("Membership status in registry:")) {
        changes.push("programStatus: paused → active (membership re-activated in registry)");
        existing.programStatus = "active";
        existing.statusNote    = null;
        existing.statusChangedAt = new Date().toISOString();
      }

      if (changes.length) {
        report.patched.push({ memberId: row.memberId, username: existing.username, changes });
      } else {
        report.skipped.push({ memberId: row.memberId, reason: "no changes" });
      }

    } else {
      // ── No existing account ───────────────────────────────────────────────
      if (!row.portalEligible) {
        report.skipped.push({
          memberId: row.memberId,
          reason:   `status=${row.status} — not portal-eligible, no account created`,
        });
        continue;
      }

      // ── CREATE stub account ───────────────────────────────────────────────
      const existingUsernames = users.map((u) => u.username);
      const username   = buildUsername(row, existingUsernames);
      const passcode   = tempPasscode();
      const hashed     = await bcrypt.hash(passcode, 10);

      const newUser = {
        id:              Date.now().toString() + Math.floor(Math.random() * 1000),
        username,
        salutation:      null,
        role:            "member",
        password:        hashed,
        createdAt:       new Date().toISOString(),
        importedFromRegistry: true,
        // ── Membership identity ──
        ...membershipPatch(row),
        // ── Profile (blank until member fills in) ──
        temple:          null,
        phone:           null,
        birthday:        null,
        photoPath:       null,
        // ── Progression (untouched) ──
        assignedProgram: null,
        programAssignedAt: null,
        programHistory:  [],
        currentWeek:     null,
        examSubmissions: [],
        progressNotes:   [],
        unlockedSlugs:   [],
        // ── Rank ──
        rank:            null,
        rankName:        null,
        rankAssignedAt:  null,
        rankHistory:     [],
        // ── Status ──
        programStatus:   "active",
        statusNote:      null,
        statusChangedAt: null,
      };

      users.push(newUser);
      report.created.push({
        memberId:     row.memberId,
        username,
        tempPasscode: passcode,
        email:        row.email || "(none)",
      });
    }
  }

  // ── Write users file ────────────────────────────────────────────────────────
  if (!DRY_RUN) {
    writeJson(USERS_FILE, users);
    console.log(`✔  Wrote ${users.length} total accounts to ${USERS_FILE}\n`);
  }

  // ── Print report ────────────────────────────────────────────────────────────
  const W = 60;
  console.log("─".repeat(W));
  console.log(" SYNC REPORT");
  console.log("─".repeat(W));

  if (report.created.length) {
    console.log(`\n✅  CREATED (${report.created.length} new stub accounts)\n`);
    for (const r of report.created) {
      console.log(`  Member ID : ${r.memberId}`);
      console.log(`  Username  : ${r.username}`);
      console.log(`  Email     : ${r.email}`);
      console.log(`  Temp pass : ${r.tempPasscode}  ← give this to the member`);
      console.log("");
    }
  }

  if (report.patched.length) {
    console.log(`\n📝  UPDATED (${report.patched.length} existing accounts patched)\n`);
    for (const r of report.patched) {
      console.log(`  ${r.username} (${r.memberId})`);
      for (const c of r.changes) console.log(`    • ${c}`);
      console.log("");
    }
  }

  if (report.deactivated.length) {
    console.log(`\n⏸   DEACTIVATED (${report.deactivated.length} accounts paused — membership inactive)\n`);
    for (const r of report.deactivated) {
      console.log(`  ${r.username} (${r.memberId})`);
    }
    console.log("");
  }

  if (report.skipped.length) {
    console.log(`\n⏭   SKIPPED (${report.skipped.length} rows)\n`);
    for (const r of report.skipped) {
      console.log(`  ${r.memberId} — ${r.reason}`);
    }
    console.log("");
  }

  console.log("─".repeat(W));
  console.log(
    ` Total registry rows : ${registry.length}`
  );
  console.log(
    ` Created             : ${report.created.length}`
  );
  console.log(
    ` Updated             : ${report.patched.length}`
  );
  console.log(
    ` Deactivated         : ${report.deactivated.length}`
  );
  console.log(
    ` Skipped (no change) : ${report.skipped.length}`
  );
  console.log("─".repeat(W));

  if (DRY_RUN) {
    console.log("\n⚠  DRY-RUN — no changes were written.\n");
  } else if (report.created.length) {
    console.log(
      "\n⚠  Store the temp passcodes above securely and distribute them to new members.\n" +
      "   Members should log in and change their passcode immediately.\n"
    );
  }
}

main().catch((err) => {
  console.error("Unexpected error:", err);
  process.exit(1);
});
