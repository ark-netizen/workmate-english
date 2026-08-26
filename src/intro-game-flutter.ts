const TARGET_SELECTORS = [
  ".intro-game .intro-features-section",
  ".intro-game .intro-trial-showcase",
] as const;

type DecorType = "chat" | "mail" | "document" | "chart" | "leaf" | "cloud" | "spark" | "grid" | "pixel";
type DecorSpec = readonly [DecorType, number, number, number, number, number, number];

/*
 * Work Process background motifs.
 * Positions are intentionally balanced across left/right gutters instead of clustering on one side.
 * Clouds have zero motion amplitude and remain static; all other motifs drift gently in JS.
 */
const PROCESS_DECOR: readonly DecorSpec[] = [
  ["cloud", 5, 4, 1.05, 0, 0, 0],
  ["pixel", 18, 6, 0.72, 9, 6, 0.3],
  ["document", 82, 6, 0.72, 9, 6, 1.2],
  ["cloud", 95, 4, 0.95, 0, 0, 0],

  ["chat", 7, 13, 0.84, 13, 9, 0.2],
  ["mail", 28, 17, 0.66, 10, 7, 1.5],
  ["chart", 72, 16, 0.72, 10, 7, 0.8],
  ["spark", 93, 13, 0.54, 7, 5, 2.0],

  ["pixel", 17, 24, 0.66, 10, 8, 2.5],
  ["leaf", 29, 28, 0.62, 11, 8, 2.2],
  ["chat", 71, 25, 0.72, 13, 9, 3.2],
  ["grid", 84, 28, 0.66, 8, 6, 3.0],

  ["mail", 6, 35, 0.64, 11, 8, 4.1],
  ["spark", 28, 38, 0.48, 7, 5, 4.7],
  ["document", 72, 37, 0.66, 9, 7, 3.6],
  ["pixel", 94, 35, 0.6, 10, 7, 1.8],

  ["chat", 17, 46, 0.72, 14, 10, 5.0],
  ["leaf", 29, 49, 0.6, 11, 8, 5.6],
  ["chart", 71, 48, 0.7, 10, 7, 4.0],
  ["grid", 83, 46, 0.64, 8, 6, 0.7],

  ["pixel", 6, 57, 0.6, 10, 8, 2.0],
  ["document", 28, 60, 0.62, 9, 7, 3.2],
  ["chat", 72, 58, 0.7, 14, 10, 1.4],
  ["spark", 94, 60, 0.5, 7, 5, 5.2],

  ["mail", 17, 68, 0.66, 11, 8, 0.9],
  ["grid", 29, 71, 0.64, 8, 6, 2.7],
  ["leaf", 71, 70, 0.62, 11, 8, 5.3],
  ["pixel", 83, 68, 0.66, 10, 7, 4.5],

  ["chat", 6, 79, 0.72, 14, 10, 3.7],
  ["spark", 28, 82, 0.48, 7, 5, 1.2],
  ["chart", 72, 81, 0.7, 10, 7, 4.3],
  ["document", 94, 79, 0.64, 9, 7, 2.4],

  ["leaf", 18, 90, 0.62, 11, 8, 1.7],
  ["pixel", 29, 93, 0.62, 10, 7, 4.9],
  ["chat", 71, 91, 0.7, 14, 10, 0.5],
  ["spark", 82, 93, 0.5, 7, 5, 2.9],
  ["cloud", 5, 97, 0.9, 0, 0, 0],
  ["cloud", 95, 97, 0.95, 0, 0, 0],
];

/* Same visual language continues through the 1-minute trial, with fewer elements because the section is shorter. */
const TRIAL_DECOR: readonly DecorSpec[] = [
  ["cloud", 5, 8, 0.92, 0, 0, 0],
  ["chat", 18, 14, 0.68, 12, 8, 0.4],
  ["document", 82, 13, 0.62, 9, 7, 1.4],
  ["cloud", 95, 9, 0.9, 0, 0, 0],

  ["mail", 7, 34, 0.62, 10, 7, 2.2],
  ["pixel", 28, 40, 0.6, 9, 7, 3.1],
  ["chart", 72, 37, 0.66, 10, 7, 4.0],
  ["leaf", 93, 34, 0.58, 10, 8, 5.0],

  ["spark", 17, 63, 0.48, 7, 5, 1.1],
  ["grid", 29, 69, 0.6, 8, 6, 2.8],
  ["chat", 71, 65, 0.66, 12, 8, 3.8],
  ["pixel", 83, 69, 0.58, 9, 7, 4.7],

  ["cloud", 5, 92, 0.86, 0, 0, 0],
  ["document", 18, 86, 0.58, 9, 6, 5.5],
  ["mail", 82, 86, 0.58, 10, 7, 0.8],
  ["cloud", 95, 92, 0.9, 0, 0, 0],
];

const layers = new Map<HTMLElement, HTMLDivElement>();
const visibleTargets = new Set<HTMLElement>();
let syncFrame = 0;
let motionFrame = 0;
let visibilityObserver: IntersectionObserver | null = null;

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
  el.dataset.ampX = String(ampX);
  el.dataset.ampY = String(ampY);
  el.dataset.phase = String(phase);
  el.innerHTML = iconMarkup(type);
  return el;
}

function specsFor(target: HTMLElement) {
  return target.classList.contains("intro-trial-showcase") ? TRIAL_DECOR : PROCESS_DECOR;
}

function createLayer(target: HTMLElement) {
  const layer = document.createElement("div");
  layer.className = "intro-game-process-bg-layer";
  layer.setAttribute("aria-hidden", "true");
  specsFor(target).forEach((spec) => layer.appendChild(createDecor(spec)));
  target.prepend(layer);
  return layer;
}

function animateDecor(time: number) {
  motionFrame = 0;
  if (visibleTargets.size === 0 || window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;

  const t = time / 1000;
  layers.forEach((layer, target) => {
    if (!visibleTargets.has(target)) return;

    layer.querySelectorAll<HTMLElement>(".intro-game-process-decor").forEach((el, index) => {
      const ampX = Number(el.dataset.ampX ?? 0);
      const ampY = Number(el.dataset.ampY ?? 0);
      if (ampX === 0 && ampY === 0) return;

      const phase = Number(el.dataset.phase ?? 0);
      const x = Math.sin(t * (0.14 + (index % 5) * 0.013) + phase) * ampX;
      const y = Math.cos(t * (0.115 + (index % 4) * 0.012) + phase) * ampY;
      const rotate = Math.sin(t * 0.075 + phase) * 1.35;
      el.style.setProperty("--decor-x", `${x.toFixed(2)}px`);
      el.style.setProperty("--decor-y", `${y.toFixed(2)}px`);
      el.style.setProperty("--decor-rotate", `${rotate.toFixed(2)}deg`);
    });
  });

  motionFrame = window.requestAnimationFrame(animateDecor);
}

function startMotion() {
  if (motionFrame || visibleTargets.size === 0) return;
  if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;
  motionFrame = window.requestAnimationFrame(animateDecor);
}

function stopMotion() {
  if (!motionFrame) return;
  window.cancelAnimationFrame(motionFrame);
  motionFrame = 0;
}

function rebuildVisibilityObserver(targets: HTMLElement[]) {
  visibilityObserver?.disconnect();
  visibleTargets.clear();

  visibilityObserver = new IntersectionObserver((entries) => {
    entries.forEach((entry) => {
      const target = entry.target as HTMLElement;
      if (entry.isIntersecting) visibleTargets.add(target);
      else visibleTargets.delete(target);
    });

    if (visibleTargets.size > 0) startMotion();
    else stopMotion();
  }, { rootMargin: "180px 0px" });

  targets.forEach((target) => visibilityObserver?.observe(target));
}

function cleanup() {
  stopMotion();
  visibilityObserver?.disconnect();
  visibilityObserver = null;
  visibleTargets.clear();
  layers.forEach((layer) => layer.remove());
  layers.clear();
}

function sync() {
  syncFrame = 0;
  const targets = TARGET_SELECTORS.flatMap((selector) => Array.from(document.querySelectorAll<HTMLElement>(selector)));
  const currentTargets = Array.from(layers.keys());
  const unchanged = targets.length === currentTargets.length && targets.every((target) => layers.has(target));

  if (unchanged && targets.every((target) => layers.get(target)?.isConnected)) return;

  cleanup();
  targets.forEach((target) => layers.set(target, createLayer(target)));
  rebuildVisibilityObserver(targets);
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