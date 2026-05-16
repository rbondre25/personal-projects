(() => {
  "use strict";

  const wrap = document.getElementById("presentStage");
  const display = document.getElementById("presentDisplay");
  const reveal = document.getElementById("presentReveal");
  if (!wrap || !display || !reveal) return;

  window.openBirthdayPresent = function openBirthdayPresent() {
    if (wrap.classList.contains("is-open")) return false;

    wrap.classList.add("is-open");
    reveal.setAttribute("aria-hidden", "false");

    const r = display.getBoundingClientRect();
    const cx = r.left + r.width / 2;
    const cy = r.top + r.height / 2;
    if (typeof window.__birthdayPresentBurst === "function") {
      window.__birthdayPresentBurst(cx, cy);
    }

    return true;
  };
})();
