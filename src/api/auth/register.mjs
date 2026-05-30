import fs from "fs";
import path from "path";
import bcrypt from "bcryptjs";

const registryPath = path.resolve("private/member-registry.json");
const accountsPath = path.resolve("private/accounts.json");

function readJson(file, fallback = []) {
  if (!fs.existsSync(file)) return fallback;
  return JSON.parse(fs.readFileSync(file, "utf8"));
}

function writeJson(file, data) {
  fs.mkdirSync(path.dirname(file), { recursive: true });
  fs.writeFileSync(file, JSON.stringify(data, null, 2), "utf8");
}

export default async function handler(req, res) {
  if (req.method !== "POST") return res.status(405).json({ error: "Method not allowed." });

  const { fullName, memberId, email, password } = req.body || {};
  if (!fullName || !memberId || !email || !password) {
    return res.status(400).json({ error: "Full name, Member ID, email, and password are required." });
  }

  const registry = readJson(registryPath);
  const accounts = readJson(accountsPath);
  const normalizedId = String(memberId).trim().toUpperCase();
  const normalizedName = String(fullName).trim().toUpperCase();

  const member = registry.find((m) => m.memberId === normalizedId);
  if (!member) {
    return res.status(403).json({ error: "Member ID not found. Contact the Schoolmaster." });
  }

  if (!member.portalEligible) {
    return res.status(403).json({ error: "This Member ID is not eligible for portal access." });
  }

  if (member.fullName && member.fullName.trim().toUpperCase() !== normalizedName) {
    return res.status(403).json({ error: "Full name does not match the member registry." });
  }

  if (accounts.some((a) => a.memberId === normalizedId)) {
    return res.status(409).json({ error: "An account already exists for this Member ID." });
  }

  const passwordHash = await bcrypt.hash(password, 12);
  accounts.push({
    memberId: normalizedId,
    fullName: fullName.trim(),
    email: String(email).trim().toLowerCase(),
    passwordHash,
    role: "member",
    approvalStatus: "pending",
    createdAt: new Date().toISOString()
  });

  writeJson(accountsPath, accounts);
  return res.status(200).json({ ok: true, message: "Account request submitted." });
}
