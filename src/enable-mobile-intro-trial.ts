/*
 * 모바일에서는 실제 1분 체험 앱을 억지로 구동하지 않는다.
 * 실서비스 화면은 데스크톱 기준으로 설계되어 안내 카드/입력창/탭바가 서로 겹칠 수 있으므로,
 * Intro의 1분 체험 CTA를 누르면 모바일 전용 '읽기 전용 미리보기'를 연다.
 * 데스크톱에서는 기존 React 체험 시작 로직을 그대로 사용한다.
 */

type PreviewStep = {
  label: string;
  title: string;
  subtitle: string;
  screen: string;
};

const TRIAL_SELECTOR = ".intro-trial-btn, .intro-page .hero .primary, .intro-trial-main";
const OVERLAY_ID = "mobile-trial-preview";

const steps: PreviewStep[] = [
  {
    label: "홈",
    title: "오늘의 업무를 확인해요",
    subtitle: "업무 상황과 동료·상사·거래처 연락이 한눈에 보여요.",
    screen: `
      <div class="mtp-appbar"><b>부캐영어</b><span>근무 중</span></div>
      <div class="mtp-page mtp-home">
        <div class="mtp-grid-2">
          <div class="mtp-stat"><small>근무 상태</small><b>근무 중</b></div>
          <div class="mtp-stat"><small>읽지 않은 메시지</small><b>3건</b></div>
        </div>
        <section class="mtp-card">
          <div class="mtp-section-title"><b>오늘의 업무 상황</b><span>DAY 01</span></div>
          <p>신규 기능 QA 일정 확인과 제안서 검토가 필요한 날이에요.</p>
        </section>
        <section class="mtp-card">
          <div class="mtp-section-title"><b>오늘의 연락</b><span>3</span></div>
          <div class="mtp-contact"><i>J</i><div><b>Jake · 동료</b><span>Can you check the new build by 3? 🙏</span></div><em>캐주얼</em></div>
          <div class="mtp-contact"><i>E</i><div><b>Ellen · 상사</b><span>Could you please review the proposal?</span></div><em>격식</em></div>
          <div class="mtp-contact"><i>L</i><div><b>Liam · 거래처</b><span>We would kindly request your confirmation.</span></div><em>보수적</em></div>
        </section>
      </div>
    `,
  },
  {
    label: "메신저",
    title: "메신저로 실제처럼 답장해요",
    subtitle: "관계에 맞는 표현을 보고 힌트를 활용하는 흐름을 확인할 수 있어요.",
    screen: `
      <div class="mtp-appbar"><b>Messenger</b><span>Jake · 동료</span></div>
      <div class="mtp-page mtp-chat">
        <div class="mtp-chat-body">
          <div class="mtp-bubble theirs"><small>Jake · 오전 10:30</small><p>Can you check the new build by 3? 🙏</p></div>
          <div class="mtp-bubble mine"><p>Sure! I’ll check it and share feedback before 3.</p><small>오전 10:32</small></div>
          <div class="mtp-feedback"><b>SOLAR FEEDBACK</b><span>동료에게 자연스럽고 간결한 표현이에요.</span></div>
        </div>
        <div class="mtp-compose">
          <div class="mtp-hints"><span>한국어 힌트</span><span>🔒 단어 힌트</span><span>🔒 문장 힌트</span></div>
          <div class="mtp-input"><span>메시지를 입력하세요</span><b>보내기</b></div>
        </div>
      </div>
    `,
  },
  {
    label: "이메일",
    title: "메일에서는 더 격식 있게 써봐요",
    subtitle: "제목·본문·힌트·첨삭 흐름을 모바일에서도 미리 볼 수 있어요.",
    screen: `
      <div class="mtp-appbar"><b>Email</b><span>Ellen · 상사</span></div>
      <div class="mtp-page mtp-mail">
        <section class="mtp-mail-card">
          <small>받은 메일</small>
          <b>Proposal review request</b>
          <p>Could you please review the proposal and share your feedback by this afternoon?</p>
        </section>
        <section class="mtp-reply-card">
          <div class="mtp-reply-title"><small>회신</small><b>Re: Proposal review request</b></div>
          <div class="mtp-hints"><span>본문 힌트</span><span>단어</span><span>문장 뼈대</span></div>
          <p>I’ve reviewed the proposal. I’ll send my comments by this afternoon.</p>
          <button type="button" tabindex="-1">보내기</button>
        </section>
      </div>
    `,
  },
  {
    label: "리포트",
    title: "퇴근하면 오늘의 성장이 남아요",
    subtitle: "잘한 점·교정 내용·필수 표현이 업무 리포트로 정리돼요.",
    screen: `
      <div class="mtp-appbar"><b>Work Report</b><span>DAY 01 완료</span></div>
      <div class="mtp-page mtp-report">
        <div class="mtp-grid-3">
          <div><small>잘한 점</small><b>3</b></div>
          <div><small>교정 내용</small><b>2</b></div>
          <div><small>필수 암기</small><b>4</b></div>
        </div>
        <section class="mtp-card">
          <div class="mtp-section-title"><b>오늘의 피드백</b><span>SOLAR</span></div>
          <p>동료에게는 자연스럽고 간결하게, 상사와 거래처에는 격식을 높여 표현했어요.</p>
        </section>
        <section class="mtp-card mtp-report-list">
          <b>오늘 익힌 표현</b>
          <p><span>01</span> I’ll check it and share feedback.</p>
          <p><span>02</span> I’ve reviewed the proposal.</p>
          <p><span>03</span> We would appreciate your confirmation.</p>
        </section>
      </div>
    `,
  },
];

let currentStep = 0;
let previousOverflow = "";

function isMobile() {
  return window.matchMedia("(max-width: 767px)").matches;
}

function isGameMode() {
  return document.querySelector(".intro-page")?.classList.contains("intro-game") ?? true;
}

function renderStep(overlay: HTMLElement) {
  const step = steps[currentStep];
  const screenHost = overlay.querySelector<HTMLElement>("[data-mtp-screen]");
  const title = overlay.querySelector<HTMLElement>("[data-mtp-title]");
  const subtitle = overlay.querySelector<HTMLElement>("[data-mtp-subtitle]");
  const prev = overlay.querySelector<HTMLButtonElement>("[data-mtp-prev]");
  const next = overlay.querySelector<HTMLButtonElement>("[data-mtp-next]");
  if (!screenHost || !title || !subtitle || !prev || !next) return;

  title.textContent = step.title;
  subtitle.textContent = step.subtitle;
  screenHost.innerHTML = step.screen;
  prev.disabled = currentStep === 0;
  next.textContent = currentStep === steps.length - 1 ? "인트로로 돌아가기" : "다음 화면";

  overlay.querySelectorAll<HTMLElement>("[data-mtp-tab]").forEach((tab, index) => {
    tab.classList.toggle("is-active", index === currentStep);
    tab.setAttribute("aria-current", index === currentStep ? "step" : "false");
  });
  overlay.querySelectorAll<HTMLElement>("[data-mtp-dot]").forEach((dot, index) => {
    dot.classList.toggle("is-active", index === currentStep);
  });

  screenHost.scrollTop = 0;
}

function closePreview() {
  document.getElementById(OVERLAY_ID)?.remove();
  document.body.style.overflow = previousOverflow;
}

function createPreview() {
  const gameMode = isGameMode();
  const overlay = document.createElement("div");
  overlay.id = OVERLAY_ID;
  overlay.className = `mobile-trial-preview ${gameMode ? "is-game" : "is-business"}`;
  overlay.setAttribute("role", "dialog");
  overlay.setAttribute("aria-modal", "true");
  overlay.setAttribute("aria-label", "1분 무료체험 모바일 미리보기");
  overlay.innerHTML = `
    <header class="mtp-header">
      <div class="mtp-brand"><b>부캐영어</b><small>WorkMate English</small></div>
      <button type="button" class="mtp-close" data-mtp-close aria-label="미리보기 닫기">×</button>
    </header>
    <main class="mtp-main">
      <div class="mtp-intro">
        <span>1-MINUTE FREE TRIAL · MOBILE PREVIEW</span>
        <h2 data-mtp-title></h2>
        <p data-mtp-subtitle></p>
        <small>모바일에서는 화면 흐름을 미리보기로 제공해요. 실제 답장·첨삭 체험은 PC에서 이용할 수 있어요.</small>
      </div>
      <div class="mtp-tabs" role="tablist">
        ${steps.map((step, index) => `<button type="button" data-mtp-tab="${index}" role="tab">${index + 1}. ${step.label}</button>`).join("")}
      </div>
      <div class="mtp-device">
        <div class="mtp-device-speaker" aria-hidden="true"></div>
        <div class="mtp-screen" data-mtp-screen></div>
      </div>
      <div class="mtp-dots" aria-hidden="true">
        ${steps.map((_, index) => `<i data-mtp-dot="${index}"></i>`).join("")}
      </div>
    </main>
    <footer class="mtp-footer">
      <button type="button" data-mtp-prev>이전</button>
      <button type="button" data-mtp-next>다음 화면</button>
    </footer>
  `;

  overlay.addEventListener("click", (event) => {
    const target = event.target instanceof Element ? event.target : null;
    if (!target) return;
    if (target.closest("[data-mtp-close]")) {
      closePreview();
      return;
    }
    const tab = target.closest<HTMLElement>("[data-mtp-tab]");
    if (tab) {
      currentStep = Number(tab.dataset.mtpTab ?? 0);
      renderStep(overlay);
      return;
    }
    if (target.closest("[data-mtp-prev]")) {
      currentStep = Math.max(0, currentStep - 1);
      renderStep(overlay);
      return;
    }
    if (target.closest("[data-mtp-next]")) {
      if (currentStep === steps.length - 1) {
        closePreview();
      } else {
        currentStep += 1;
        renderStep(overlay);
      }
    }
  });

  let touchStartX = 0;
  overlay.addEventListener("touchstart", (event) => {
    touchStartX = event.touches[0]?.clientX ?? 0;
  }, { passive: true });
  overlay.addEventListener("touchend", (event) => {
    const touchEndX = event.changedTouches[0]?.clientX ?? touchStartX;
    const delta = touchEndX - touchStartX;
    if (Math.abs(delta) < 55) return;
    currentStep = delta < 0 ? Math.min(steps.length - 1, currentStep + 1) : Math.max(0, currentStep - 1);
    renderStep(overlay);
  }, { passive: true });

  return overlay;
}

function openPreview() {
  document.getElementById(OVERLAY_ID)?.remove();
  currentStep = 0;
  previousOverflow = document.body.style.overflow;
  document.body.style.overflow = "hidden";
  const overlay = createPreview();
  document.body.appendChild(overlay);
  renderStep(overlay);
  overlay.querySelector<HTMLButtonElement>("[data-mtp-close]")?.focus();
}

if (typeof window !== "undefined" && typeof document !== "undefined") {
  document.addEventListener(
    "click",
    (event) => {
      if (!isMobile()) return;
      const target = event.target instanceof Element ? event.target.closest(TRIAL_SELECTOR) : null;
      if (!target) return;
      event.preventDefault();
      event.stopPropagation();
      event.stopImmediatePropagation();
      openPreview();
    },
    true,
  );
}
