const reducedMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches;

function clamp01(value) {
  return Math.min(Math.max(value, 0), 1);
}

function easeInOut(t) {
  return t < 0.5 ? 2 * t * t : 1 - Math.pow(-2 * t + 2, 2) / 2;
}

const CARD = { w: 408, h: 654 };
// Share of the card image that is the yellow panel, not the clear margin.
const YELLOW_FILL = 0.754;

function sizeCard(section) {
  const vw = section.clientWidth;
  const vh = section.clientHeight || window.innerHeight;
  const aspect = CARD.h / CARD.w;
  const widthLocked = vw * aspect;
  // A short or wide window keeps the card inside the viewport.
  // A narrow, tall window grows it so the yellow stays about 70% of the screen
  // and the bandhani border shrinks instead of filling the extra height.
  let height = Math.min(vh * 0.92, widthLocked);
  if (widthLocked < vh * 0.98) {
    const fraction = (YELLOW_FILL * vw * widthLocked) / (vw * vh);
    const scale = Math.max(1, Math.sqrt(0.7 / Math.max(fraction, 0.05)));
    height = widthLocked * scale;
  }
  section.style.setProperty("--yellow-h", `${Math.round(height)}px`);
}

export function initMaayra(section, sangeet) {
  if (!section) return;

  sizeCard(section);
  window.addEventListener("resize", () => sizeCard(section));

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
    const title = pinned || raw >= 0.14 ? 1 : 0;
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
