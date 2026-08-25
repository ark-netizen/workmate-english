const SECTION_SELECTOR = ".intro-page .intro-features-section";
const LANE_COUNT = 8;

const WORK_LOGS = [
  "09:32 · Jake → Can you check this by 3?",
  "10:18 · Draft saved · Re: Proposal review",
  "11:05 · Ellen → Could you please review this?",
  "11:42 · Solar · relationship tone checked ✓",
  "12:20 · Reminder scheduled · 30 min later",
  "13:08 · Liam → Please confirm the timeline.",
  "14:14 · Away mode · reminder queued",
  "15:03 · Feedback sent ✓",
  "16:25 · Correction saved · by this afternoon",
  "17:12 · Work report · expression logged ✓",
  "Weekly report · tone accuracy ↑",
  "Context loaded · IT / Software · Service Planner",
];

const AMBIENT_WORDS = ["WORK LOG", "MESSAGE", "REPLY", "FEEDBACK", "DONE"];

let currentSection: HTMLElement | null = null;
let currentLayer: HTMLDivElement | null = null;
let syncFrame = 0;
let parallaxFrame = 0;

function createToken(text: string) {
  const token = document.createElement("span");
  token.className = `intro-work-stream-token${text.includes("✓") || text.includes("↑") ? " is-status" : ""}`;

  const icon = document.createElement("i");
  icon.setAttribute("aria-hidden", "true");
  token.appendChild(icon);
  token.append(document.createTextNode(text));
  return token;
}

function buildTrack(laneIndex: number) {
  const track = document.createElement("div");
  track.className = "intro-work-stream-track";

  const offset = (laneIndex * 2) % WORK_LOGS.length;
  const ordered = WORK_LOGS.map((_, index) => WORK_LOGS[(index + offset) % WORK_LOGS.length]);

  for (let copyIndex = 0; copyIndex < 2; copyIndex += 1) {
    const copy = document.createElement("div");
    copy.className = "intro-work-stream-copy";
    copy.setAttribute("aria-hidden", "true");
    ordered.forEach((item) => copy.appendChild(createToken(item)));
    track.appendChild(copy);
  }

  return track;
}

function createLayer(section: HTMLElement) {
  const layer = document.createElement("div");
  layer.className = "intro-work-stream-layer";
  layer.setAttribute("aria-hidden", "true");

  const ambient = document.createElement("div");
  ambient.className = "intro-work-stream-ambient";
  AMBIENT_WORDS.forEach((text) => {
    const word = document.createElement("b");
    word.textContent = text;
    ambient.appendChild(word);
  });
  layer.appendChild(ambient);

  for (let laneIndex = 0; laneIndex < LANE_COUNT; laneIndex += 1) {
    const lane = document.createElement("div");
    lane.className = `intro-work-stream-lane lane-${laneIndex + 1}`;
    lane.dataset.streamLane = "";
    lane.appendChild(buildTrack(laneIndex));
    layer.appendChild(lane);
  }

  section.prepend(layer);
  return layer;
}

function updateParallax() {
  parallaxFrame = 0;
  if (!currentSection || !currentLayer) return;

  const rect = currentSection.getBoundingClientRect();
  const total = rect.height + window.innerHeight;
  const progress = total > 0 ? Math.min(1, Math.max(0, (window.innerHeight - rect.top) / total)) : 0.5;
  const baseShift = (progress - 0.5) * 42;

  currentLayer.querySelectorAll<HTMLElement>("[data-stream-lane]").forEach((lane, index) => {
    const direction = index % 2 === 0 ? 1 : -1;
    const strength = 0.45 + (index % 4) * 0.18;
    lane.style.setProperty("--lane-parallax", `${baseShift * direction * strength}px`);
  });
}

function scheduleParallax() {
  if (parallaxFrame) return;
  parallaxFrame = window.requestAnimationFrame(updateParallax);
}

function cleanup() {
  currentLayer?.remove();
  currentLayer = null;
  currentSection = null;
}

function sync() {
  syncFrame = 0;
  const section = document.querySelector<HTMLElement>(SECTION_SELECTOR);

  if (!section) {
    if (currentSection) cleanup();
    return;
  }

  if (section !== currentSection || !currentLayer?.isConnected) {
    cleanup();
    currentSection = section;
    currentLayer = createLayer(section);
  }

  scheduleParallax();
}

function scheduleSync() {
  if (syncFrame) return;
  syncFrame = window.requestAnimationFrame(sync);
}

const rootObserver = new MutationObserver((mutations) => {
  const onlyStreamMutations = mutations.every((mutation) => {
    const target = mutation.target instanceof Element ? mutation.target : mutation.target.parentElement;
    return !!target?.closest(".intro-work-stream-layer");
  });
  if (!onlyStreamMutations) scheduleSync();
});

const observeRoot = () => {
  const root = document.getElementById("root");
  if (!root) {
    window.setTimeout(observeRoot, 50);
    return;
  }

  rootObserver.observe(root, { childList: true, subtree: true });
  window.addEventListener("scroll", scheduleParallax, { passive: true });
  window.addEventListener("resize", scheduleParallax);
  scheduleSync();
};

observeRoot();
