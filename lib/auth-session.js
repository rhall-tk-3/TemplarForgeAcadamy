"use strict";

const jwt = require("jsonwebtoken");

function parseCookie(header = "") {
  return Object.fromEntries(
    header
      .split(";")
      .map(v => v.trim())
      .filter(Boolean)
      .map(v => {
        const i = v.indexOf("=");
        return [v.slice(0, i), decodeURIComponent(v.slice(i + 1))];
      })
  );
}

function readSession(req) {
  try {
    const cookies = parseCookie(req.headers.cookie || "");
    const token = cookies.academy_session;
    if (!token) return null;
    return jwt.verify(token, process.env.JWT_SECRET || "templar-jwt-secret-2026");
  } catch {
    return null;
  }
}

function requireSession(req, res) {
  const session = readSession(req);
  if (!session) {
    res.status(401).json({ error: "Unauthorized." });
    return null;
  }
  return session;
}

function requireSchoolmaster(req, res) {
  const session = readSession(req);
  if (!session) {
    res.status(401).json({ error: "Unauthorized." });
    return null;
  }
  if (session.role !== "schoolmaster") {
    res.status(403).json({ error: "Forbidden." });
    return null;
  }
  return session;
}

module.exports = { readSession, requireSession, requireSchoolmaster };
