const TARGET_SELECTORS = [
  ".intro-game .intro-features-section",
  ".intro-game .intro-trial-showcase",
] as const;

type DecorType = "chat" | "mail" | "document" | "chart" | "leaf" | "cloud" | "spark" | "grid" | "pixel";
type DecorSpec = readonly [DecorType, number, number, number, number, number, number];

/*
 * Keep the moving UI motifs clearly visible in both side gutters.
 * Left anchors stay around 10~25%, right anchors around 75~90% so they do not get clipped off-screen.
 * Clouds intentionally have zero amplitude and remain static.
 */
const PROCESS_DECOR: readonly DecorSpec[] = [
  ["cloud", 7, 4, 1.05, 0, 0, 0],
  ["pixel", 22, 6, 0.76, 22, 18, 0.3],
  ["document", 78, 7, 0.76, 24, 20, 1.2],
  ["cloud", 92, 5, 0.96, 0, 0, 0],

  ["chat", 11, 14, 0.9, 32, 24, 0.2],
  ["mail", 25, 18, 0.7, 25, 21, 1.5],
  ["chart", 76, 17, 0.78, 27, 22, 0.8],
  ["spark", 89, 14, 0.58, 22, 18, 2.0],

  ["pixel", 12, 25, 0.7, 24, 20, 2.5],
  ["leaf", 24, 29, 0.66, 28, 23, 2.2],
  ["chat", 77, 25, 0.8, 34, 26, 3.2],
  ["grid", 89, 29, 0.7, 23, 19, 3.0],

  ["mail", 10, 36, 0.7, 27, 22, 4.1],
  ["spark", 24, 39, 0.54, 22, 18, 4.7],
  ["document", 77, 38, 0.72, 26, 22, 3.6],
  ["pixel", 89, 36, 0.66, 24, 20, 1.8],

  ["chat", 12, 47, 0.8, 34, 27, 5.0],
  ["leaf", 25, 50, 0.66, 29, 23, 5.6],
  ["chart", 76, 49, 0.76, 28, 22, 4.0],
  ["grid", 88, 47, 0.7, 24, 19, 0.7],

  ["pixel", 10, 58, 0.66, 24, 20, 2.0],
  ["document", 24, 61, 0.7, 27, 22, 3.2],
  ["chat", 77, 59, 0.78, 34, 27, 1.4],
  ["spark", 90, 61, 0.54, 22, 18, 5.2],

  ["mail", 12, 69, 0.72, 28, 22, 0.9],
  ["grid", 25, 72, 0.68, 24, 19, 2.7],
  ["leaf", 76, 71, 0.68, 29, 23, 5.3],
  ["pixel", 88, 69, 0.7, 24, 20, 4.5],

  ["chat", 10, 80, 0.8, 34, 27, 3.7],
  ["spark", 24, 83, 0.54, 22, 18, 1.2],
  ["chart", 77, 82, 0.76, 28, 22, 4.3],
  ["document", 90, 80, 0.7, 27, 22, 2.4],

  ["leaf", 12, 90, 0.68, 29, 23, 1.7],
  ["pixel", 25, 93, 0.68, 24, 20, 4.9],
  ["chat", 76, 91, 0.78, 34, 27, 0.5],
  ["spark", 88, 93, 0.54, 22, 18, 2.9],
  ["cloud", 7, 97, 0.9, 0, 0, 0],
  ["cloud", 92, 97, 0.95, 0, 0, 0],
];

const TRIAL_DECOR: readonly DecorSpec[] = [
  ["cloud", 7, 8, 0.92, 0, 0, 0],
  ["chat", 20, 15, 0.76, 30, 24, 0.4],
  ["document", 79, 14, 0.7, 26, 21, 1.4],
  ["cloud", 92, 9, 0.9, 0, 0, 0],

  ["mail", 11, 34, 0.7, 28, 22, 2.2],
  ["pixel", 24, 41, 0.66, 24, 20, 3.1],
  ["chart", 76, 38, 0.72, 28, 22, 4.0],
  ["leaf", 89, 35, 0.64, 29, 23, 5.0],

  ["spark", 12, 63, 0.54, 22, 18, 1.1],
  ["grid", 25, 69, 0.66, 24, 19, 2.8],
  ["chat", 76, 65, 0.74, 31, 24, 3.8],
  ["pixel", 88, 69, 0.64, 24, 20, 4.7],

  ["cloud", 7, 92, 0.86, 0, 0, 0],
  ["document", 21, 86, 0.66, 26, 21, 5.5],
  ["mail", 79, 86, 0.66, 28, 22, 0.8],
  ["cloud", 92, 92, 0.9, 0, 0, 0],
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
  el.style.setProperty("--decor-pulse", "1");
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
      /* Clouds alone stay fixed. */
      if (el.classList.contains("is-cloud")) return;

      const ampX = Number(el.dataset.ampX ?? 0);
      const ampY = Number(el.dataset.ampY ?? 0);
      const phase = Number(el.dataset.phase ?? 0);

      /*
       * Layer two frequencies instead of a straight sine wave.
       * The result is a loose oval / bubble drift that never reads as a rigid left-right line.
       */
      const speedA = 0.34 + (index % 5) * 0.025;
      const speedB = 0.21 + (index % 4) * 0.019;
      const x =
        Math.sin(t * speedA + phase) * ampX +
        Math.cos(t * speedB * 1.37 + phase * 1.8) * ampX * 0.42;
      const y =
        Math.cos(t * speedB + phase) * ampY +
        Math.sin(t * speedA * 0.71 + phase * 0.7) * ampY * 0.58;
      const rotate = Math.sin(t * 0.24 + phase) * 4.5 + Math.cos(t * 0.13 + index) * 1.8;
      const pulse = 1 + Math.sin(t * 0.46 + phase * 1.4) * 0.045;

      el.style.setProperty("--decor-x", `${x.toFixed(2)}px`);
      el.style.setProperty("--decor-y", `${y.toFixed(2)}px`);
      el.style.setProperty("--decor-rotate", `${rotate.toFixed(2)}deg`);
      el.style.setProperty("--decor-pulse", pulse.toFixed(4));
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