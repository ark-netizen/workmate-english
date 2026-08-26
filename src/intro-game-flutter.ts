const PAGE_SELECTOR = ".intro-page.intro-game";
const START_SELECTOR = ".intro-game .intro-features-section";
const END_SELECTOR = ".intro-game .intro-trial-showcase";

type DecorType = "chat" | "mail" | "document" | "chart" | "leaf" | "cloud" | "spark" | "grid" | "pixel";
type DecorSpec = readonly [DecorType, number, number, number, number, number, number];

/*
 * One continuous decorative field from Work Process through the 1-minute trial.
 * There are no separate left/right rails and no separate section-specific patterns.
 * X/Y anchors deliberately wander across the whole canvas so the background feels scattered,
 * while clouds remain static and every other motif gets bubble-like JS motion.
 */
const FIELD_DECOR: readonly DecorSpec[] = [
  ["cloud", 5, 2, 1.0, 0, 0, 0],
  ["document", 86, 4, 0.82, 32, 24, 1.2],
  ["spark", 18, 6, 0.62, 27, 22, 0.4],
  ["chat", 94, 9, 0.9, 40, 31, 2.0],

  ["mail", 10, 13, 0.8, 34, 27, 1.5],
  ["pixel", 79, 14, 0.76, 30, 24, 3.1],
  ["leaf", 24, 18, 0.72, 33, 27, 2.4],
  ["chart", 91, 20, 0.86, 38, 30, 4.0],

  ["chat", 7, 24, 0.92, 41, 32, 0.8],
  ["grid", 84, 26, 0.74, 29, 24, 3.8],
  ["document", 20, 29, 0.78, 35, 28, 5.2],
  ["spark", 95, 31, 0.62, 28, 22, 1.1],

  ["pixel", 12, 35, 0.74, 31, 24, 2.7],
  ["mail", 88, 36, 0.8, 34, 27, 4.6],
  ["leaf", 28, 39, 0.7, 33, 27, 5.5],
  ["chat", 78, 41, 0.88, 40, 32, 1.9],

  ["chart", 6, 45, 0.84, 38, 30, 4.4],
  ["spark", 83, 47, 0.6, 28, 22, 0.3],
  ["document", 17, 50, 0.78, 35, 28, 3.4],
  ["pixel", 93, 52, 0.72, 31, 24, 2.1],

  ["mail", 9, 56, 0.8, 34, 27, 0.9],
  ["leaf", 81, 58, 0.72, 33, 27, 5.0],
  ["grid", 25, 61, 0.7, 29, 24, 2.8],
  ["chat", 91, 63, 0.9, 40, 32, 3.6],

  ["pixel", 5, 67, 0.72, 31, 24, 4.8],
  ["chart", 85, 69, 0.84, 38, 30, 1.4],
  ["spark", 21, 72, 0.6, 28, 22, 5.6],
  ["document", 96, 74, 0.78, 35, 28, 2.5],

  ["cloud", 8, 77, 0.88, 0, 0, 0],
  ["mail", 77, 79, 0.78, 34, 27, 4.2],
  ["leaf", 18, 82, 0.7, 33, 27, 1.7],
  ["chat", 92, 84, 0.88, 40, 32, 0.6],

  ["grid", 6, 87, 0.7, 29, 24, 3.0],
  ["document", 84, 89, 0.76, 35, 28, 5.4],
  ["pixel", 26, 92, 0.7, 31, 24, 1.0],
  ["chart", 95, 94, 0.82, 38, 30, 4.7],

  ["spark", 12, 96, 0.58, 28, 22, 2.2],
  ["mail", 80, 97, 0.74, 34, 27, 0.2],
  ["cloud", 94, 99, 0.88, 0, 0, 0],
];

let page: HTMLElement | null = null;
let startSection: HTMLElement | null = null;
let endSection: HTMLElement | null = null;
let layer: HTMLDivElement | null = null;
let syncFrame = 0;
let motionFrame = 0;
let visible = false;
let visibilityObserver: IntersectionObserver | null = null;
let resizeObserver: ResizeObserver | null = null;

function iconMarkup(type: DecorType) {
  const common = 'viewBox="0 0 48 48" aria-hidden="true" focusable="false"';

  if (type === "chat") return `<svg ${common}><path d="M7 9h34v23H21l-8 7v-7H7z"/><path d="M15 20h3m6 0h3m6 0h3"/></svg>`;
  if (type === "mail") return `<svg ${common}><path d="M6 11h36v27H6z"/><path d="m7 13 17 14 17-14M7 36l12-11m22 11L29 25"/></svg>`;
  if (type === "document") return `<svg ${common}><path d="M12 5h18l8 8v30H12z"/><path d="M30 5v9h8M18 22h14M18 28h14M18 34h10"/></svg>`;
  if (type === "chart") return `<svg ${common}><path d="M8 40h33M11 37V23h7v14m5 0V16h7v21m5 0V8h7v29"/><path d="m12 17 10-7 8 4 10-9"/></svg>`;
  if (type === "leaf") return `<svg ${common}><path d="M38 8C25 8 13 15 10 29c9 4 22 0 28-21Z"/><path d="M11 35c6-8 12-13 23-21"/></svg>`;
  if (type === "cloud") return `<svg ${common}><path d="M5 34h38v-6h-6v-7h-7v-6H18v6h-6v7H5z"/></svg>`;
  if (type === "grid") return `<svg ${common}><path d="M8 8h4v4H8zm10 0h4v4h-4zm10 0h4v4h-4zM8 18h4v4H8zm10 0h4v4h-4zm10 0h4v4h-4zM8 28h4v4H8zm10 0h4v4h-4zm10 0h4v4h-4z"/></svg>`;
  if (type === "pixel") return `<svg ${common}><path d="M16 16h16v16H16z"/></svg>`;
  return `<svg ${common}><path d="M24 6v12M24 30v12M6 24h12M30 24h12"/></svg>`;
}

function createDecor([type, left, top, scale, ampX, ampY, phase]: DecorSpec) {
  const el = document.createElement("span");
  el.className = `intro-game-process-decor is-${type}`;
  el.style.left = `${left}%`;
  el.style.top = `${top}%`;
  el.style.setProperty("--decor-scale", String(scale));
  el.style.setProperty("--decor-pulse", "1");
  el.dataset.ampX = String(ampX);
  el.dataset.ampY = String(ampY);
  el.dataset.phase = String(phase);
  el.innerHTML = iconMarkup(type);
  return el;
}

function createLayer(targetPage: HTMLElement) {
  const nextLayer = document.createElement("div");
  nextLayer.className = "intro-game-process-bg-layer intro-game-process-bg-field";
  nextLayer.setAttribute("aria-hidden", "true");
  FIELD_DECOR.forEach((spec) => nextLayer.appendChild(createDecor(spec)));
  targetPage.prepend(nextLayer);
  return nextLayer;
}

function updateGeometry() {
  if (!page || !startSection || !endSection || !layer) return;

  const pageRect = page.getBoundingClientRect();
  const startRect = startSection.getBoundingClientRect();
  const endRect = endSection.getBoundingClientRect();
  const top = startRect.top - pageRect.top;
  const height = Math.max(1, endRect.bottom - startRect.top);

  layer.style.top = `${top}px`;
  layer.style.height = `${height}px`;
}

function animateDecor(time: number) {
  motionFrame = 0;
  if (!layer || !visible || window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;

  const t = time / 1000;
  layer.querySelectorAll<HTMLElement>(".intro-game-process-decor").forEach((el, index) => {
    if (el.classList.contains("is-cloud")) return;

    const ampX = Number(el.dataset.ampX ?? 0);
    const ampY = Number(el.dataset.ampY ?? 0);
    const phase = Number(el.dataset.phase ?? 0);
    const speedA = 0.42 + (index % 5) * 0.033;
    const speedB = 0.27 + (index % 4) * 0.026;

    const x =
      Math.sin(t * speedA + phase) * ampX +
      Math.cos(t * speedB * 1.43 + phase * 1.7) * ampX * 0.5;
    const y =
      Math.cos(t * speedB + phase) * ampY +
      Math.sin(t * speedA * 0.72 + phase * 0.75) * ampY * 0.66;
    const rotate = Math.sin(t * 0.3 + phase) * 5.5 + Math.cos(t * 0.16 + index) * 2.2;
    const pulse = 1 + Math.sin(t * 0.54 + phase * 1.35) * 0.06;

    el.style.setProperty("--decor-x", `${x.toFixed(2)}px`);
    el.style.setProperty("--decor-y", `${y.toFixed(2)}px`);
    el.style.setProperty("--decor-rotate", `${rotate.toFixed(2)}deg`);
    el.style.setProperty("--decor-pulse", pulse.toFixed(4));
  });

  motionFrame = window.requestAnimationFrame(animateDecor);
}

function startMotion() {
  if (motionFrame || !visible || !layer) return;
  if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;
  motionFrame = window.requestAnimationFrame(animateDecor);
}

function stopMotion() {
  if (!motionFrame) return;
  window.cancelAnimationFrame(motionFrame);
  motionFrame = 0;
}

function bindVisibility() {
  visibilityObserver?.disconnect();
  visible = false;
  if (!startSection || !endSection) return;

  const visibleSections = new Set<Element>();
  visibilityObserver = new IntersectionObserver((entries) => {
    entries.forEach((entry) => {
      if (entry.isIntersecting) visibleSections.add(entry.target);
      else visibleSections.delete(entry.target);
    });

    visible = visibleSections.size > 0;
    if (visible) startMotion();
    else stopMotion();
  }, { rootMargin: "180px 0px" });

  visibilityObserver.observe(startSection);
  visibilityObserver.observe(endSection);
}

function bindResize() {
  resizeObserver?.disconnect();
  if (!page || !startSection || !endSection) return;

  resizeObserver = new ResizeObserver(() => updateGeometry());
  resizeObserver.observe(page);
  resizeObserver.observe(startSection);
  resizeObserver.observe(endSection);
}

function cleanup() {
  stopMotion();
  visibilityObserver?.disconnect();
  resizeObserver?.disconnect();
  visibilityObserver = null;
  resizeObserver = null;
  layer?.remove();
  layer = null;
  page = null;
  startSection = null;
  endSection = null;
  visible = false;
}

function sync() {
  syncFrame = 0;
  const nextPage = document.querySelector<HTMLElement>(PAGE_SELECTOR);
  const nextStart = document.querySelector<HTMLElement>(START_SELECTOR);
  const nextEnd = document.querySelector<HTMLElement>(END_SELECTOR);

  if (!nextPage || !nextStart || !nextEnd) {
    if (layer) cleanup();
    return;
  }

  const unchanged =
    nextPage === page &&
    nextStart === startSection &&
    nextEnd === endSection &&
    !!layer?.isConnected;

  if (unchanged) {
    updateGeometry();
    return;
  }

  cleanup();
  page = nextPage;
  startSection = nextStart;
  endSection = nextEnd;
  layer = createLayer(page);
  updateGeometry();
  bindVisibility();
  bindResize();
}

function scheduleSync() {
  if (syncFrame) return;
  syncFrame = window.requestAnimationFrame(sync);
}

const observer = new MutationObserver((mutations) => {
  const onlyBackgroundMutations = mutations.every((mutation) => {
    const target = mutation.target instanceof Element ? mutation.target : mutation.target.parentElement;
    return !!target?.closest(".intro-game-process-bg-layer");
  });
  if (!onlyBackgroundMutations) scheduleSync();
});

function observeRoot() {
  const root = document.getElementById("root");
  if (!root) {
    window.setTimeout(observeRoot, 50);
    return;
  }

  observer.observe(root, { childList: true, subtree: true });
  scheduleSync();
}

window.addEventListener("resize", scheduleSync, { passive: true });
observeRoot();
