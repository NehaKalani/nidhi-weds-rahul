const reducedMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches;

function clamp01(value) {
  return Math.min(Math.max(value, 0), 1);
}

function easeInOut(t) {
  return t < 0.5 ? 2 * t * t : 1 - Math.pow(-2 * t + 2, 2) / 2;
}

export function initMaayra(section, sangeet) {
  if (!section) return;

  if (reducedMotion || !sangeet) {
    section.classList.add("is-revealed");
    section.style.setProperty("--roll", "1");
    section.style.setProperty("--title", "1");
    return;
  }

  let frameId = 0;
  let settled = false;

  const apply = () => {
    const top = sangeet.getBoundingClientRect().top;
    const stage = sangeet.querySelector(".sangeet__stage") || sangeet;
    const rollSpan = Math.max(sangeet.offsetHeight - stage.offsetHeight, window.innerHeight * 0.9);
    const raw = top >= 0 ? 0 : clamp01(-top / rollSpan);
    const pinned = section.getBoundingClientRect().top <= 2;
    const roll = pinned ? 1 : easeInOut(raw);
    const title = pinned ? 1 : easeInOut(clamp01((raw - 0.62) / 0.32));
    const down = roll >= 0.985;
    const covering = (raw > 0.004 || down) && !pinned;

    if (down && !pinned && !settled) {
      settled = true;
      window.scrollTo(0, section.offsetTop);
    }
    if (raw < 0.8) settled = false;

    section.style.setProperty("--roll", (covering && !pinned ? roll : pinned ? 1 : roll).toFixed(4));
    section.style.setProperty("--title", title.toFixed(4));
    section.classList.toggle("is-rolling", covering && !down);
    section.classList.toggle("is-draped", covering && down);
    section.classList.toggle("is-revealed", title > 0.04 || pinned || down);
  };

  const request = () => {
    if (frameId) return;
    frameId = requestAnimationFrame(() => {
      frameId = 0;
      apply();
    });
  };

  apply();
  window.addEventListener("scroll", request, { passive: true });
  window.addEventListener("resize", request);
}
