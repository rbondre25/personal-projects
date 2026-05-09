/* ───────────────────────────────────────────────────────────────
   tiny digital physics engine — for joya's birthday playground
   - gravity, drag, wall + circle-circle collisions
   - mouse / touch grab, drag, flick-throw
   - emoji + confetti rendering on canvas
   ─────────────────────────────────────────────────────────────── */
(() => {
  "use strict";

  const canvas = document.getElementById("physics");
  const ctx = canvas.getContext("2d");

  let W = 0,
    H = 0,
    DPR = 1;

  function resize() {
    /* cap DPR at 1 — the canvas is decorative, full-screen renders at
       4x cost on high-dpi displays (was the second-biggest perf hit) */
    DPR = 1;
    W = window.innerWidth;
    H = window.innerHeight;
    canvas.width = Math.floor(W * DPR);
    canvas.height = Math.floor(H * DPR);
    canvas.style.width = W + "px";
    canvas.style.height = H + "px";
    ctx.setTransform(DPR, 0, 0, DPR, 0, 0);
  }

  /* ───── particle types ───── */
  const TYPES = {
    balloon: {
      emoji: "🎈",
      size: 46,
      gravity: -0.07, // floats up
      drag: 0.992,
      bounce: 0.7,
      spin: 0.01,
      drift: 0.04, // gentle horizontal sway
    },
    heart: {
      emoji: "💖",
      size: 36,
      gravity: 0.18,
      drag: 0.995,
      bounce: 0.78,
      spin: 0.05,
    },
    star: {
      emoji: "⭐",
      size: 36,
      gravity: 0.16,
      drag: 0.995,
      bounce: 0.85,
      spin: 0.12,
    },
    gift: {
      emoji: "🎁",
      size: 40,
      gravity: 0.22,
      drag: 0.995,
      bounce: 0.55,
      spin: 0.04,
    },
    cake: {
      emoji: "🧁",
      size: 38,
      gravity: 0.18,
      drag: 0.995,
      bounce: 0.6,
      spin: 0.06,
    },
    confetti: {
      emoji: null,
      size: 10,
      gravity: 0.22,
      drag: 0.99,
      bounce: 0.45,
      spin: 0.3,
    },
  };

  // party palette — matches the soft UI
  const PALETTE = [
    "#e85d75",
    "#ff8fa3",
    "#ffc857",
    "#7ecfc0",
    "#b8a9ff",
    "#5a4fcf",
    "#fff5f0",
    "#1e1b2e",
  ];

  const particles = [];
  let activeTool = "balloon";

  function rand(min, max) {
    return min + Math.random() * (max - min);
  }

  function spawn(type, x, y, vx = 0, vy = 0) {
    const cfg = TYPES[type];
    const sizeJitter = type === "confetti" ? rand(6, 12) : cfg.size * rand(0.85, 1.1);
    const p = {
      type,
      cfg,
      x,
      y,
      vx,
      vy,
      size: sizeJitter,
      r: sizeJitter / 2,
      angle: rand(0, Math.PI * 2),
      angVel: rand(-1, 1) * cfg.spin * 4,
      color: PALETTE[Math.floor(Math.random() * PALETTE.length)],
      held: false,
    };
    particles.push(p);

    /* hard cap — keeps frame time low. lower than before (was 220) */
    const MAX = 90;
    if (particles.length > MAX) particles.splice(0, particles.length - MAX);
    return p;
  }

  /* ───── physics step ───── */
  function step() {
    for (const p of particles) {
      if (p.held) continue;

      p.vy += p.cfg.gravity;
      if (p.cfg.drift) p.vx += Math.sin(p.angle * 0.5 + p.x * 0.01) * p.cfg.drift * 0.3;

      p.vx *= p.cfg.drag;
      p.vy *= p.cfg.drag;

      p.x += p.vx;
      p.y += p.vy;
      p.angle += p.angVel;
      p.angVel *= 0.985;

      // walls
      if (p.x - p.r < 0) {
        p.x = p.r;
        p.vx = -p.vx * p.cfg.bounce;
      }
      if (p.x + p.r > W) {
        p.x = W - p.r;
        p.vx = -p.vx * p.cfg.bounce;
      }
      if (p.y + p.r > H) {
        p.y = H - p.r;
        p.vy = -p.vy * p.cfg.bounce;
        p.vx *= 0.92;
        p.angVel *= 0.92;
      }
      if (p.y - p.r < 0) {
        p.y = p.r;
        p.vy = -p.vy * p.cfg.bounce;
      }
    }

    /* pairwise circle collisions — O(n²). skip past 50 particles
       (visually nearly identical, way cheaper) */
    const n = particles.length;
    if (n <= 50) {
      for (let i = 0; i < n; i++) {
        for (let j = i + 1; j < n; j++) {
          resolve(particles[i], particles[j]);
        }
      }
    }
  }

  function resolve(a, b) {
    const dx = b.x - a.x;
    const dy = b.y - a.y;
    const distSq = dx * dx + dy * dy;
    const minDist = a.r + b.r;
    if (distSq === 0 || distSq >= minDist * minDist) return;

    const dist = Math.sqrt(distSq);
    const nx = dx / dist;
    const ny = dy / dist;
    const overlap = minDist - dist;

    if (!a.held && !b.held) {
      a.x -= nx * overlap * 0.5;
      a.y -= ny * overlap * 0.5;
      b.x += nx * overlap * 0.5;
      b.y += ny * overlap * 0.5;
    } else if (a.held) {
      b.x += nx * overlap;
      b.y += ny * overlap;
    } else {
      a.x -= nx * overlap;
      a.y -= ny * overlap;
    }

    const dvx = b.vx - a.vx;
    const dvy = b.vy - a.vy;
    const vn = dvx * nx + dvy * ny;
    if (vn > 0) return;

    const restitution = 0.82;
    const impulse = (-(1 + restitution) * vn) / 2;
    a.vx -= impulse * nx;
    a.vy -= impulse * ny;
    b.vx += impulse * nx;
    b.vy += impulse * ny;

    a.angVel += (Math.random() - 0.5) * 0.1;
    b.angVel += (Math.random() - 0.5) * 0.1;
  }

  /* ───── render ───── */
  function render() {
    ctx.clearRect(0, 0, W, H);

    for (const p of particles) {
      ctx.save();
      ctx.translate(p.x, p.y);
      ctx.rotate(p.angle);

      if (p.type === "confetti") {
        ctx.fillStyle = p.color;
        ctx.fillRect(-p.size / 2, -p.size / 3, p.size, (p.size * 2) / 3);
      } else {
        ctx.font = `${p.size}px "Apple Color Emoji", "Segoe UI Emoji", "Noto Color Emoji", serif`;
        ctx.textAlign = "center";
        ctx.textBaseline = "middle";
        ctx.fillText(p.cfg.emoji, 0, 0);
      }

      ctx.restore();
    }
  }

  /* skip frames when nothing is moving — keeps idle cpu near zero */
  function anythingMoving() {
    for (let i = 0; i < particles.length; i++) {
      const p = particles[i];
      if (p.held) return true;
      if (Math.abs(p.vx) > 0.06 || Math.abs(p.vy) > 0.06) return true;
      if (p.y + p.r < H - 1) return true; // still in mid-air
    }
    return false;
  }

  let dirty = true;
  function loop() {
    if (anythingMoving() || dirty) {
      step();
      render();
      dirty = anythingMoving();
    }
    requestAnimationFrame(loop);
  }

  document.addEventListener("visibilitychange", () => {
    if (!document.hidden) dirty = true;
  });

  /* ───── pointer interaction ───── */
  let dragging = null;
  const recent = [];

  function getPos(ev) {
    const t = ev.touches ? ev.touches[0] : ev;
    return { x: t.clientX, y: t.clientY };
  }

  function findAt(x, y) {
    for (let i = particles.length - 1; i >= 0; i--) {
      const p = particles[i];
      const dx = p.x - x;
      const dy = p.y - y;
      if (dx * dx + dy * dy < p.r * p.r * 1.6) return p;
    }
    return null;
  }

  function onDown(ev) {
    const { x, y } = getPos(ev);
    const hit = findAt(x, y);
    if (hit) {
      dragging = hit;
      hit.held = true;
      hit.vx = hit.vy = 0;
      recent.length = 0;
      recent.push({ x, y, t: performance.now() });
    } else {
      // empty space → spawn current tool
      spawn(activeTool, x, y, rand(-2, 2), rand(-2, 0));
    }
    if (ev.cancelable) ev.preventDefault();
  }

  function onMove(ev) {
    if (!dragging) return;
    const { x, y } = getPos(ev);
    dragging.x = x;
    dragging.y = y;
    recent.push({ x, y, t: performance.now() });
    if (recent.length > 8) recent.shift();
    if (ev.cancelable) ev.preventDefault();
  }

  function onUp() {
    if (!dragging) return;
    dragging.held = false;

    if (recent.length >= 2) {
      const now = performance.now();
      let oldest = recent[recent.length - 1];
      for (let i = recent.length - 1; i >= 0; i--) {
        if (now - recent[i].t > 120) break;
        oldest = recent[i];
      }
      const latest = recent[recent.length - 1];
      const dt = Math.max(8, latest.t - oldest.t);
      dragging.vx = ((latest.x - oldest.x) / dt) * 16;
      dragging.vy = ((latest.y - oldest.y) / dt) * 16;
      // clamp absurd flicks
      const max = 40;
      dragging.vx = Math.max(-max, Math.min(max, dragging.vx));
      dragging.vy = Math.max(-max, Math.min(max, dragging.vy));
    }
    dragging = null;
    recent.length = 0;
  }

  canvas.addEventListener("mousedown", onDown);
  window.addEventListener("mousemove", onMove);
  window.addEventListener("mouseup", onUp);
  canvas.addEventListener("touchstart", onDown, { passive: false });
  window.addEventListener("touchmove", onMove, { passive: false });
  window.addEventListener("touchend", onUp);

  /* ───── toolbar (vertical or horizontal — anything with [data-spawn]) ───── */
  document.querySelectorAll("[data-spawn]").forEach((btn) => {
    btn.addEventListener("click", () => {
      const type = btn.dataset.spawn;
      activeTool = type;

      document
        .querySelectorAll("[data-spawn]")
        .forEach((b) => b.classList.toggle("is-active", b === btn));

      const fromTop = type !== "balloon";
      for (let i = 0; i < 5; i++) {
        spawn(
          type,
          rand(60, W - 60),
          fromTop ? -40 - Math.random() * 200 : H + 40 + Math.random() * 100,
          rand(-3, 3),
          fromTop ? rand(0, 2) : rand(-4, -2)
        );
      }
    });
  });

  const clearBtn = document.getElementById("clearBtn");
  if (clearBtn) {
    clearBtn.addEventListener("click", () => {
      particles.length = 0;
    });
  }

  /* ───── digit candles (just two: 2 and 0) ───── */
  const candlesEl = document.getElementById("candles");
  const counterEl = document.getElementById("candlesLeft");
  const candleEls = candlesEl
    ? Array.from(candlesEl.querySelectorAll(".digit-candle"))
    : [];
  let lit = candleEls.length;
  let celebrated = false;
  if (counterEl) counterEl.textContent = lit;

  candleEls.forEach((c, i) => {
    const flame = c.querySelector(".flame");
    if (flame) flame.style.animationDelay = `${i * 0.18}s`;

    c.addEventListener("click", (e) => {
      e.stopPropagation();
      if (c.classList.contains("out")) return;
      c.classList.add("out");
      lit--;
      if (counterEl) counterEl.textContent = lit;

      const rect = c.getBoundingClientRect();
      const cx = rect.left + rect.width / 2;
      const cy = rect.top + rect.height * 0.2;
      /* small puff — was 14, now 4 */
      for (let k = 0; k < 4; k++) {
        spawn(
          "confetti",
          cx + rand(-6, 6),
          cy + rand(-4, 4),
          rand(-2, 2),
          rand(-5, -1)
        );
      }

      if (lit === 0 && !celebrated) {
        celebrated = true;
        celebrate();
      }
    });
  });

  /** Fired when the present is opened — confetti burst from box center */
  function presentBurst(x, y) {
    for (let i = 0; i < 56; i++) {
      const ang = rand(-Math.PI, -0.15);
      const sp = rand(4, 13);
      spawn(
        "confetti",
        x + rand(-18, 18),
        y + rand(-18, 18),
        Math.cos(ang) * sp,
        Math.sin(ang) * sp - 1
      );
    }
    const types = ["heart", "star", "balloon", "gift", "cake"];
    for (let i = 0; i < 18; i++) {
      const ang = rand(-Math.PI, -0.2);
      const sp = rand(3, 9);
      spawn(
        types[i % types.length],
        x + rand(-14, 14),
        y + rand(-14, 14),
        Math.cos(ang) * sp,
        Math.sin(ang) * sp - 1
      );
    }
  }
  window.__birthdayPresentBurst = presentBurst;

  function celebrate() {
    if (counterEl) counterEl.textContent = "— wish granted —";

    const cake = document.getElementById("cake");
    if (!cake) return;
    const r = cake.getBoundingClientRect();
    const cx = r.left + r.width / 2;
    const cy = r.top + r.height / 3;

    /* trimmed celebration burst — was 80 confetti + 24 emoji, now 20 + 8 */
    for (let i = 0; i < 20; i++) {
      const ang = rand(-Math.PI, 0);
      const sp = rand(4, 10);
      spawn(
        "confetti",
        cx + rand(-20, 20),
        cy + rand(-14, 14),
        Math.cos(ang) * sp,
        Math.sin(ang) * sp - 2
      );
    }

    const types = ["heart", "star", "balloon", "gift", "cake"];
    for (let i = 0; i < 8; i++) {
      const ang = rand(-Math.PI, 0);
      const sp = rand(3, 7);
      spawn(
        types[i % types.length],
        cx + rand(-20, 20),
        cy + rand(-20, 20),
        Math.cos(ang) * sp,
        Math.sin(ang) * sp - 2
      );
    }

    /* ambient balloon refill — was 10, now 3 */
    setTimeout(() => {
      for (let i = 0; i < 3; i++) {
        spawn("balloon", rand(40, W - 40), H + 40, rand(-1, 1), rand(-3, -1));
      }
    }, 500);
  }

  /* ───── starter scene — keep light ───── */
  function init() {
    resize();
    for (let i = 0; i < 3; i++) {
      spawn(
        "balloon",
        rand(80, Math.max(200, W - 80)),
        rand(H * 0.4, H - 80),
        rand(-0.5, 0.5),
        rand(-0.5, 0)
      );
    }
    requestAnimationFrame(loop);
  }

  window.addEventListener("resize", resize);
  init();
})();
