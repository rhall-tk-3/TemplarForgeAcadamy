import jwt from "jsonwebtoken";

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
    if (!token) return res.status(401).json({ authenticated: false });

    const payload = jwt.verify(token, process.env.JWT_SECRET);
    return res.status(200).json({ authenticated: true, user: payload });
  } catch {
    return res.status(401).json({ authenticated: false });
  }
}
