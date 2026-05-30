import fs from "fs";
import path from "path";
import bcrypt from "bcryptjs";
import jwt from "jsonwebtoken";

const registryPath = path.resolve("private/member-registry.json");
const accountsPath = path.resolve("private/accounts.json");

function readJson(file, fallback = []) {
  if (!fs.existsSync(file)) return fallback;
  return JSON.parse(fs.readFileSync(file, "utf8"));
}

function cookie(res, token) {
  res.setHeader(
    "Set-Cookie",
    `academy_session=${token}; HttpOnly; Path=/; SameSite=Lax; Max-Age=28800; Secure`
  );
}

export default async function handler(req, res) {
  if (req.method !== "POST") return res.status(405).json({ error: "Method not allowed." });

  const { fullName, memberId, password } = req.body || {};
  if (!fullName || !memberId || !password) {
    return res.status(400).json({ error: "Full name, Member ID, and password are required." });
  }

  const normalizedId = String(memberId).trim().toUpperCase();
  const normalizedName = String(fullName).trim().toUpperCase();

  const registry = readJson(registryPath);
  const accounts = readJson(accountsPath);

  const member = registry.find((m) => m.memberId === normalizedId);
  if (!member || !member.portalEligible) {
    return res.status(403).json({ error: "This Member ID does not have academy access." });
  }

  const account = accounts.find((a) => a.memberId === normalizedId);
  if (!account) {
    return res.status(403).json({ error: "No account exists for this Member ID. Create one first." });
  }

  if (account.approvalStatus !== "approved") {
    return res.status(403).json({ error: "Your account is still pending Schoolmaster approval." });
  }

  if (String(account.fullName).trim().toUpperCase() !== normalizedName) {
    return res.status(403).json({ error: "Full name does not match the approved account." });
  }

  const valid = await bcrypt.compare(password, account.passwordHash);
  if (!valid) {
    return res.status(401).json({ error: "Invalid password." });
  }

  const token = jwt.sign(
    {
      memberId: account.memberId,
      fullName: account.fullName,
      role: account.role || "member"
    },
    process.env.JWT_SECRET,
    { expiresIn: "8h" }
  );

  cookie(res, token);
  return res.status(200).json({ ok: true });
}
