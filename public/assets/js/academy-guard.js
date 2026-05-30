(async function () {
  const role = document.currentScript?.dataset?.protect || "member";

  try {
    const res = await fetch("/api/auth/session", {
      credentials: "include"
    });

    if (!res.ok) throw new Error("No session");
    const data = await res.json();

    if (!data.authenticated) throw new Error("No session");

    if (role === "schoolmaster" && data.user.role !== "schoolmaster") {
      window.location.href = "/account/?denied=role";
      return;
    }

    document.documentElement.setAttribute("data-auth-ready", "true");
  } catch {
    const next = encodeURIComponent(window.location.pathname + window.location.search);
    window.location.href = `/account/?next=${next}`;
  }
})();
