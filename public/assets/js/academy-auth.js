async function sendJson(url, payload) {
  const res = await fetch(url, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    credentials: "include",
    body: JSON.stringify(payload)
  });

  const data = await res.json().catch(() => ({}));
  if (!res.ok) {
    throw new Error(data.error || "Request failed.");
  }
  return data;
}

function showMsg(el, text, type) {
  el.textContent = text;
  el.className = `msg show ${type}`;
}

document.addEventListener("DOMContentLoaded", () => {
  const loginForm    = document.getElementById("login-form");
  const registerForm = document.getElementById("register-form");
  const loginMsg     = document.getElementById("login-msg");
  const registerMsg  = document.getElementById("register-msg");

  // ── SIGN IN ──
  loginForm?.addEventListener("submit", async (e) => {
    e.preventDefault();
    const form = new FormData(loginForm);

    try {
      const data = await sendJson("/api/auth/login", {
        fullName: form.get("fullName"),
        password: form.get("password")
      });

      showMsg(loginMsg, "Sign-in successful. Redirecting...", "success");
      try { sessionStorage.setItem("tfa_just_logged_in", Date.now()); } catch (_) {}
      window.location.href = data.redirect || "/member/";
    } catch (err) {
      showMsg(loginMsg, err.message, "error");
    }
  });

  // ── CREATE ACCOUNT ──
  registerForm?.addEventListener("submit", async (e) => {
    e.preventDefault();
    const form            = new FormData(registerForm);
    const password        = String(form.get("password") || "");
    const confirmPassword = String(form.get("confirmPassword") || "");

    if (password !== confirmPassword) {
      showMsg(registerMsg, "Passwords do not match.", "error");
      return;
    }

    try {
      const data = await sendJson("/api/auth/register", {
        fullName: form.get("fullName"),
        memberId: form.get("memberId") || "",
        email:    form.get("email"),
        password
      });

      showMsg(registerMsg, "Account created! Taking you to your profile...", "success");
      try { sessionStorage.setItem("tfa_just_logged_in", Date.now()); } catch (_) {}
      setTimeout(() => {
        window.location.href = data.redirect || "/member/profile?new=1";
      }, 800);
    } catch (err) {
      showMsg(registerMsg, err.message, "error");
    }
  });
});
