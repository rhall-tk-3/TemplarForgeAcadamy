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

function normalizeMemberId(v) {
  return String(v || "").trim().toUpperCase();
}

document.addEventListener("DOMContentLoaded", () => {
  const loginForm = document.getElementById("login-form");
  const registerForm = document.getElementById("register-form");
  const loginMsg = document.getElementById("login-msg");
  const registerMsg = document.getElementById("register-msg");

  loginForm?.addEventListener("submit", async (e) => {
    e.preventDefault();
    const form = new FormData(loginForm);

    try {
      const data = await sendJson("/api/auth/login", {
        fullName: form.get("fullName"),
        memberId: normalizeMemberId(form.get("memberId")),
        password: form.get("password")
      });

      showMsg(loginMsg, "Sign-in successful. Redirecting...", "success");
      window.location.href = data.redirect || "/member/";
    } catch (err) {
      showMsg(loginMsg, err.message, "error");
    }
  });

  registerForm?.addEventListener("submit", async (e) => {
    e.preventDefault();
    const form = new FormData(registerForm);
    const password = String(form.get("password") || "");
    const confirmPassword = String(form.get("confirmPassword") || "");

    if (password !== confirmPassword) {
      showMsg(registerMsg, "Passwords do not match.", "error");
      return;
    }

    try {
      await sendJson("/api/auth/register", {
        fullName: form.get("fullName"),
        memberId: normalizeMemberId(form.get("memberId")),
        email: form.get("email"),
        password
      });

      showMsg(
        registerMsg,
        "Account request received. Access will be enabled after Schoolmaster approval.",
        "success"
      );
      registerForm.reset();
    } catch (err) {
      showMsg(registerMsg, err.message, "error");
    }
  });
});
