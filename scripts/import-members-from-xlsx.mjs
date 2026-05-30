/**
 * import-members-from-xlsx.mjs
 *
 * Reads a KTKC member-roster Excel file and writes a clean JSON registry to
 * private/member-registry.json.  That file is then consumed by the companion
 * script sync-members-to-users.mjs to upsert portal accounts.
 *
 * Usage:
 *   node scripts/import-members-from-xlsx.mjs /path/to/roster.xlsx
 *
 * Expected column headers (case-sensitive):
 *   Member ID | Full Name | First Name | Last Name | Email Address |
 *   Membership Type | Join Date | Expiry Date | Status
 *
 * Missing optional columns are tolerated — their fields will be empty strings
 * or null in the output.
 */

import fs   from "fs";
import path from "path";
import { createRequire } from "module";

// xlsx is a CommonJS package — use createRequire so we can import it from ESM
const require = createRequire(import.meta.url);
const xlsx = require("xlsx");

// ── CLI argument ──────────────────────────────────────────────────────────────
const input = process.argv[2];
if (!input) {
  console.error(
    "\nUsage: node scripts/import-members-from-xlsx.mjs /path/to/member-file.xlsx\n"
  );
  process.exit(1);
}

const inputAbs = path.resolve(input);
if (!fs.existsSync(inputAbs)) {
  console.error(`File not found: ${inputAbs}`);
  process.exit(1);
}

// ── Parse workbook ────────────────────────────────────────────────────────────
let workbook;
try {
  workbook = xlsx.readFile(inputAbs);
} catch (err) {
  console.error(`Could not read workbook: ${err.message}`);
  process.exit(1);
}

// Prefer the canonical sheet name; fall back to the first sheet
const sheetName =
  workbook.Sheets["KTKC Members ID"]
    ? "KTKC Members ID"
    : workbook.SheetNames[0];

const sheet = workbook.Sheets[sheetName];
if (!sheet) {
  console.error("No sheets found in workbook.");
  process.exit(1);
}

const rows = xlsx.utils.sheet_to_json(sheet, { defval: "" });

if (!rows.length) {
  console.warn(`Sheet "${sheetName}" is empty — nothing to import.`);
  process.exit(0);
}

// ── Helper: safe date parse ───────────────────────────────────────────────────
function parseDate(raw) {
  if (!raw || String(raw).trim() === "" || String(raw).toUpperCase() === "N/A") {
    return null;
  }
  // xlsx sometimes hands back a numeric serial for dates
  if (typeof raw === "number") {
    const d = xlsx.SSF.parse_date_code(raw);
    if (d) {
      return new Date(d.y, d.m - 1, d.d).toISOString();
    }
  }
  const d = new Date(raw);
  return isNaN(d.getTime()) ? null : d.toISOString();
}

// ── Normalize rows ─────────────────────────────────────────────────────────────
const normalized = rows
  .filter((row) => String(row["Member ID"] || "").trim())   // skip blank rows
  .map((row) => ({
    memberId:       String(row["Member ID"]       || "").trim().toUpperCase(),
    fullName:       String(row["Full Name"]       || "").trim(),
    firstName:      String(row["First Name"]      || "").trim(),
    lastName:       String(row["Last Name"]       || "").trim(),
    email:          String(row["Email Address"]   || "").trim().toLowerCase(),
    membershipType: String(row["Membership Type"] || "").trim(),
    joinDate:       parseDate(row["Join Date"]),
    expiryDate:     parseDate(row["Expiry Date"]),
    status:         String(row["Status"] || "").trim().toUpperCase(),
    portalEligible: String(row["Status"] || "").trim().toUpperCase() === "ACTIVE",
  }));

if (!normalized.length) {
  console.warn("No rows with a valid Member ID found — nothing to write.");
  process.exit(0);
}

// ── Write output ──────────────────────────────────────────────────────────────
const outDir  = path.resolve("private");
const outFile = path.join(outDir, "member-registry.json");

fs.mkdirSync(outDir, { recursive: true });
fs.writeFileSync(outFile, JSON.stringify(normalized, null, 2), "utf8");

// ── Summary ───────────────────────────────────────────────────────────────────
const activeCount   = normalized.filter((r) => r.portalEligible).length;
const inactiveCount = normalized.length - activeCount;

console.log(`\n✔  Imported ${normalized.length} member rows from "${sheetName}"`);
console.log(`   Active / portal-eligible : ${activeCount}`);
console.log(`   Inactive / ineligible    : ${inactiveCount}`);
console.log(`   Output                   : ${outFile}\n`);
console.log(
  "Next step: node scripts/sync-members-to-users.mjs\n"
);
