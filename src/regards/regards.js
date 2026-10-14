import { onScrollFrame } from "../lib/scroll.js";

const reducedMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
const RETURN_MS = 1100;

function clamp01(value) {
  return Math.min(Math.max(value, 0), 1);
}

export function initRegards(section) {
  if (!section || reducedMotion) return;
  const pin = section.querySelector(".regards__pin");
  const current = section.querySelector(".regards__sheet:not(.regards__sheet--next)");
  const next = section.querySelector(".regards__sheet--next");
  if (!pin || !current || !next) return;

  let shown = false;
  let timer = 0;
  let lastY = null;
  let up = 0;
  let down = 0;
  let releaseAt = 0;
  let floorY = 0;

  const showNext = () => {
    shown = true;
    up = 0;
    section.classList.add("is-next");
    window.clearTimeout(timer);
    current.setAttribute("aria-hidden", "true");
    timer = window.setTimeout(() => next.removeAttribute("aria-hidden"), 520);
  };

  const showPrevious = (travel, top, extra) => {
    shown = false;
    down = 0;
    section.classList.remove("is-next");
    window.clearTimeout(timer);
    next.setAttribute("aria-hidden", "true");
    timer = window.setTimeout(() => current.removeAttribute("aria-hidden"), 520);
    // Stay pinned until the previous names have faded back in.
    releaseAt = performance.now() + RETURN_MS;
    floorY = top + extra * Math.min(travel, 0.48);
  };

  const apply = () => {
    const extra = Math.max(section.offsetHeight - pin.offsetHeight, 1);
    const top = section.offsetTop;
    const y = window.scrollY;
    const travel = clamp01(-(top - y) / extra);
    const delta = lastY === null ? 0 : y - lastY;
    const holding = performance.now() < releaseAt;

    if (holding && y < floorY) {
      window.scrollTo(0, floorY);
    } else if (Math.abs(delta) < 0.5) {
      up = 0;
      down = 0;
    } else if (delta > 0) {
      down += delta;
      up = 0;
      if (!holding && !shown && down > 16 && travel > 0.12) showNext();
    } else if (shown) {
      up += -delta;
      down = 0;
      if (up > 16) {
        showPrevious(travel, top, extra);
        if (window.scrollY < floorY) window.scrollTo(0, floorY);
      }
    }

    lastY = window.scrollY;
  };

  new ResizeObserver(apply).observe(section);
  onScrollFrame(apply);
}
