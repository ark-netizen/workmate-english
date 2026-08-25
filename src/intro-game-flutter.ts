const TARGET_SELECTOR = ".intro-game .intro-game-features";

const PARTICLES = [
  ["leaf", 6, 4, 17, 0, -1],
  ["paper", 19, 10, 22, 5, 1],
  ["leaf", 82, 15, 19, 8, 1],
  ["paper", 91, 22, 25, 2, -1],
  ["leaf", 11, 29, 23, 11, 1],
  ["leaf", 73, 34, 18, 4, -1],
  ["paper", 3, 39, 27, 14, 1],
  ["paper", 87, 45, 21, 9, -1],
  ["leaf", 17, 51, 20, 3, -1],
  ["leaf", 78, 57, 25, 13, 1],
  ["paper", 7, 63, 24, 7, 1],
  ["leaf", 94, 67, 18, 16, -1],
  ["paper", 22, 73, 29, 1, -1],
  ["leaf", 70, 78, 21, 10, 1],
  ["leaf", 5, 85, 24, 18, 1],
  ["paper", 88, 91, 26, 6, -1],
] as const;

let currentTarget: HTMLElement | null = null;
let currentLayer: HTMLDivElement | null = null;
let syncFrame = 0;

function createParticle(
  type: "leaf" | "paper",
  left: number,
  top: number,
  duration: number,
  delay: number,
  direction: number,
  index: number,
) {
  const particle = document.createElement("span");
  particle.className = `intro-game-flutter-particle is-${type}`;
  particle.style.setProperty("--flutter-left", `${left}%`);
  particle.style.setProperty("--flutter-top", `${top}%`);
  particle.style.setProperty("--flutter-duration", `${duration}s`);
  particle.style.setProperty("--flutter-flap-duration", `${Math.max(4.8, duration * 0.34).toFixed(1)}s`);
  particle.style.setProperty("--flutter-delay", `${-delay}s`);
  particle.style.setProperty("--flutter-direction", String(direction));
  particle.style.setProperty("--flutter-scale", String(0.72 + (index % 5) * 0.09));

  const shape = document.createElement("i");
  shape.setAttribute("aria-hidden", "true");
  particle.appendChild(shape);
  return particle;
}

function createLayer(target: HTMLElement) {
  const layer = document.createElement("div");
  layer.className = "intro-game-flutter-layer";
  layer.setAttribute("aria-hidden", "true");

  PARTICLES.forEach(([type, left, top, duration, delay, direction], index) => {
    layer.appendChild(createParticle(type, left, top, duration, delay, direction, index));
  });

  target.prepend(layer);
  return layer;
}

function cleanup() {
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
  }
}

function scheduleSync() {
  if (syncFrame) return;
  syncFrame = window.requestAnimationFrame(sync);
}

const observer = new MutationObserver((mutations) => {
  const onlyFlutterMutations = mutations.every((mutation) => {
    const target = mutation.target instanceof Element ? mutation.target : mutation.target.parentElement;
    return !!target?.closest(".intro-game-flutter-layer");
  });
  if (!onlyFlutterMutations) scheduleSync();
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
