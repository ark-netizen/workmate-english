const TARGET_SELECTOR = ".intro-game .intro-game-features";

type DecorType = "chat" | "mail" | "document" | "chart" | "leaf" | "cloud" | "spark" | "grid";

type DecorSpec = readonly [DecorType, number, number, number, number, number, number];

// Background-only motifs from the approved reference image.
// No title, badge, cards, people, furniture, skyline, or text bubbles are created here.
const DECOR: readonly DecorSpec[] = [
  ["cloud", 5, 4, 1.12, 0, 0, 0],
  ["spark", 17, 5, 0.72, 4, 3, 0.4],
  ["document", 87, 5, 0.76, 5, 4, 1.2],
  ["cloud", 96, 7, 0.92, 0, 0, 0],

  ["chat", 5, 12, 0.86, 9, 6, 0.2],
  ["mail", 17, 17, 0.72, 7, 5, 1.7],
  ["grid", 12, 22, 0.82, 0, 0, 0],
  ["spark", 2, 28, 0.58, 4, 3, 2.4],

  ["chart", 84, 19, 0.82, 6, 5, 0.8],
  ["leaf", 92, 21, 0.72, 8, 6, 2.0],
  ["chat", 96, 29, 0.72, 10, 7, 3.2],
  ["spark", 75, 11, 0.54, 4, 4, 1.0],

  ["cloud", 4, 39, 0.9, 0, 0, 0],
  ["spark", 8, 48, 0.5, 4, 3, 4.3],
  ["grid", 95, 47, 0.72, 0, 0, 0],
  ["mail", 91, 56, 0.62, 7, 5, 2.8],

  ["document", 7, 66, 0.62, 5, 4, 3.7],
  ["spark", 2, 73, 0.5, 4, 4, 5.1],
  ["chart", 92, 73, 0.68, 6, 5, 4.0],
  ["leaf", 84, 64, 0.6, 8, 6, 5.4],

  ["grid", 10, 86, 0.66, 0, 0, 0],
  ["cloud", 6, 95, 0.95, 0, 0, 0],
  ["spark", 79, 90, 0.52, 4, 4, 0.5],
  ["chat", 94, 91, 0.68, 9, 6, 1.5],
  ["cloud", 96, 97, 1.05, 0, 0, 0],
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
    return `<svg ${common}><path d="M8 8h4v4H8zm10 0h4v4h-4zm10 0h4v4h-4zM8 18h4v4H8zm10 0h4v4h-4zm10 0h4v4h-4zM8 28h4v4H8zm10 0h4v4h-4zm10 0h4v4h-4z"/></svg>`;
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
    const x = Math.sin(t * (0.16 + (index % 4) * 0.018) + phase) * ampX;
    const y = Math.cos(t * (0.13 + (index % 3) * 0.017) + phase) * ampY;
    el.style.setProperty("--decor-x", `${x.toFixed(2)}px`);
    el.style.setProperty("--decor-y", `${y.toFixed(2)}px`);
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
