import fs from "fs";
import path from "path";
import jwt from "jsonwebtoken";

const accountsPath = path.resolve("private/accounts.json");

function readJson(file, fallback = []) {
  if (!fs.existsSync(file)) return fallback;
  return JSON.parse(fs.readFileSync(file, "utf8"));
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

    const accounts = readJson(accountsPath);
    const items = accounts.filter((a) => a.approvalStatus === "pending");
    return res.status(200).json({ items });
  } catch {
    return res.status(401).json({ error: "Unauthorized." });
  }
}
