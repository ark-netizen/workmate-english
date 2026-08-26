const TARGET_SELECTOR = [
  ".intro-game-features > div:not(.intro-game-flutter-layer):not(.fixed) > .snap-center",
  ".intro-business-features > div:not(.fixed) > .snap-center",
  ".intro-trial-showcase",
  ".intro-reviews",
  ".intro-final-cta",
].join(",");

let cleanupCurrent: (() => void) | null = null;
let currentPage: HTMLElement | null = null;

function isTouchPrimaryExperience() {
  const narrowViewport = window.matchMedia("(max-width: 767px)").matches;
  const coarsePointer = window.matchMedia("(pointer: coarse)").matches;
  const noHover = window.matchMedia("(hover: none)").matches;
  const touchCapable = navigator.maxTouchPoints > 0;
  return narrowViewport || coarsePointer || (touchCapable && noHover);
}

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
  let previewPicker: HTMLDivElement | null = null;
  let devicePreview: HTMLDivElement | null = null;
  const navListenerCleanup: Array<() => void> = [];

  const navHeight = () => (page.querySelector<HTMLElement>(".intro-nav")?.offsetHeight ?? 0) + 8;

  const syncNavOffset = () => {
    page.style.setProperty("--intro-nav-offset", `${navHeight()}px`);
  };

  const getNamedTarget = (id: "preview" | "features" | "reviews") => {
    if (id === "preview") return page.querySelector<HTMLElement>("#preview .wrap") ?? page.querySelector<HTMLElement>("#preview");
    if (id === "features") return page.querySelector<HTMLElement>("#features .intro-process-heading") ?? page.querySelector<HTMLElement>("#features");
    return page.querySelector<HTMLElement>("#reviews > div") ?? page.querySelector<HTMLElement>("#reviews");
  };

  const scrollElementToNav = (target: HTMLElement, extraGap = 14) => {
    const rect = target.getBoundingClientRect();
    const destination = window.scrollY + rect.top - navHeight() - extraGap;
    window.scrollTo({ top: Math.max(0, destination), behavior: "smooth" });
  };

  const scrollToNamedSection = (id: "preview" | "features" | "reviews") => {
    const target = getNamedTarget(id);
    if (target) scrollElementToNav(target, id === "preview" ? 8 : 16);
  };

  const scrollToTarget = (index: number) => {
    const target = targets[index];
    if (!target) return;

    const rect = target.getBoundingClientRect();
    const topInset = navHeight();
    const usableHeight = Math.max(1, window.innerHeight - topInset);
    const targetCenter = window.scrollY + rect.top + rect.height / 2;
    const viewportCenter = topInset + usableHeight / 2;
    const destination = targetCenter - viewportCenter;

    window.scrollTo({ top: Math.max(0, destination), behavior: "smooth" });
  };

  const closePreviewPicker = () => {
    previewPicker?.remove();
    previewPicker = null;
  };

  const closeDevicePreview = () => {
    devicePreview?.remove();
    devicePreview = null;
    document.body.classList.remove("intro-device-preview-open");
  };

  const openMobileDevicePreview = () => {
    closePreviewPicker();
    closeDevicePreview();

    const overlay = document.createElement("div");
    overlay.className = `intro-device-preview-overlay ${page.classList.contains("intro-game") ? "is-game" : "is-business"}`;
    overlay.setAttribute("role", "dialog");
    overlay.setAttribute("aria-modal", "true");
    overlay.setAttribute("aria-label", "부캐영어 모바일 반응형 미리보기");

    const previewUrl = new URL(window.location.href);
    previewUrl.hash = "";
    previewUrl.searchParams.set("devicePreview", "mobile");

    overlay.innerHTML = `
      <div class="intro-device-preview-shell">
        <div class="intro-device-preview-head">
          <div><b>모바일 반응형 미리보기</b><span>실제 모바일 레이아웃 · 390px 기준</span></div>
          <button type="button" data-device-preview-close aria-label="모바일 미리보기 닫기">×</button>
        </div>
        <div class="intro-device-preview-note">모바일에서도 인트로와 1분 무료체험 미리보기를 따로 설계했어요. 아래 화면은 이미지가 아니라 실제 반응형 페이지예요.</div>
        <div class="intro-device-preview-phone">
          <div class="intro-device-preview-speaker" aria-hidden="true"></div>
          <iframe title="부캐영어 모바일 화면" src="${previewUrl.toString()}" loading="eager"></iframe>
        </div>
      </div>
    `;

    overlay.addEventListener("click", (event) => {
      const target = event.target instanceof Element ? event.target : null;
      if (!target) return;
      if (target === overlay || target.closest("[data-device-preview-close]")) closeDevicePreview();
    });

    devicePreview = overlay;
    document.body.classList.add("intro-device-preview-open");
    document.body.appendChild(overlay);
    overlay.querySelector<HTMLButtonElement>("[data-device-preview-close]")?.focus();
  };

  const openPreviewPicker = (trigger: HTMLButtonElement) => {
    if (previewPicker) {
      closePreviewPicker();
      return;
    }

    const picker = document.createElement("div");
    picker.className = `intro-preview-picker ${page.classList.contains("intro-game") ? "is-game" : "is-business"}`;
    picker.setAttribute("role", "menu");
    picker.innerHTML = `
      <button type="button" data-preview-device="pc" role="menuitem">
        <b>PC 화면</b><span>데스크톱 미리보기로 이동</span>
      </button>
      <button type="button" data-preview-device="mobile" role="menuitem">
        <b>모바일 화면</b><span>실제 반응형 모바일 UI 보기</span>
      </button>
    `;

    const rect = trigger.getBoundingClientRect();
    const pickerWidth = Math.min(236, window.innerWidth - 24);
    const left = Math.max(12, Math.min(window.innerWidth - pickerWidth - 12, rect.left + rect.width / 2 - pickerWidth / 2));
    picker.style.width = `${pickerWidth}px`;
    picker.style.left = `${left}px`;
    picker.style.top = `${rect.bottom + 8}px`;

    picker.addEventListener("click", (event) => {
      const target = event.target instanceof Element ? event.target.closest<HTMLElement>("[data-preview-device]") : null;
      if (!target) return;
      if (target.dataset.previewDevice === "mobile") openMobileDevicePreview();
      else {
        closePreviewPicker();
        scrollToNamedSection("preview");
      }
    });

    previewPicker = picker;
    document.body.appendChild(picker);
  };

  const enhanceNavLinks = () => {
    page.querySelectorAll<HTMLButtonElement>(".intro-nav-link").forEach((button) => {
      if (button.dataset.introNavEnhanced === "true") return;
      const label = button.textContent?.trim();
      if (!label || !["미리보기", "기능", "후기"].includes(label)) return;

      const handler = (event: MouseEvent) => {
        event.preventDefault();
        event.stopPropagation();
        if (label === "미리보기") {
          // 실제 모바일/폴더블에서 다시 '모바일 화면' iframe을 여는 중첩 미리보기는 불필요하다.
          // 현재 인트로의 미리보기 영역으로 바로 이동하고, PC에서만 기기 선택 메뉴를 제공한다.
          if (isTouchPrimaryExperience()) {
            closePreviewPicker();
            scrollToNamedSection("preview");
          } else {
            openPreviewPicker(button);
          }
        } else {
          closePreviewPicker();
          scrollToNamedSection(label === "기능" ? "features" : "reviews");
        }
      };

      button.dataset.introNavEnhanced = "true";
      button.addEventListener("click", handler);
      navListenerCleanup.push(() => {
        button.removeEventListener("click", handler);
        delete button.dataset.introNavEnhanced;
      });
    });

    const heroFeatureButton = page.querySelector<HTMLButtonElement>(".hero .secondary");
    if (heroFeatureButton && heroFeatureButton.dataset.introNavEnhanced !== "true") {
      const handler = (event: MouseEvent) => {
        event.preventDefault();
        event.stopPropagation();
        scrollToNamedSection("features");
      };
      heroFeatureButton.dataset.introNavEnhanced = "true";
      heroFeatureButton.addEventListener("click", handler);
      navListenerCleanup.push(() => heroFeatureButton.removeEventListener("click", handler));
    }
  };

  const setActive = (index: number) => {
    if (!targets.length) return;
    activeIndex = Math.max(0, Math.min(index, targets.length - 1));
    buttons.forEach((button, i) => button.setAttribute("aria-current", i === activeIndex ? "true" : "false"));
  };

  const findNearest = () => {
    if (!targets.length) return 0;
    const viewportTop = navHeight();
    const viewportCenter = viewportTop + (window.innerHeight - viewportTop) / 2;
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
    syncNavOffset();
    enhanceNavLinks();
    const nextTargets = Array.from(page.querySelectorAll<HTMLElement>(TARGET_SELECTOR));
    if (nextTargets.length === targets.length && nextTargets.every((target, index) => target === targets[index])) {
      setActive(findNearest());
      return;
    }

    targets = nextTargets;
    progress.replaceChildren();
    buttons = targets.map((target, index) => {
      const button = document.createElement("button");
      button.type = "button";
      button.setAttribute("aria-label", targetLabel(target, index));
      button.setAttribute("aria-posinset", String(index + 1));
      button.setAttribute("aria-setsize", String(targets.length));
      button.title = targetLabel(target, index);
      button.addEventListener("click", () => scrollToTarget(index));
      progress.appendChild(button);
      return button;
    });
    setActive(findNearest());
  };

  const onScroll = () => {
    closePreviewPicker();
    setActive(findNearest());
  };

  const onResize = () => {
    closePreviewPicker();
    syncNavOffset();
    refresh();
  };

  const onDocumentPointerDown = (event: PointerEvent) => {
    const target = event.target instanceof Element ? event.target : null;
    if (!previewPicker || !target) return;
    if (previewPicker.contains(target) || target.closest(".intro-nav-link")) return;
    closePreviewPicker();
  };

  const onKeyDown = (event: KeyboardEvent) => {
    if (event.key !== "Escape") return;
    if (devicePreview) closeDevicePreview();
    else closePreviewPicker();
  };

  const onWheel = (event: WheelEvent) => {
    // 펼친 폴드/작은 태블릿은 폭이 768px을 넘어도 모바일형 레이아웃이다.
    // 마우스나 트랙패드가 연결돼도 데스크톱 카드 스냅을 강제하지 않고 자연 스크롤을 유지한다.
    if (isTouchPrimaryExperience() || event.ctrlKey || Math.abs(event.deltaY) < 16 || wheelLocked || targets.length < 2) return;

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
    unlockTimer = window.setTimeout(() => { wheelLocked = false; }, 720);
  };

  const mutationObserver = new MutationObserver(refresh);
  mutationObserver.observe(page, { childList: true, subtree: true });
  refresh();
  window.addEventListener("scroll", onScroll, { passive: true });
  window.addEventListener("resize", onResize, { passive: true });
  window.addEventListener("wheel", onWheel, { passive: false });
  document.addEventListener("pointerdown", onDocumentPointerDown, true);
  document.addEventListener("keydown", onKeyDown);

  return () => {
    mutationObserver.disconnect();
    window.removeEventListener("scroll", onScroll);
    window.removeEventListener("resize", onResize);
    window.removeEventListener("wheel", onWheel);
    document.removeEventListener("pointerdown", onDocumentPointerDown, true);
    document.removeEventListener("keydown", onKeyDown);
    navListenerCleanup.splice(0).forEach((cleanup) => cleanup());
    closePreviewPicker();
    closeDevicePreview();
    window.clearTimeout(unlockTimer);
    page.style.removeProperty("--intro-nav-offset");
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
