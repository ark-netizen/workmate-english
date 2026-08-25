type StreamScene = {
  ambient: [string, string, string];
  items: string[];
};

const SECTION_SELECTOR = ".intro-page .intro-features-section";
const CARD_SELECTOR = ".intro-business-feature-card, .intro-game-feature-window";

const STREAM_SCENES: StreamScene[] = [
  {
    ambient: ["RELATIONSHIP", "TONE", "REPLY"],
    items: [
      "Jake · colleague",
      "Ellen · manager",
      "Liam · client",
      "Casual tone",
      "Formal tone",
      "Conservative tone",
      "Can you check this by 3?",
      "Could you please review this?",
      "We would kindly request your confirmation.",
      "Solar · tone check",
      "✓ relationship matched",
    ],
  },
  {
    ambient: ["CONTEXT", "SCENARIO", "TASK"],
    items: [
      "IT / Software",
      "Service Planner",
      "Context loaded",
      "Scenario generated",
      "New task · 09:00",
      "Role matched",
      "Daily context ready",
      "3 contacts created",
      "Work situation synced",
      "Solar · context build",
      "✓ scenario ready",
    ],
  },
  {
    ambient: ["MESSAGE", "REMINDER", "ALERT"],
    items: [
      "New message",
      "09:32 AM",
      "Unread 1",
      "Reminder scheduled",
      "30 min later",
      "Kakao alert",
      "Away mode",
      "Notification delivered",
      "Ellen · new request",
      "Jake · ping",
      "✓ received",
    ],
  },
  {
    ambient: ["FEEDBACK", "REPORT", "GROWTH"],
    items: [
      "Good expression",
      "Correction saved",
      "Weekly report",
      "+12% this week",
      "3 / 5 completed",
      "Work log synced",
      "by this afternoon",
      "share feedback",
      "Tone accuracy ↑",
      "Solar · review complete",
      "✓ report generated",
    ],
  },
  {
    ambient: ["BREATHE", "SWAMPED", "RESET"],
    items: [
      "Ugh, today was so busy...",
      "Swamped",
      "Take a break",
      "You did well today",
      "Same here",
      "You've earned your rest tonight.",
      "P.S. expression saved",
      "stress ↓",
      "one more phrase learned",
      "Workday complete",
      "✓ exhale",
    ],
  },
];

let currentSection: HTMLElement | null = null;
let currentLayer: HTMLDivElement | null = null;
let currentCards: HTMLElement[] = [];
let cardObserver: IntersectionObserver | null = null;
let activeIndex = -1;
let syncFrame = 0;

function createToken(text: string) {
  const token = document.createElement("span");
  token.className = `intro-work-stream-token${text.includes("✓") || text.includes("↑") || text.includes("↓") ? " is-status" : ""}`;

  const dot = document.createElement("i");
  dot.setAttribute("aria-hidden", "true");
  token.appendChild(dot);
  token.append(document.createTextNode(text));
  return token;
}

function fillTrack(track: HTMLElement, items: string[]) {
  track.replaceChildren();
  for (let copyIndex = 0; copyIndex < 2; copyIndex += 1) {
    const copy = document.createElement("div");
    copy.className = "intro-work-stream-copy";
    copy.setAttribute("aria-hidden", "true");
    items.forEach((item) => copy.appendChild(createToken(item)));
    track.appendChild(copy);
  }
}

function renderScene(index: number) {
  if (!currentLayer || index === activeIndex) return;
  activeIndex = index;
  const scene = STREAM_SCENES[Math.max(0, Math.min(index, STREAM_SCENES.length - 1))];

  currentLayer.classList.add("is-switching");
  currentLayer.dataset.scene = String(index + 1);

  currentLayer.querySelectorAll<HTMLElement>("[data-stream-ambient]").forEach((el, i) => {
    el.textContent = scene.ambient[i] ?? "";
  });

  currentLayer.querySelectorAll<HTMLElement>("[data-stream-track]").forEach((track, laneIndex) => {
    const shift = laneIndex * 3;
    const rotated = scene.items.map((_, itemIndex) => scene.items[(itemIndex + shift) % scene.items.length]);
    fillTrack(track, rotated);
  });

  window.setTimeout(() => currentLayer?.classList.remove("is-switching"), 180);
}

function createLayer(section: HTMLElement) {
  const layer = document.createElement("div");
  layer.className = "intro-work-stream-layer";
  layer.setAttribute("aria-hidden", "true");

  const stage = document.createElement("div");
  stage.className = "intro-work-stream-stage";

  const ambient = document.createElement("div");
  ambient.className = "intro-work-stream-ambient";
  for (let i = 0; i < 3; i += 1) {
    const word = document.createElement("b");
    word.dataset.streamAmbient = "";
    ambient.appendChild(word);
  }
  stage.appendChild(ambient);

  for (let laneIndex = 0; laneIndex < 3; laneIndex += 1) {
    const lane = document.createElement("div");
    lane.className = `intro-work-stream-lane lane-${laneIndex + 1}`;
    const track = document.createElement("div");
    track.className = "intro-work-stream-track";
    track.dataset.streamTrack = "";
    lane.appendChild(track);
    stage.appendChild(lane);
  }

  layer.appendChild(stage);
  section.prepend(layer);
  return layer;
}

function disconnectCards() {
  cardObserver?.disconnect();
  cardObserver = null;
  currentCards = [];
}

function bindCards(section: HTMLElement) {
  const nextCards = Array.from(section.querySelectorAll<HTMLElement>(CARD_SELECTOR));
  if (
    nextCards.length === currentCards.length &&
    nextCards.every((card, index) => card === currentCards[index])
  ) {
    return;
  }

  disconnectCards();
  currentCards = nextCards;
  activeIndex = -1;
  if (!currentCards.length) return;

  const ratios = new Map<HTMLElement, number>();
  currentCards.forEach((card) => ratios.set(card, 0));

  cardObserver = new IntersectionObserver(
    (entries) => {
      entries.forEach((entry) => ratios.set(entry.target as HTMLElement, entry.intersectionRatio));

      let nextIndex = 0;
      let bestRatio = -1;
      currentCards.forEach((card, index) => {
        const ratio = ratios.get(card) ?? 0;
        if (ratio > bestRatio) {
          bestRatio = ratio;
          nextIndex = index;
        }
      });

      if (bestRatio <= 0) {
        const viewportCenter = window.innerHeight / 2;
        let bestDistance = Number.POSITIVE_INFINITY;
        currentCards.forEach((card, index) => {
          const rect = card.getBoundingClientRect();
          const distance = Math.abs(rect.top + rect.height / 2 - viewportCenter);
          if (distance < bestDistance) {
            bestDistance = distance;
            nextIndex = index;
          }
        });
      }

      renderScene(nextIndex);
    },
    {
      threshold: [0, 0.1, 0.2, 0.35, 0.5, 0.65, 0.8, 1],
      rootMargin: "-12% 0px -12% 0px",
    },
  );

  currentCards.forEach((card) => cardObserver?.observe(card));
  renderScene(0);
}

function cleanup() {
  disconnectCards();
  currentLayer?.remove();
  currentLayer = null;
  currentSection = null;
  activeIndex = -1;
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

  bindCards(section);
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
  scheduleSync();
};

observeRoot();
