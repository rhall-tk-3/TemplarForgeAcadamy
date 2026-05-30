export default function handler(req, res) {
  res.setHeader(
    "Set-Cookie",
    "academy_session=; HttpOnly; Path=/; SameSite=Lax; Max-Age=0; Secure"
  );
  res.status(200).json({ ok: true });
}
