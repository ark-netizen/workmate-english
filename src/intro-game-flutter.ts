const TARGET_SELECTORS = [
  ".intro-game .intro-features-section",
  ".intro-game .intro-trial-showcase",
] as const;

type DecorType = "chat" | "mail" | "document" | "chart" | "leaf" | "cloud" | "spark" | "grid" | "pixel";
type DecorSpec = readonly [DecorType, number, number, number, number, number, number];

/*
 * Decorative UI lives in two explicit side rails.
 * Left anchors stay at 5~10%, right anchors at 90~95%, so they remain outside the centered card column
 * even on narrower desktop widths. Clouds stay static; every other item gets bubble-like JS motion.
 */
const PROCESS_DECOR: readonly DecorSpec[] = [
  ["cloud", 6, 3, 1.02, 0, 0, 0],
  ["document", 93, 5, 0.82, 30, 22, 1.2],
  ["cloud", 94, 9, 0.94, 0, 0, 0],
  ["pixel", 8, 7, 0.8, 27, 20, 0.3],

  ["chat", 7, 14, 0.96, 38, 30, 0.2],
  ["chart", 92, 15, 0.9, 36, 29, 0.8],
  ["mail", 9, 20, 0.76, 31, 25, 1.5],
  ["spark", 95, 22, 0.66, 27, 22, 2.0],

  ["pixel", 6, 27, 0.76, 29, 24, 2.5],
  ["chat", 93, 28, 0.9, 40, 31, 3.2],
  ["leaf", 9, 33, 0.72, 32, 27, 2.2],
  ["grid", 91, 35, 0.76, 29, 23, 3.0],

  ["mail", 7, 40, 0.8, 33, 27, 4.1],
  ["document", 94, 41, 0.82, 34, 28, 3.6],
  ["spark", 9, 46, 0.62, 27, 22, 4.7],
  ["pixel", 91, 48, 0.72, 30, 25, 1.8],

  ["chat", 6, 54, 0.92, 40, 32, 5.0],
  ["chart", 93, 55, 0.86, 37, 30, 4.0],
  ["leaf", 10, 60, 0.72, 33, 27, 5.6],
  ["grid", 91, 62, 0.74, 29, 24, 0.7],

  ["pixel", 7, 68, 0.74, 30, 24, 2.0],
  ["chat", 94, 69, 0.9, 40, 32, 1.4],
  ["document", 9, 74, 0.78, 34, 28, 3.2],
  ["spark", 91, 76, 0.62, 27, 22, 5.2],

  ["mail", 6, 82, 0.8, 34, 27, 0.9],
  ["leaf", 94, 83, 0.74, 33, 27, 5.3],
  ["grid", 9, 88, 0.72, 29, 24, 2.7],
  ["chart", 92, 90, 0.84, 37, 30, 4.3],

  ["cloud", 6, 97, 0.9, 0, 0, 0],
  ["chat", 10, 95, 0.82, 38, 30, 3.7],
  ["pixel", 95, 96, 0.72, 30, 24, 4.9],
  ["cloud", 94, 98, 0.92, 0, 0, 0],
];

const TRIAL_DECOR: readonly DecorSpec[] = [
  ["cloud", 6, 7, 0.9, 0, 0, 0],
  ["chat", 8, 17, 0.86, 36, 29, 0.4],
  ["document", 93, 15, 0.78, 33, 27, 1.4],
  ["cloud", 94, 8, 0.88, 0, 0, 0],

  ["mail", 6, 34, 0.78, 33, 27, 2.2],
  ["chart", 94, 35, 0.82, 36, 29, 4.0],
  ["pixel", 9, 47, 0.72, 29, 24, 3.1],
  ["leaf", 91, 49, 0.72, 32, 27, 5.0],

  ["spark", 6, 64, 0.6, 27, 22, 1.1],
  ["chat", 94, 65, 0.84, 37, 30, 3.8],
  ["grid", 9, 75, 0.7, 29, 24, 2.8],
  ["pixel", 91, 78, 0.7, 29, 24, 4.7],

  ["cloud", 6, 93, 0.84, 0, 0, 0],
  ["document", 9, 88, 0.72, 33, 27, 5.5],
  ["mail", 94, 87, 0.74, 34, 27, 0.8],
  ["cloud", 94, 94, 0.86, 0, 0, 0],
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
  const side = left >= 50 ? "right" : "left";
  el.className = `intro-game-process-decor is-${type} is-${side}-rail`;
  el.style.left = `${left}%`;
  el.style.top = `${top}%`;
  el.style.setProperty("--decor-scale", String(scale));
  el.style.setProperty("--decor-pulse", "1");
  el.dataset.side = side;
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
      if (el.classList.contains("is-cloud")) return;

      const ampX = Number(el.dataset.ampX ?? 0);
      const ampY = Number(el.dataset.ampY ?? 0);
      const phase = Number(el.dataset.phase ?? 0);
      const side = el.dataset.side;

      const speedA = 0.46 + (index % 5) * 0.032;
      const speedB = 0.29 + (index % 4) * 0.025;
      const rawX =
        Math.sin(t * speedA + phase) * ampX +
        Math.cos(t * speedB * 1.41 + phase * 1.8) * ampX * 0.46;

      /* Edge rails mostly drift inward, so right-side items cannot disappear beyond the viewport. */
      const edgeBias = Math.abs(rawX) * 0.72;
      const smallOrbit = Math.sin(t * 0.63 + phase * 2.2) * ampX * 0.2;
      const x = side === "right" ? -edgeBias + smallOrbit : edgeBias + smallOrbit;
      const y =
        Math.cos(t * speedB + phase) * ampY +
        Math.sin(t * speedA * 0.73 + phase * 0.7) * ampY * 0.64;
      const rotate = Math.sin(t * 0.32 + phase) * 6 + Math.cos(t * 0.17 + index) * 2.4;
      const pulse = 1 + Math.sin(t * 0.58 + phase * 1.4) * 0.065;

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