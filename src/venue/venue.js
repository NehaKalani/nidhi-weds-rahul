const BASE = "/venue";
const GLOW_PASSES = 1;
const CLEAR_AT = 0.14;
const BRUSH = 64;
const REVEAL_STROKES = 5;
const MOVE = {
  krishna: { x: -340, y: 16 },
  radhaSide: { x: 330, y: 20 },
};

function clamp01(value) {
  return Math.min(Math.max(value, 0), 1);
}

function easeOutCubic(t) {
  return 1 - Math.pow(1 - t, 3);
}

const reducedMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches;

function loadImage(src) {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.decoding = "async";
    img.onload = () => resolve(img);
    img.onerror = () => reject(new Error(`Failed to load ${src}`));
    img.src = src;
  });
}

function place(el, box) {
  el.style.left = `${box.x}px`;
  el.style.top = `${box.y}px`;
  el.style.width = `${box.w}px`;
  el.style.height = `${box.h}px`;
}

function frameArt(frame, art, layout) {
  const scale = Math.max(frame.clientWidth / layout.width, frame.clientHeight / layout.height);
  const x = (frame.clientWidth - layout.width * scale) / 2;
  const y = (frame.clientHeight - layout.height * scale) / 2;
  art.style.transform = `translate(${x}px, ${y}px) scale(${scale})`;
}

function drawGlowAt(ctx, mask, t) {
  const { width: w, height: h } = ctx.canvas;
  ctx.clearRect(0, 0, w, h);
  if (t <= 0.001 || t >= 0.999) return;

  const cycle = (t * GLOW_PASSES) % 1;
  ctx.globalCompositeOperation = "source-over";
  const y = -0.25 * h + cycle * 1.55 * h;
  const glow = ctx.createRadialGradient(w * 0.5, y, 2, w * 0.5, y, h * 0.55);
  glow.addColorStop(0, "rgba(255, 248, 220, 1)");
  glow.addColorStop(0.22, "rgba(255, 210, 160, 0.95)");
  glow.addColorStop(0.5, "rgba(255, 168, 176, 0.55)");
  glow.addColorStop(1, "rgba(255, 200, 140, 0)");
  ctx.fillStyle = glow;
  ctx.fillRect(0, 0, w, h);
  ctx.globalCompositeOperation = "destination-in";
  ctx.drawImage(mask, 0, 0, w, h);
}

const CONFETTI_COLORS = ["#f3d59a", "#f4b8c5", "#fff6e4", "#c9a04a", "#e07a8a", "#9c2233", "#ffe7c2", "#d4a0c8", "#f6c56b"];
const CONFETTI_KINDS = ["ribbon", "dot", "petal", "diamond", "star"];

function burstConfetti(section) {
  if (section.querySelector(".venue__confetti")) return;
  const root = document.createElement("div");
  root.className = "venue__confetti";
  for (let i = 0; i < 180; i += 1) {
    const bit = document.createElement("i");
    const fromCenter = i % 5 !== 0;
    bit.className = `is-${CONFETTI_KINDS[i % CONFETTI_KINDS.length]}`;
    bit.style.setProperty("--left", fromCenter ? `${28 + Math.random() * 44}%` : `${2 + Math.random() * 96}%`);
    bit.style.setProperty("--top", fromCenter ? `${38 + Math.random() * 18}%` : `${-8 - Math.random() * 12}%`);
    bit.style.setProperty("--dx", `${(Math.random() - 0.5) * (fromCenter ? 420 : 180)}px`);
    bit.style.setProperty("--dy", `${fromCenter ? 70 + Math.random() * 90 : 110 + Math.random() * 30}vh`);
    bit.style.setProperty("--rot", `${Math.random() * 980 - 490}deg`);
    bit.style.setProperty("--delay", `${Math.random() * 0.45}s`);
    bit.style.setProperty("--dur", `${2.2 + Math.random() * 2.2}s`);
    bit.style.setProperty("--c", CONFETTI_COLORS[i % CONFETTI_COLORS.length]);
    bit.style.setProperty("--w", `${7 + Math.random() * 11}px`);
    bit.style.setProperty("--h", `${9 + Math.random() * 16}px`);
    root.append(bit);
  }
  section.append(root);
  window.setTimeout(() => root.remove(), 5200);
}

function windowProgress(progress, start, end) {
  return clamp01((progress - start) / (end - start));
}

function artPoint(event, art, layout) {
  const rect = art.getBoundingClientRect();
  return {
    x: ((event.clientX - rect.left) / rect.width) * layout.width,
    y: ((event.clientY - rect.top) / rect.height) * layout.height,
  };
}

function stamp(ctx, x, y, last) {
  ctx.save();
  ctx.globalCompositeOperation = "destination-out";
  ctx.lineCap = "round";
  ctx.lineJoin = "round";
  ctx.strokeStyle = "#000";
  ctx.fillStyle = "#000";
  ctx.lineWidth = BRUSH * 1.8;
  ctx.globalAlpha = 0.95;
  if (last) {
    ctx.beginPath();
    ctx.moveTo(last.x, last.y);
    ctx.lineTo(x, y);
    ctx.stroke();
  }
  ctx.beginPath();
  ctx.arc(x, y, BRUSH, 0, Math.PI * 2);
  ctx.fill();
  ctx.restore();
}

function clearedShare(ctx, w, h) {
  const sample = document.createElement("canvas");
  const sw = 80;
  const sh = Math.round((h / w) * sw);
  sample.width = sw;
  sample.height = sh;
  const sctx = sample.getContext("2d", { willReadFrequently: true });
  sctx.drawImage(ctx.canvas, 0, 0, sw, sh);
  const { data } = sctx.getImageData(0, 0, sw, sh);
  let gone = 0;
  for (let i = 3; i < data.length; i += 4) {
    if (data[i] < 80) gone += 1;
  }
  return gone / (sw * sh);
}

export async function initVenue(section) {
  if (!section) return { arrive() {}, leave() {}, setProgress() {} };

  const stage = section.querySelector(".venue__stage") || section;
  const art = section.querySelector(".venue__art");
  const scratch = section.querySelector(".venue__scratch");
  const glowCanvas = section.querySelector(".venue__glow");
  const hint = section.querySelector(".venue__hint");
  const movers = {
    krishna: section.querySelector(".venue__krishna"),
    radhaSide: section.querySelector(".venue__radha-side"),
  };

  if (!reducedMotion) {
    frameArt(stage, art, { width: 941, height: 1672 });
  }

  const WEDDING = new Date("2027-01-30T00:00:00+05:30");

  function countdownParts(from, to) {
    if (to <= from) return { months: 0, days: 0, hours: 0, secs: 0 };
    let months = (to.getFullYear() - from.getFullYear()) * 12 + (to.getMonth() - from.getMonth());
    const afterMonths = new Date(from);
    afterMonths.setMonth(afterMonths.getMonth() + months);
    if (afterMonths > to) {
      months -= 1;
      afterMonths.setTime(from.getTime());
      afterMonths.setMonth(afterMonths.getMonth() + months);
    }
    const rem = Math.max(0, to.getTime() - afterMonths.getTime());
    return {
      months: Math.max(0, months),
      days: Math.floor(rem / 86400000),
      hours: Math.floor((rem % 86400000) / 3600000),
      secs: Math.floor((rem % 60000) / 1000),
    };
  }

  function tickCountdown() {
    const parts = countdownParts(new Date(), WEDDING);
    const labels = {
      months: parts.months === 1 ? "month" : "months",
      days: parts.days === 1 ? "day" : "days",
      hours: parts.hours === 1 ? "hr" : "hrs",
      secs: "sec",
    };
    for (const [unit, value] of Object.entries(parts)) {
      const el = section.querySelector(`[data-unit="${unit}"]`);
      if (el) el.textContent = unit === "months" || unit === "days" ? String(value) : String(value).padStart(2, "0");
      const label = section.querySelector(`[data-label="${unit}"]`);
      if (label) label.textContent = labels[unit];
    }
  }

  const [layout, gold, lotusGlow] = await Promise.all([
    fetch(`${BASE}/layout.json`).then((r) => r.json()),
    loadImage(`${BASE}/gold.webp`),
    loadImage(`${BASE}/lotus-glow.webp`),
  ]);

  const boxes = layout.pieces;
  place(movers.krishna, boxes.krishna);
  place(section.querySelector(".venue__radha"), boxes.radha);
  place(glowCanvas, layout.glow);

  const ctx = scratch.getContext("2d", { alpha: true, willReadFrequently: true });
  scratch.width = layout.width;
  scratch.height = layout.height;
  glowCanvas.width = layout.glow.w;
  glowCanvas.height = layout.glow.h;
  ctx.drawImage(gold, 0, 0, layout.width, layout.height);
  section.classList.add("is-ready");
  tickCountdown();
  window.setInterval(tickCountdown, 1000);

  const frame = () => frameArt(stage, art, layout);
  new ResizeObserver(frame).observe(stage);
  frame();

  let revealed = false;
  let scratchReady = false;
  let mayLeave = false;
  let pinY = 0;
  let settleTimer = 0;
  let shaking = false;
  let glowOnce = 0;
  let lastTouchY = 0;

  const holdToPin = () => {
    if (mayLeave) return;
    if (scratchReady && !revealed) {
      if (window.scrollY > pinY + 1) window.scrollTo(0, pinY);
      return;
    }
    if (!revealed) return;
    if (Math.abs(window.scrollY - pinY) > 1) window.scrollTo(0, pinY);
  };

  const waitForRest = () => {
    if (mayLeave) return;
    window.clearTimeout(settleTimer);
    settleTimer = window.setTimeout(() => {
      mayLeave = true;
    }, 450);
  };

  const shakeScratch = () => {
    if (revealed || reducedMotion) return;
    if (shaking) return;
    shaking = true;
    section.classList.remove("is-shaking");
    void section.offsetWidth;
    section.classList.add("is-shaking");
    window.setTimeout(() => {
      section.classList.remove("is-shaking");
      shaking = false;
    }, 500);
  };

  const blockUntilScratch = () => scratchReady && !revealed;

  const finishReveal = () => {
    if (revealed) return;
    revealed = true;
    scratch.style.pointerEvents = "none";
    hint?.classList.remove("is-on");
    ctx.clearRect(0, 0, layout.width, layout.height);
    pinY = section.offsetTop;
    section.classList.add("is-revealed");
    pinY = section.offsetTop;
    window.scrollTo(0, pinY);
    lastProgress = -1;
    setProgress(1);
    mayLeave = false;
    waitForRest();
    burstConfetti(section);
    for (const el of Object.values(movers)) {
      el.animate([{ opacity: 1 }, { opacity: 0 }], { duration: 700, easing: "ease", fill: "forwards" });
    }
  };

  const enableScratch = () => {
    section.classList.add("is-scratchable");
    hint?.classList.add("is-on");
    scratch.style.pointerEvents = "auto";
    let drawing = false;
    let last = null;
    let checks = 0;
    let strokes = 0;
    let strokeMoved = false;

    const point = (event) => artPoint(event, art, layout);
    const maybeFinish = () => {
      if (strokes >= REVEAL_STROKES || clearedShare(ctx, layout.width, layout.height) >= CLEAR_AT) {
        finishReveal();
      }
    };

    const down = (event) => {
      if (event.button != null && event.button !== 0) return;
      drawing = true;
      strokeMoved = false;
      scratch.setPointerCapture?.(event.pointerId);
      hint?.classList.remove("is-on");
      last = point(event);
      stamp(ctx, last.x, last.y, null);
      event.preventDefault();
    };

    const move = (event) => {
      if (!drawing) return;
      const next = point(event);
      if (last && (Math.abs(next.x - last.x) > 6 || Math.abs(next.y - last.y) > 6)) strokeMoved = true;
      stamp(ctx, next.x, next.y, last);
      last = next;
      checks += 1;
      if (checks % 6 === 0) maybeFinish();
      event.preventDefault();
    };

    const up = (event) => {
      if (drawing && strokeMoved) strokes += 1;
      drawing = false;
      last = null;
      maybeFinish();
      event.preventDefault();
    };

    scratch.addEventListener("pointerdown", down);
    scratch.addEventListener("pointermove", move);
    scratch.addEventListener("pointerup", up);
    scratch.addEventListener("pointercancel", up);
  };

  if (reducedMotion) {
    section.classList.add("is-static", "is-revealed");
    ctx.clearRect(0, 0, layout.width, layout.height);
    return { arrive() {}, leave() {}, setProgress() {} };
  }

  const glowCtx = glowCanvas.getContext("2d");
  let lastProgress = -1;
  let ritualFrame = 0;

  const ritualProgress = () => {
    if (revealed) return 1;
    const range = section.offsetHeight - window.innerHeight;
    if (range <= 0) return section.getBoundingClientRect().top < 8 ? 1 : 0;
    return clamp01((window.scrollY - section.offsetTop) / range);
  };

  const setProgress = (progress) => {
    const p = clamp01(progress);
    if (Math.abs(p - lastProgress) < 0.001) return;
    lastProgress = p;

    const glow = Math.max(glowOnce, windowProgress(p, 0.1, 0.32));
    glowOnce = glow;
    const part = easeOutCubic(windowProgress(p, 0.38, 0.58));

    for (const [name, el] of Object.entries(movers)) {
      if (!el) continue;
      const to = MOVE[name];
      el.style.opacity = "1";
      el.style.transform = to ? `translate(${to.x * part}px, ${to.y * part}px)` : "";
    }
    section.classList.toggle("is-glowing", glow > 0 && glow < 1);
    drawGlowAt(glowCtx, lotusGlow, glow);

    const parted = part >= 0.82;
    if (parted && !scratchReady) {
      scratchReady = true;
      pinY = window.scrollY;
      enableScratch();
    }
    hint?.classList.toggle("is-on", parted && !revealed);
  };

  const requestRitual = () => {
    if (ritualFrame) return;
    ritualFrame = requestAnimationFrame(() => {
      ritualFrame = 0;
      setProgress(ritualProgress());
    });
  };

  setProgress(ritualProgress());
  window.addEventListener(
    "scroll",
    () => {
      holdToPin();
      requestRitual();
    },
    { passive: true },
  );
  window.addEventListener("resize", requestRitual);

  const isScrollPast = (event) => {
    if (event.type === "wheel") return event.deltaY > 0;
    if (event.type === "touchmove") {
      const y = event.touches?.[0]?.clientY ?? lastTouchY;
      const past = lastTouchY && y < lastTouchY - 2;
      lastTouchY = y;
      return past;
    }
    return ["ArrowDown", "PageDown", "End", " "].includes(event.key);
  };

  const blockVenueScroll = (event) => {
    if (blockUntilScratch()) {
      if (!isScrollPast(event)) return;
      event.preventDefault();
      window.scrollTo(0, pinY);
      shakeScratch();
      return;
    }
    if (!revealed || mayLeave) return;
    event.preventDefault();
    window.scrollTo(0, pinY);
    waitForRest();
  };

  const blockVenueKeys = (event) => {
    if (!["ArrowDown", "ArrowUp", "PageDown", "PageUp", "Home", "End", " "].includes(event.key)) return;
    if (blockUntilScratch()) {
      if (!isScrollPast(event)) return;
      event.preventDefault();
      window.scrollTo(0, pinY);
      shakeScratch();
      return;
    }
    if (!revealed || mayLeave) return;
    event.preventDefault();
    window.scrollTo(0, pinY);
    waitForRest();
  };

  window.addEventListener("touchstart", (event) => {
    lastTouchY = event.touches?.[0]?.clientY ?? 0;
  }, { passive: true });
  window.addEventListener("wheel", blockVenueScroll, { passive: false });
  window.addEventListener("touchmove", blockVenueScroll, { passive: false });
  window.addEventListener("keydown", blockVenueKeys);

  return {
    setProgress,
    arrive() {
      setProgress(1);
    },
    leave() {
      setProgress(0);
    },
  };
}
