import "./style.css";
import "./ganesha/ganesha.css";
import "./venue/venue.css";
import "./haldi/haldi.css";
import "./sangeet/sangeet.css";
import "./maayra/maayra.css";
import "./music/music.css";
import { createVineRenderer } from "./hero/vineRenderer.js";
import { createFlowers } from "./hero/flowers.js";
import { initGanesha } from "./ganesha/ganesha.js";
import { initVenue } from "./venue/venue.js";
import { initHaldi } from "./haldi/haldi.js";
import { initSangeet } from "./sangeet/sangeet.js";
import { initMaayra } from "./maayra/maayra.js";
import { initMusic } from "./music/music.js";

const TIMELINE = {
  nidhi: { mossStart: 200, mossDuration: 1700, vineStart: 1300, vineDuration: 3800 },
  rahul: { mossStart: 650, mossDuration: 1700, vineStart: 1750, vineDuration: 3800 },
  wedsStart: 1500,
  bloomLag: 150,
};

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

function clamp01(value) {
  return Math.min(Math.max(value, 0), 1);
}

function easeInOut(t) {
  return t < 0.5 ? 2 * t * t : 1 - Math.pow(-2 * t + 2, 2) / 2;
}

async function setupRow(el) {
  const name = el.dataset.row;
  const base = `/hero/${name}`;
  const manifest = await fetch(`${base}/manifest.json`).then((r) => r.json());
  el.style.aspectRatio = `${manifest.width} / ${manifest.height}`;

  const showFinal = () => {
    el.replaceChildren();
    const img = new Image();
    img.src = `${base}/final.png`;
    img.alt = "";
    el.append(img);
  };

  if (reducedMotion) {
    showFinal();
    return null;
  }

  try {
    const [moss, foliage, growth] = await Promise.all(
      ["moss", "foliage", "growth"].map((layer) => loadImage(`${base}/${layer}.png`)),
    );
    const canvas = document.createElement("canvas");
    const renderer = createVineRenderer(canvas, {
      moss,
      foliage,
      growth,
      width: manifest.width,
      height: manifest.height,
    });
    if (!renderer) {
      showFinal();
      return null;
    }
    el.append(canvas);
    renderer.draw(1, 1);

    const flowers = createFlowers(el, manifest, base);
    await flowers.ready;
    return { name, flowers, timing: TIMELINE[name] };
  } catch (error) {
    console.error(error);
    showFinal();
    return null;
  }
}

async function init() {
  const rows = await Promise.all([...document.querySelectorAll(".name-row")].map(setupRow));
  const animated = rows.filter(Boolean);

  if (animated.length === 0) {
    document.documentElement.classList.add("is-static");
    return;
  }

  const hero = document.querySelector(".hero");
  hero.classList.add("is-lettered");
  bindHeroWind(hero, (direction) => {
    for (const { flowers } of animated) flowers.gust(direction);
  });

  const play = () => {
    for (const { flowers, timing } of animated) {
      flowers.play((flower) => flower.t * timing.vineDuration + TIMELINE.bloomLag);
    }
  };

  const heroInReach = () => hero.getBoundingClientRect().top < window.innerHeight * 0.9;
  if (heroInReach()) {
    play();
    return;
  }

  const onScroll = () => {
    if (!heroInReach()) return;
    window.removeEventListener("scroll", onScroll);
    play();
  };
  window.addEventListener("scroll", onScroll, { passive: true });
}

function bindHeroWind(hero, onGust) {
  if (!hero) return;

  hero.addEventListener("click", (event) => {
    const mid = hero.getBoundingClientRect().left + hero.clientWidth * 0.5;
    onGust(event.clientX < mid ? 1 : -1);
  });
}

function bindHeroBridge(hero, venue, venueReady, ganesha, music) {
  if (reducedMotion || !hero || !venue) {
    venue?.classList.remove("is-held", "is-bridge");
    return;
  }

  venue.classList.add("is-held");

  const stage = hero.querySelector(".hero__stage");
  const veil = hero.querySelector(".hero__veil");
  const nidhi = hero.querySelector('[data-row="nidhi"]');
  const rahul = hero.querySelector('[data-row="rahul"]');
  const weds = hero.querySelector(".weds");
  const scaleGain = 0.52;
  let nidhiExit = 0;
  let rahulExit = 0;
  let locked = false;
  let settled = false;
  let frameId = 0;
  let heroHeld = false;
  let heroHoldStarted = false;

  const blockHeroHold = (event) => {
    if (!heroHeld) return;
    event.preventDefault();
    window.scrollTo(0, hero.offsetTop);
  };

  const blockHeroKeys = (event) => {
    if (!heroHeld) return;
    if (["ArrowDown", "ArrowUp", "PageDown", "PageUp", "Home", "End", " "].includes(event.key)) {
      event.preventDefault();
      window.scrollTo(0, hero.offsetTop);
    }
  };

  const startHeroHold = () => {
    if (heroHoldStarted) return;
    heroHoldStarted = true;
    if (reducedMotion) {
      heroHeld = false;
      music?.start();
      return;
    }
    heroHeld = true;
    hero.classList.add("is-holding");
    hero.classList.remove("is-scroll-ready");
    document.documentElement.classList.add("is-hero-held");
    music?.start();
    window.scrollTo(0, hero.offsetTop);
    window.setTimeout(() => {
      heroHeld = false;
      hero.classList.remove("is-holding");
      hero.classList.add("is-scroll-ready");
      document.documentElement.classList.remove("is-hero-held");
    }, 2600);
  };

  const restingRect = (el) => {
    const transform = el.style.transform;
    if (transform) el.style.transform = "none";
    const rect = el.getBoundingClientRect();
    if (transform) el.style.transform = transform;
    return rect;
  };

  const measureExits = () => {
    const scale = 1 + scaleGain;
    const margin = 28;
    const stageRect = stage.getBoundingClientRect();
    const n = restingRect(nidhi);
    const r = restingRect(rahul);
    if (n.height < 8 || r.height < 8) return;
    const nCenter = n.top - stageRect.top + n.height / 2;
    const rCenter = r.top - stageRect.top + r.height / 2;
    const view = stage.clientHeight || window.innerHeight;
    nidhiExit = nCenter + (n.height * scale) / 2 + margin;
    rahulExit = view + margin - (rCenter - (r.height * scale) / 2);
  };

  const apply = (progress) => {
    const revealed = venue.classList.contains("is-revealed");

    if (progress <= 0.001) {
      veil.style.opacity = "";
      venue.style.setProperty("--foil", "0");
      venue.style.setProperty("--scene", revealed ? "0" : "1");
      weds.style.opacity = "";
      weds.style.filter = "";
      nidhi.style.transform = "";
      rahul.style.transform = "";
      nidhi.style.opacity = "";
      rahul.style.opacity = "";
      return;
    }

    const move = clamp01((progress - 0.05) / 0.95);
    const foil = revealed ? 0 : easeInOut(clamp01((progress - 0.48) / 0.36));
    const scene = revealed ? easeInOut(move) : 1;
    const wedsOpacity = 1 - easeInOut(clamp01((progress - 0.08) / 0.18));
    const scale = 1 + move * scaleGain;
    const nidhiApart = move * (nidhiExit || window.innerHeight * 0.72);
    const rahulApart = move * (rahulExit || window.innerHeight * 0.72);

    veil.style.opacity = String(1 - (revealed ? scene : foil));
    venue.style.setProperty("--foil", foil.toFixed(3));
    venue.style.setProperty("--scene", scene.toFixed(3));
    weds.style.opacity = String(wedsOpacity);
    nidhi.style.opacity = "";
    rahul.style.opacity = "";
    nidhi.style.transform = `translate3d(0, ${-nidhiApart}px, 0) scale(${scale})`;
    rahul.style.transform = `translate3d(0, ${rahulApart}px, 0) scale(${scale})`;
  };

  const fullyOffscreen = () => {
    const n = nidhi.getBoundingClientRect();
    const r = rahul.getBoundingClientRect();
    const nInkBottom = n.top + n.height * 0.95;
    const rInkTop = r.top + r.height * 0.05;
    return nInkBottom <= 0 && rInkTop >= window.innerHeight;
  };

  const update = () => {
    if (!nidhiExit) measureExits();

    const ganeshaGone = !ganesha || ganesha.getBoundingClientRect().bottom <= 1;
    const venueTop = venue.getBoundingClientRect().top;
    const atVenue = venueTop < 8;
    if (ganeshaGone) startHeroHold();

    if (heroHeld) {
      window.scrollTo(0, hero.offsetTop);
      hero.classList.toggle("is-short", true);
      hero.classList.toggle("is-pinned", true);
      apply(0);
      venue.classList.toggle("is-held", false);
      venue.classList.toggle("is-bridge", true);
      return;
    }

    hero.classList.toggle("is-short", ganeshaGone);
    hero.classList.toggle("is-pinned", ganeshaGone && venueTop > 0);

    const distance = Math.max(hero.offsetHeight - stage.offsetHeight, 1);
    let progress = ganeshaGone ? clamp01((window.scrollY - hero.offsetTop) / distance) : 0;
    apply(progress);

    const revealed = venue.classList.contains("is-revealed");
    const foil = revealed ? 1 : easeInOut(clamp01((progress - 0.48) / 0.36));
    const out = ganeshaGone && (fullyOffscreen() || progress > 0.92);
    if (out && (revealed || foil > 0.96) && !atVenue && !settled) {
      settled = true;
      window.scrollTo(0, venue.offsetTop);
      venue.style.setProperty("--foil", "1");
      if (revealed) venue.style.setProperty("--scene", "1");
    }
    if (!out) settled = false;

    if (atVenue) {
      venue.style.setProperty("--foil", "1");
      if (revealed) venue.style.setProperty("--scene", "1");
    }

    locked = out || atVenue;
    hero.classList.toggle("is-complete", atVenue);
    hero.classList.toggle("is-open", locked && !revealed);
    if (progress > 0.04) hero.classList.remove("is-scroll-ready");
    venue.classList.toggle("is-held", !ganeshaGone);
    venue.classList.toggle("is-bridge", ganeshaGone && !atVenue);
  };

  const requestUpdate = () => {
    if (frameId) return;
    frameId = requestAnimationFrame(() => {
      frameId = 0;
      update();
    });
  };

  venueReady.then(() => requestUpdate());
  new MutationObserver(requestUpdate).observe(venue, {
    attributes: true,
    attributeFilter: ["class"],
  });

  measureExits();
  new ResizeObserver(() => {
    measureExits();
    requestUpdate();
  }).observe(hero.querySelector(".hero__title"));

  update();
  window.addEventListener("scroll", requestUpdate, { passive: true });
  window.addEventListener("resize", requestUpdate);
  window.addEventListener("wheel", blockHeroHold, { passive: false });
  window.addEventListener("touchmove", blockHeroHold, { passive: false });
  window.addEventListener("keydown", blockHeroKeys);
}

if ("scrollRestoration" in history) history.scrollRestoration = "manual";
window.scrollTo(0, 0);

const ganeshaEl = document.querySelector(".ganesha");
const venueEl = document.querySelector(".venue");
const music = initMusic(
  ganeshaEl,
  document.querySelector(".music"),
  document.querySelector(".music__track--ganesha"),
  document.querySelector(".music__track--hero"),
);
initGanesha(ganeshaEl, music);
const venueReady = initVenue(venueEl);
bindHeroBridge(document.querySelector(".hero"), venueEl, venueReady, ganeshaEl, music);
init();
initHaldi(document.querySelector(".haldi"));
initSangeet(document.querySelector(".sangeet"));
initMaayra(document.querySelector(".maayra"), document.querySelector(".sangeet"));
