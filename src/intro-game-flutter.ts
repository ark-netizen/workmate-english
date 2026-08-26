const TARGET_SELECTOR = ".intro-game .intro-game-features";

const STATIC_DECOR = [
  ["chat", 5, 5, 1.05],
  ["mail", 11, 17, 0.9],
  ["spark", 18, 8, 0.72],
  ["document", 88, 6, 0.95],
  ["chart", 83, 20, 1.08],
  ["spark", 94, 15, 0.68],
  ["cloud", 5, 34, 1.2],
  ["chat", 91, 40, 0.9],
  ["spark", 9, 54, 0.62],
  ["mail", 88, 60, 0.78],
  ["document", 7, 73, 0.78],
  ["chart", 90, 81, 0.92],
  ["cloud", 8, 92, 1.05],
  ["spark", 85, 93, 0.7],
] as const;

const MESSAGES = [
  { person: "Jake · 동료", text: "Can you check this by 3?", left: 2.5, top: 25, ampX: 18, ampY: 12, phase: 0.2 },
  { person: "Ellen · 상사", text: "Could you review the proposal?", left: 77.5, top: 31, ampX: 16, ampY: 14, phase: 1.7 },
  { person: "Liam · 거래처", text: "Please confirm the timeline.", left: 3.5, top: 61, ampX: 20, ampY: 11, phase: 3.1 },
  { person: "WorkMate", text: "Re: proposal · feedback sent ✓", left: 78, top: 72, ampX: 14, ampY: 16, phase: 4.6 },
] as const;

let currentTarget: HTMLElement | null = null;
let currentLayer: HTMLDivElement | null = null;
let syncFrame = 0;
let motionFrame = 0;
let targetVisible = true;
let visibilityObserver: IntersectionObserver | null = null;

function iconMarkup(type: string) {
  const common = 'viewBox="0 0 48 48" aria-hidden="true" focusable="false"';
  if (type === "chat") return `<svg ${common}><path d="M7 9h34v23H21l-8 7v-7H7z"/><path d="M15 20h3m6 0h3m6 0h3"/></svg>`;
  if (type === "mail") return `<svg ${common}><path d="M6 11h36v27H6z"/><path d="m7 13 17 14 17-14M7 36l12-11m22 11L29 25"/></svg>`;
  if (type === "document") return `<svg ${common}><path d="M12 5h18l8 8v30H12z"/><path d="M30 5v9h8M18 22h14M18 28h14M18 34h10"/></svg>`;
  if (type === "chart") return `<svg ${common}><path d="M8 40h33M11 37V21h7v16m5 0V13h7v24m5 0V7h7v30"/></svg>`;
  if (type === "cloud") return `<svg ${common}><path d="M10 34h29c4 0 6-3 6-7s-3-7-7-7h-1C35 13 30 9 24 9c-7 0-12 5-13 12-5 1-8 4-8 8 0 3 3 5 7 5z"/></svg>`;
  return `<svg ${common}><path d="M24 5v12M24 31v12M5 24h12M31 24h12M12 12l8 8m8 8 8 8m0-24-8 8m-8 8-8 8"/></svg>`;
}

function createStaticDecor(type: string, left: number, top: number, scale: number) {
  const el = document.createElement("span");
  el.className = `intro-game-process-decor is-${type}`;
  el.style.left = `${left}%`;
  el.style.top = `${top}%`;
  el.style.setProperty("--decor-scale", String(scale));
  el.innerHTML = iconMarkup(type);
  return el;
}

function createMessage(message: (typeof MESSAGES)[number], index: number) {
  const bubble = document.createElement("div");
  bubble.className = `intro-game-process-message${index >= 2 ? " is-mobile-optional" : ""}`;
  bubble.style.left = `${message.left}%`;
  bubble.style.top = `${message.top}%`;
  bubble.dataset.ampX = String(message.ampX);
  bubble.dataset.ampY = String(message.ampY);
  bubble.dataset.phase = String(message.phase);

  const person = document.createElement("b");
  person.textContent = message.person;
  const text = document.createElement("span");
  text.textContent = message.text;
  bubble.append(person, text);
  return bubble;
}

function createLayer(target: HTMLElement) {
  const layer = document.createElement("div");
  layer.className = "intro-game-process-bg-layer";
  layer.setAttribute("aria-hidden", "true");

  STATIC_DECOR.forEach(([type, left, top, scale]) => {
    layer.appendChild(createStaticDecor(type, left, top, scale));
  });

  MESSAGES.forEach((message, index) => layer.appendChild(createMessage(message, index)));
  target.prepend(layer);
  return layer;
}

function animateMessages(time: number) {
  motionFrame = 0;
  if (!currentLayer || !targetVisible || window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;

  const t = time / 1000;
  currentLayer.querySelectorAll<HTMLElement>(".intro-game-process-message").forEach((bubble, index) => {
    const ampX = Number(bubble.dataset.ampX ?? 14);
    const ampY = Number(bubble.dataset.ampY ?? 10);
    const phase = Number(bubble.dataset.phase ?? 0);
    const x = Math.sin(t * (0.32 + index * 0.035) + phase) * ampX;
    const y = Math.cos(t * (0.26 + index * 0.03) + phase) * ampY;
    const rotate = Math.sin(t * 0.22 + phase) * 1.2;
    bubble.style.transform = `translate3d(${x.toFixed(2)}px, ${y.toFixed(2)}px, 0) rotate(${rotate.toFixed(2)}deg)`;
  });

  motionFrame = window.requestAnimationFrame(animateMessages);
}

function startMotion() {
  if (motionFrame || !currentLayer || !targetVisible) return;
  if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;
  motionFrame = window.requestAnimationFrame(animateMessages);
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
