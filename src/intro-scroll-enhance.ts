const TARGET_SELECTOR = [
  ".intro-game-feature-window",
  ".intro-business-feature-card",
  ".intro-trial-showcase",
  ".intro-reviews",
  ".intro-final-cta",
].join(",");

let cleanupCurrent: (() => void) | null = null;
let currentPage: HTMLElement | null = null;

function targetLabel(el: HTMLElement, index: number) {
  if (el.matches(".intro-trial-showcase")) return "1분 무료체험";
  if (el.matches(".intro-reviews")) return "후기";
  if (el.matches(".intro-final-cta")) return "시작하기";
  return `WORK PROCESS ${index + 1}`;
}

function setup(page: HTMLElement) {
  const progress = document.createElement("nav");
  progress.className = "intro-global-progress";
  progress.setAttribute("aria-label", "인트로 페이지 이동");
  page.appendChild(progress);

  let targets: HTMLElement[] = [];
  let buttons: HTMLButtonElement[] = [];
  let activeIndex = 0;
  let wheelLocked = false;
  let unlockTimer = 0;

  const navHeight = () => (page.querySelector<HTMLElement>(".intro-nav")?.offsetHeight ?? 0) + 8;

  const scrollToTarget = (index: number) => {
    const target = targets[index];
    if (!target) return;
    const rect = target.getBoundingClientRect();
    const isSection = target.matches(".intro-trial-showcase,.intro-reviews,.intro-final-cta");
    const destination = isSection
      ? window.scrollY + rect.top - navHeight()
      : window.scrollY + rect.top - Math.max(navHeight(), (window.innerHeight - rect.height) / 2);
    window.scrollTo({ top: Math.max(0, destination), behavior: "smooth" });
  };

  const setActive = (index: number) => {
    if (!targets.length) return;
    activeIndex = Math.max(0, Math.min(index, targets.length - 1));
    buttons.forEach((button, i) => button.setAttribute("aria-current", i === activeIndex ? "true" : "false"));
  };

  const findNearest = () => {
    if (!targets.length) return 0;
    const viewportCenter = window.innerHeight / 2;
    let nearest = 0;
    let distance = Number.POSITIVE_INFINITY;
    targets.forEach((target, index) => {
      const rect = target.getBoundingClientRect();
      const center = rect.top + rect.height / 2;
      const nextDistance = Math.abs(center - viewportCenter);
      if (nextDistance < distance) {
        distance = nextDistance;
        nearest = index;
      }
    });
    return nearest;
  };

  const refresh = () => {
    const nextTargets = Array.from(page.querySelectorAll<HTMLElement>(TARGET_SELECTOR));
    if (nextTargets.length === targets.length && nextTargets.every((target, index) => target === targets[index])) return;

    targets = nextTargets;
    progress.replaceChildren();
    buttons = targets.map((target, index) => {
      const button = document.createElement("button");
      button.type = "button";
      button.setAttribute("aria-label", targetLabel(target, index));
      button.addEventListener("click", () => scrollToTarget(index));
      progress.appendChild(button);
      return button;
    });
    setActive(findNearest());
  };

  const onScroll = () => setActive(findNearest());

  const onWheel = (event: WheelEvent) => {
    if (window.innerWidth < 768 || event.ctrlKey || Math.abs(event.deltaY) < 16 || wheelLocked || targets.length < 2) return;

    const first = targets[0].getBoundingClientRect();
    const last = targets[targets.length - 1].getBoundingClientRect();
    const withinEnhancedRange = first.top <= window.innerHeight * 0.72 && last.bottom >= window.innerHeight * 0.28;
    if (!withinEnhancedRange) return;

    const nearest = findNearest();
    const next = event.deltaY > 0 ? Math.min(nearest + 1, targets.length - 1) : Math.max(nearest - 1, 0);
    if (next === nearest) return;

    event.preventDefault();
    wheelLocked = true;
    setActive(next);
    scrollToTarget(next);
    window.clearTimeout(unlockTimer);
    unlockTimer = window.setTimeout(() => { wheelLocked = false; }, 650);
  };

  const mutationObserver = new MutationObserver(refresh);
  mutationObserver.observe(page, { childList: true, subtree: true });
  refresh();
  window.addEventListener("scroll", onScroll, { passive: true });
  window.addEventListener("resize", refresh, { passive: true });
  window.addEventListener("wheel", onWheel, { passive: false });

  return () => {
    mutationObserver.disconnect();
    window.removeEventListener("scroll", onScroll);
    window.removeEventListener("resize", refresh);
    window.removeEventListener("wheel", onWheel);
    window.clearTimeout(unlockTimer);
    progress.remove();
  };
}

function boot() {
  const page = document.querySelector<HTMLElement>(".intro-page");
  if (page === currentPage) return;
  cleanupCurrent?.();
  cleanupCurrent = null;
  currentPage = page;
  if (page) cleanupCurrent = setup(page);
}

const rootObserver = new MutationObserver(boot);

function start() {
  boot();
  if (document.body) rootObserver.observe(document.body, { childList: true, subtree: true });
}

if (document.readyState === "loading") {
  document.addEventListener("DOMContentLoaded", start, { once: true });
} else {
  start();
}
