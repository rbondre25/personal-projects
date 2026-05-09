/* ─────────────────────────────────────────────────────────
   stages.js — three-stage flow: hero → cake → present

   Every press of A makes the current page physically break and
   fall to the bottom of the screen, then advances. Text shatters
   into per-character physics bodies; non-text elements (cake
   tiers, candles, plate) fall as whole units.
   ───────────────────────────────────────────────────────── */
(() => {
  "use strict";

  const STAGE_IDS = ["hero", "cake", "present"];
  const PROMPT_LABELS = {
    hero: "to make a wish",
    cake: "to open your present",
    present: "you made it ✿",
  };

  /* what falls on each stage:
       splitText: selectors whose text becomes per-character bodies
       fallWhole: selectors whose elements fall as a single body */
  const STAGE_FALL = {
    hero: {
      splitText:
        ".eyebrow, .title .bounce, .title .script-in, .title .script .name, .lede-line",
      fallWhole: "",
    },
    cake: {
      splitText: ".cake-card h2, .cake-hint, .candle-counter",
      fallWhole:
        ".digit-candle, .cake-top, .cake-frosting, .cake-mid, .cake-bot, .plate",
    },
    present: { splitText: "", fallWhole: "" },
  };

  const stageEls = STAGE_IDS.map((id) => document.getElementById(`stage-${id}`));
  const pressA = document.getElementById("pressA");
  const pressALabel = document.getElementById("pressALabel");
  const body = document.body;

  let current = 0;
  let busy = false;

  function setPrompt(stageId) {
    if (!pressA) return;
    if (stageId === "present") {
      pressA.classList.add("is-final");
      pressA.setAttribute("aria-disabled", "true");
      if (pressALabel) pressALabel.textContent = PROMPT_LABELS.present;
      return;
    }
    pressA.classList.remove("is-final");
    pressA.removeAttribute("aria-disabled");
    if (pressALabel) pressALabel.textContent = PROMPT_LABELS[stageId];
  }

  function activate(idx) {
    stageEls.forEach((el, i) => {
      const isActive = i === idx;
      el.classList.toggle("is-active", isActive);
      el.setAttribute("aria-hidden", isActive ? "false" : "true");
    });
    body.dataset.stage = STAGE_IDS[idx];
    setPrompt(STAGE_IDS[idx]);
  }

  /* split each text node under `root` into per-character spans */
  function splitText(root, sink) {
    const queue = [root];
    while (queue.length) {
      const node = queue.shift();
      const children = Array.from(node.childNodes);
      for (const child of children) {
        if (child.nodeType === Node.TEXT_NODE) {
          const text = child.textContent;
          if (!text) continue;
          const frag = document.createDocumentFragment();
          for (const ch of text) {
            if (/\s/.test(ch)) {
              frag.appendChild(document.createTextNode(ch));
            } else {
              const span = document.createElement("span");
              span.className = "fall-char";
              span.textContent = ch;
              frag.appendChild(span);
              sink.push(span);
            }
          }
          child.parentNode.replaceChild(frag, child);
        } else if (child.nodeType === Node.ELEMENT_NODE) {
          queue.push(child);
        }
      }
    }
  }

  /* universal physics drop — text + whole-element items */
  function dropStage(stageEl, config) {
    return new Promise((resolve) => {
      const containers = config.splitText
        ? Array.from(stageEl.querySelectorAll(config.splitText))
        : [];
      const wholes = config.fallWhole
        ? Array.from(stageEl.querySelectorAll(config.fallWhole))
        : [];

      if (!containers.length && !wholes.length) {
        resolve();
        return;
      }

      /* freeze in-flight CSS animations so nothing fights the inline transforms */
      containers.forEach((c) => {
        c.style.setProperty("animation", "none", "important");
        c.style.setProperty("transition", "none", "important");
        c.style.setProperty("opacity", "1", "important");
        c.style.setProperty("transform", "none", "important");
      });

      /* strip the eyebrow's pill so it doesn't sit empty as letters fall */
      const eyebrow = stageEl.querySelector(".eyebrow");
      if (eyebrow) {
        eyebrow.style.background = "transparent";
        eyebrow.style.boxShadow = "none";
      }

      /* split text containers into character spans */
      const chars = [];
      containers.forEach((c) => splitText(c, chars));

      const Wview = window.innerWidth;
      const Hview = window.innerHeight;
      const G = 0.55;
      const FLOOR = Hview - 12;
      const SETTLE_V = 0.4;

      const items = [];

      /* per-character bodies (text) */
      chars.forEach((el) => {
        const rect = el.getBoundingClientRect();
        el.style.setProperty("display", "inline-block", "important");
        el.style.setProperty("will-change", "transform", "important");
        el.style.setProperty("transform-origin", "50% 50%", "important");
        items.push({
          el,
          startLeft: rect.left,
          startTop: rect.top,
          w: rect.width || 8,
          h: rect.height || 16,
          x: 0,
          y: 0,
          vx: (Math.random() - 0.5) * 5,
          vy: -1 - Math.random() * 3,
          angle: 0,
          angVel: (Math.random() - 0.5) * 10,
          settled: false,
          restCount: 0,
          baseTransform: "",
        });
      });

      /* whole-element bodies (cake tiers, candles, plate, etc.) */
      wholes.forEach((el) => {
        const rect = el.getBoundingClientRect();
        /* preserve any existing CSS transform (e.g. translateX(-50%)) */
        const computed = window.getComputedStyle(el).transform;
        const base = computed && computed !== "none" ? computed + " " : "";
        el.style.setProperty("transition", "none", "important");
        el.style.setProperty("animation", "none", "important");
        el.style.setProperty("will-change", "transform", "important");
        el.style.setProperty("transform-origin", "50% 50%", "important");
        items.push({
          el,
          startLeft: rect.left,
          startTop: rect.top,
          w: rect.width,
          h: rect.height,
          x: 0,
          y: 0,
          vx: (Math.random() - 0.5) * 4,
          vy: -1.5 - Math.random() * 2.5,
          angle: 0,
          angVel: (Math.random() - 0.5) * 6,
          settled: false,
          restCount: 0,
          baseTransform: base,
        });
      });

      function tick() {
        let moving = 0;
        for (const it of items) {
          if (it.settled) continue;

          it.vy += G;
          it.x += it.vx;
          it.y += it.vy;
          it.angle += it.angVel;

          /* floor */
          const bottomY = it.startTop + it.y + it.h;
          if (bottomY > FLOOR) {
            it.y = FLOOR - it.startTop - it.h;
            it.vy = -it.vy * 0.3;
            it.vx *= 0.8;
            it.angVel *= 0.55;
            if (
              Math.abs(it.vy) < SETTLE_V &&
              Math.abs(it.vx) < SETTLE_V &&
              Math.abs(it.angVel) < SETTLE_V
            ) {
              it.restCount += 1;
              if (it.restCount > 3) {
                it.vy = 0;
                it.vx = 0;
                it.angVel = 0;
                it.settled = true;
                /* small natural tilt when locked */
                it.angle = (Math.random() - 0.5) * 22;
              }
            } else {
              it.restCount = 0;
            }
          }

          /* walls */
          const leftX = it.startLeft + it.x;
          if (leftX < 2) {
            it.x = 2 - it.startLeft;
            it.vx = -it.vx * 0.5;
          }
          const rightX = it.startLeft + it.x + it.w;
          if (rightX > Wview - 2) {
            it.x = Wview - 2 - it.startLeft - it.w;
            it.vx = -it.vx * 0.5;
          }

          it.el.style.setProperty(
            "transform",
            it.baseTransform +
              "translate(" +
              it.x +
              "px, " +
              it.y +
              "px) rotate(" +
              it.angle +
              "deg)",
            "important"
          );
          if (!it.settled) moving += 1;
        }

        if (moving > 0) {
          requestAnimationFrame(tick);
        } else {
          resolve();
        }
      }
      requestAnimationFrame(tick);
    });
  }

  function nextStage() {
    if (busy) return;
    if (current >= stageEls.length - 1) return;

    busy = true;
    const cur = stageEls[current];
    const curId = STAGE_IDS[current];
    const config = STAGE_FALL[curId] || { splitText: "", fallWhole: "" };

    cur.classList.add("is-falling");
    if (pressA) pressA.classList.add("is-hidden");

    dropStage(cur, config).then(() => {
      cur.classList.remove("is-falling");
      current += 1;
      activate(current);
      if (pressA) pressA.classList.remove("is-hidden");
      busy = false;
    });
  }

  document.addEventListener("keydown", (e) => {
    if (e.repeat) return;
    if (e.key === "a" || e.key === "A") {
      const tag = (e.target && e.target.tagName) || "";
      if (tag === "INPUT" || tag === "TEXTAREA") return;
      e.preventDefault();
      nextStage();
    }
  });

  if (pressA) {
    pressA.addEventListener("click", () => {
      if (pressA.classList.contains("is-final")) return;
      nextStage();
    });
  }

  activate(0);
})();
