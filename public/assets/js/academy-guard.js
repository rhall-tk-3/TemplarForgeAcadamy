(async function () {
  const role = document.currentScript?.dataset?.protect || "member";

  // If the user just logged in (within the last 10 seconds), give the cookie
  // a moment to fully propagate before verifying — avoids a false-negative
  // bounce on Railway/HTTPS where the cookie may arrive on the first navigation
  // but the subsequent fetch() needs a brief settle time.
  function justLoggedIn() {
    try {
      const ts = sessionStorage.getItem('tfa_just_logged_in');
      if (!ts) return false;
      const age = Date.now() - Number(ts);
      if (age < 10000) return true;   // within 10 seconds — trust it
      sessionStorage.removeItem('tfa_just_logged_in');
      return false;
    } catch (_) { return false; }
  }

  // Check session with the server, retrying once after a short delay
  // in case the cookie hasn't fully propagated yet on first load.
  async function checkSession(retries = 2, delayMs = 600) {
    for (let i = 0; i < retries; i++) {
      try {
        if (i > 0) await new Promise(r => setTimeout(r, delayMs));
        const res = await fetch("/api/auth/session", { credentials: "include" });
        if (!res.ok) continue;
        const data = await res.json();
        if (data.authenticated) return data;
      } catch (_) { /* network error — try again */ }
    }
    return null;
  }

  // If user just logged in, do a brief delay before the first check
  // so the browser has time to commit the HttpOnly cookie to its store.
  if (justLoggedIn()) {
    await new Promise(r => setTimeout(r, 300));
  }

  const data = await checkSession(2, 800);

  if (!data) {
    // Truly not authenticated — send to login
    const next = encodeURIComponent(window.location.pathname + window.location.search);
    window.location.href = `/login?next=${next}`;
    return;
  }

  // Schoolmaster page accessed by non-schoolmaster
  if (role === "schoolmaster" && data.user.role !== "schoolmaster") {
    window.location.href = "/login?denied=role";
    return;
  }

  // Clear the just-logged-in flag now that we've confirmed the session
  try { sessionStorage.removeItem('tfa_just_logged_in'); } catch (_) {}

  document.documentElement.setAttribute("data-auth-ready", "true");
})();
