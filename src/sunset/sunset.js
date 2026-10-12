const ART = { w: 941, h: 1672 };
const UNROLL_MS = 2600;

const reducedMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches;

function clamp01(value) {
  return Math.min(Math.max(value, 0), 1);
}

export function initSunset(section) {
  if (!section) return;
  const stage = section.querySelector(".sunset__stage");
  const art = section.querySelector(".sunset__art");

  const layout = () => {
    const w = stage.clientWidth;
    const h = stage.clientHeight;
    const cover = Math.max(w / ART.w, h / ART.h);
    const contain = Math.min(w / ART.w, h / ART.h);
    // Phones fill the screen. A short wide window keeps the whole courtyard in view.
    const scale = h / w < 1.15 ? contain : cover;
    const x = (w - ART.w * scale) / 2;
    const y = (h - ART.h * scale) / 2;
    art.style.transform = `translate(${x}px, ${y}px) scale(${scale})`;
  };

  layout();
  new ResizeObserver(layout).observe(stage);

  if (reducedMotion) {
    section.style.setProperty("--golden", "1");
    section.style.setProperty("--unroll", "1");
    section.style.setProperty("--night", "0");
    return;
  }

  let unrollStart = null;
  let frame = 0;
  let running = false;

  const apply = (now) => {
    const top = section.getBoundingClientRect().top;
    const golden = clamp01(1 - top / window.innerHeight);
    const nightRange = Math.max(section.offsetHeight - stage.offsetHeight, 1);
    const night = clamp01(-top / nightRange);

    if (golden >= 0.98) {
      if (unrollStart === null) unrollStart = now;
    } else if (golden < 0.45) {
      unrollStart = null;
    }

    let unroll = 0;
    if (unrollStart !== null) {
      const t = clamp01((now - unrollStart) / UNROLL_MS);
      unroll = 1 - Math.pow(1 - t, 3);
    }

    section.style.setProperty("--golden", golden.toFixed(4));
    section.style.setProperty("--unroll", unroll.toFixed(4));
    section.style.setProperty("--night", night.toFixed(4));
  };

  const loop = (now) => {
    apply(now);
    const top = section.getBoundingClientRect().top;
    const near = top < window.innerHeight && top > -section.offsetHeight;
    const unroll = parseFloat(getComputedStyle(section).getPropertyValue("--unroll")) || 0;
    if (near && (unroll < 0.999 || parseFloat(section.style.getPropertyValue("--night")) > 0.01)) {
      frame = requestAnimationFrame(loop);
    } else {
      running = false;
      frame = 0;
    }
  };

  const request = () => {
    if (running) return;
    running = true;
    frame = requestAnimationFrame(loop);
  };

  apply(performance.now());
  window.addEventListener("scroll", request, { passive: true });
  window.addEventListener("resize", request);
}
