(() => {
  "use strict";

  const wrap = document.getElementById("presentStage");
  const btn = document.getElementById("presentBtn");
  const reveal = document.getElementById("presentReveal");
  if (!wrap || !btn || !reveal) return;

  btn.addEventListener("click", () => {
    if (wrap.classList.contains("is-open")) return;
    wrap.classList.add("is-open");
    btn.setAttribute("aria-expanded", "true");
    reveal.setAttribute("aria-hidden", "false");

    const r = btn.getBoundingClientRect();
    const cx = r.left + r.width / 2;
    const cy = r.top + r.height / 2;
    if (typeof window.__birthdayPresentBurst === "function") {
      window.__birthdayPresentBurst(cx, cy);
    }
  });
})();
