import fs from "fs";
import path from "path";
import jwt from "jsonwebtoken";

const accountsPath = path.resolve("private/accounts.json");

function readJson(file, fallback = []) {
  if (!fs.existsSync(file)) return fallback;
  return JSON.parse(fs.readFileSync(file, "utf8"));
}

function writeJson(file, data) {
  fs.mkdirSync(path.dirname(file), { recursive: true });
  fs.writeFileSync(file, JSON.stringify(data, null, 2), "utf8");
}

function parseCookie(header = "") {
  return Object.fromEntries(
    header.split(";").map(v => v.trim()).filter(Boolean).map(v => {
      const i = v.indexOf("=");
      return [v.slice(0, i), decodeURIComponent(v.slice(i + 1))];
    })
  );
}

export default function handler(req, res) {
  try {
    const cookies = parseCookie(req.headers.cookie || "");
    const token = cookies.academy_session;
    const session = jwt.verify(token, process.env.JWT_SECRET);

    if (session.role !== "schoolmaster") {
      return res.status(403).json({ error: "Forbidden." });
    }

    const { memberId, action } = req.body || {};
    if (!memberId || !action) {
      return res.status(400).json({ error: "memberId and action are required." });
    }

    const accounts = readJson(accountsPath);
    const idx = accounts.findIndex((a) => a.memberId === String(memberId).trim().toUpperCase());
    if (idx === -1) {
      return res.status(404).json({ error: "Account not found." });
    }

    accounts[idx].approvalStatus = action === "approve" ? "approved" : "rejected";
    accounts[idx].approvedAt = new Date().toISOString();
    accounts[idx].approvedBy = session.memberId;

    writeJson(accountsPath, accounts);
    return res.status(200).json({ ok: true });
  } catch {
    return res.status(401).json({ error: "Unauthorized." });
  }
}
