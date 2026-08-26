const TARGET_SELECTOR = ".intro-game .intro-features-section";

type DecorType = "chat" | "mail" | "document" | "chart" | "leaf" | "cloud" | "spark" | "grid" | "pixel";

type DecorSpec = readonly [DecorType, number, number, number, number, number, number];

// Background-only motifs from the approved reference image.
// The layer is attached to the full Work Process section, not the inner card container.
const DECOR: readonly DecorSpec[] = [
  ["cloud", 4, 4, 1.12, 0, 0, 0],
  ["pixel", 16, 5, 0.8, 8, 6, 0.4],
  ["document", 87, 5, 0.76, 7, 5, 1.2],
  ["cloud", 97, 8, 0.94, 0, 0, 0],

  ["chat", 4, 12, 0.9, 12, 8, 0.2],
  ["mail", 16, 18, 0.72, 10, 7, 1.7],
  ["grid", 10, 23, 0.82, 7, 5, 2.1],
  ["spark", 1.5, 29, 0.58, 6, 5, 2.4],
  ["pixel", 22, 31, 0.62, 9, 7, 3.4],

  ["chart", 85, 20, 0.84, 9, 7, 0.8],
  ["leaf", 93, 22, 0.72, 11, 8, 2.0],
  ["chat", 97, 30, 0.74, 13, 9, 3.2],
  ["spark", 75, 12, 0.54, 6, 5, 1.0],
  ["pixel", 80, 34, 0.74, 8, 6, 4.0],

  ["cloud", 3, 41, 0.92, 0, 0, 0],
  ["spark", 8, 49, 0.5, 6, 5, 4.3],
  ["grid", 96, 47, 0.72, 8, 6, 0.6],
  ["mail", 92, 56, 0.64, 10, 7, 2.8],
  ["pixel", 5, 57, 0.58, 8, 7, 1.9],

  ["document", 6, 67, 0.64, 8, 6, 3.7],
  ["spark", 2, 74, 0.5, 6, 5, 5.1],
  ["chart", 93, 74, 0.7, 9, 7, 4.0],
  ["leaf", 85, 65, 0.62, 11, 8, 5.4],
  ["pixel", 96, 68, 0.72, 9, 6, 2.5],

  ["grid", 9, 86, 0.66, 7, 6, 2.7],
  ["cloud", 5, 96, 0.96, 0, 0, 0],
  ["spark", 79, 90, 0.52, 6, 5, 0.5],
  ["chat", 95, 91, 0.7, 12, 8, 1.5],
  ["cloud", 97, 97, 1.05, 0, 0, 0],
  ["pixel", 27, 93, 0.66, 8, 6, 4.6],
];

let currentTarget: HTMLElement | null = null;
let currentLayer: HTMLDivElement | null = null;
let syncFrame = 0;
let motionFrame = 0;
let targetVisible = true;
let visibilityObserver: IntersectionObserver | null = null;

function iconMarkup(type: DecorType) {
  const common = 'viewBox="0 0 48 48" aria-hidden="true" focusable="false"';

  if (type === "chat") {
    return `<svg ${common}><path d="M7 9h34v23H21l-8 7v-7H7z"/><path d="M15 20h3m6 0h3m6 0h3"/></svg>`;
  }
  if (type === "mail") {
    return `<svg ${common}><path d="M6 11h36v27H6z"/><path d="m7 13 17 14 17-14M7 36l12-11m22 11L29 25"/></svg>`;
  }
  if (type === "document") {
    return `<svg ${common}><path d="M12 5h18l8 8v30H12z"/><path d="M30 5v9h8M18 22h14M18 28h14M18 34h10"/></svg>`;
  }
  if (type === "chart") {
    return `<svg ${common}><path d="M8 40h33M11 37V23h7v14m5 0V16h7v21m5 0V8h7v29"/><path d="m12 17 10-7 8 4 10-9"/></svg>`;
  }
  if (type === "leaf") {
    return `<svg ${common}><path d="M38 8C25 8 13 15 10 29c9 4 22 0 28-21Z"/><path d="M11 35c6-8 12-13 23-21"/></svg>`;
  }
  if (type === "cloud") {
    return `<svg ${common}><path d="M5 34h38v-6h-6v-7h-7v-6H18v6h-6v7H5z"/></svg>`;
  }
  if (type === "grid") {
    return `<svg ${common}><path d="M8 8h4v4H8zm10 0h4v4h-4zm10 0h4v4h-4zM8 18h4v4H8zm10 0h4v4h-4zm10 0h4v4H8zm0 10h4v4H8zm10 0h4v4h-4zm10 0h4v4h-4z"/></svg>`;
  }
  if (type === "pixel") {
    return `<svg ${common}><path d="M16 16h16v16H16z"/></svg>`;
  }

  return `<svg ${common}><path d="M24 6v12M24 30v12M6 24h12M30 24h12"/></svg>`;
}

function createDecor([type, left, top, scale, ampX, ampY, phase]: DecorSpec) {
  const el = document.createElement("span");
  el.className = `intro-game-process-decor is-${type}`;
  el.style.left = `${left}%`;
  el.style.top = `${top}%`;
  el.style.setProperty("--decor-scale", String(scale));
  el.dataset.ampX = String(ampX);
  el.dataset.ampY = String(ampY);
  el.dataset.phase = String(phase);
  el.innerHTML = iconMarkup(type);
  return el;
}

function createLayer(target: HTMLElement) {
  const layer = document.createElement("div");
  layer.className = "intro-game-process-bg-layer";
  layer.setAttribute("aria-hidden", "true");
  DECOR.forEach((spec) => layer.appendChild(createDecor(spec)));
  target.prepend(layer);
  return layer;
}

function animateDecor(time: number) {
  motionFrame = 0;
  if (!currentLayer || !targetVisible || window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;

  const t = time / 1000;
  currentLayer.querySelectorAll<HTMLElement>(".intro-game-process-decor").forEach((el, index) => {
    const ampX = Number(el.dataset.ampX ?? 0);
    const ampY = Number(el.dataset.ampY ?? 0);
    if (ampX === 0 && ampY === 0) return;

    const phase = Number(el.dataset.phase ?? 0);
    const x = Math.sin(t * (0.15 + (index % 4) * 0.016) + phase) * ampX;
    const y = Math.cos(t * (0.12 + (index % 3) * 0.015) + phase) * ampY;
    const rotate = Math.sin(t * 0.08 + phase) * 1.2;
    el.style.setProperty("--decor-x", `${x.toFixed(2)}px`);
    el.style.setProperty("--decor-y", `${y.toFixed(2)}px`);
    el.style.setProperty("--decor-rotate", `${rotate.toFixed(2)}deg`);
  });

  motionFrame = window.requestAnimationFrame(animateDecor);
}

function startMotion() {
  if (motionFrame || !currentLayer || !targetVisible) return;
  if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;
  motionFrame = window.requestAnimationFrame(animateDecor);
}

function stopMotion() {
  if (!motionFrame) return;
  window.cancelAnimationFrame(motionFrame);
  motionFrame = 0;
}

function bindVisibility(target: HTMLElement) {
  visibilityObserver?.disconnect();
  visibilityObserver = new IntersectionObserver(([entry]) => {
    targetVisible = entry?.isIntersecting ?? true;
    if (targetVisible) startMotion();
    else stopMotion();
  }, { rootMargin: "180px 0px" });
  visibilityObserver.observe(target);
}

function cleanup() {
  stopMotion();
  visibilityObserver?.disconnect();
  visibilityObserver = null;
  currentLayer?.remove();
  currentLayer = null;
  currentTarget = null;
}

function sync() {
  syncFrame = 0;
  const target = document.querySelector<HTMLElement>(TARGET_SELECTOR);

  if (!target) {
    if (currentTarget) cleanup();
    return;
  }

  if (target !== currentTarget || !currentLayer?.isConnected) {
    cleanup();
    currentTarget = target;
    currentLayer = createLayer(target);
    bindVisibility(target);
    startMotion();
  }
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

observeRoot();
