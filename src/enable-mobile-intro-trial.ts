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
  points: string[];
  screen: string;
};

const TRIAL_SELECTOR = ".intro-trial-btn, .intro-page .hero .primary, .intro-trial-main";
const OVERLAY_ID = "mobile-trial-preview";

const steps: PreviewStep[] = [
  {
    label: "홈",
    title: "출근하면 오늘의 업무가 만들어져요",
    subtitle: "온보딩에서 고른 업종·직무를 바탕으로 업무 상황과 동료·상사·거래처 연락이 구성돼요.",
    points: [
      "같은 영어라도 상대가 동료인지, 상사인지, 거래처인지에 따라 요구되는 톤이 달라져요.",
      "오늘 해야 할 연락과 업무 맥락을 먼저 보여줘서 문제집이 아니라 ‘근무를 시작하는 느낌’으로 학습해요.",
    ],
    screen: `
      <div class="mtp-appbar"><b>부캐영어</b><span>근무 중 · 09:12</span></div>
      <div class="mtp-page mtp-home">
        <div class="mtp-grid-3 mtp-home-stats">
          <div><small>근무 상태</small><b>근무 중</b></div>
          <div><small>연차</small><b>4개</b></div>
          <div><small>새 연락</small><b>3건</b></div>
        </div>
        <section class="mtp-card">
          <div class="mtp-section-title"><b>오늘의 업무 상황</b><span>DAY 01</span></div>
          <p><strong>신규 기능 QA 일정 확인</strong>과 제안서 검토가 필요한 날이에요. 동료에게는 일정 확인, 상사에게는 검토 결과, 거래처에는 최종 확인 요청을 전달해 보세요.</p>
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
    title: "메신저에서는 짧고 자연스럽게 답장해요",
    subtitle: "바로 정답을 보여주는 대신 한국어 → 단어 → 문장 뼈대 순으로 필요한 만큼 힌트를 열 수 있어요.",
    points: [
      "답장을 보내면 Solar가 문법만 보는 게 아니라 ‘동료에게 이 정도 톤이 자연스러운지’까지 같이 피드백해요.",
      "바로 답하기 어려울 때는 외근 모드로 미뤄 실제 업무처럼 30분 뒤 다시 알림을 받을 수 있어요.",
    ],
    screen: `
      <div class="mtp-appbar"><b>Messenger</b><span>Jake · 동료</span></div>
      <div class="mtp-page mtp-chat">
        <div class="mtp-chat-body">
          <div class="mtp-bubble theirs"><small>Jake · 오전 10:30</small><p>Can you check the new build by 3? 🙏</p></div>
          <div class="mtp-hint-open"><b>2단계 · 단어 힌트</b><span>check · new build · before 3 · share feedback</span></div>
          <div class="mtp-bubble mine"><p>Sure! I’ll check it and share feedback before 3.</p><small>오전 10:32</small></div>
          <div class="mtp-feedback"><b>SOLAR FEEDBACK</b><span><strong>좋아요.</strong> 동료에게 자연스럽고 간결한 표현이에요. “share feedback”도 협업 상황에서 잘 어울려요.</span></div>
        </div>
        <div class="mtp-compose">
          <div class="mtp-hints"><span>한국어 힌트</span><span>단어 힌트</span><span>🔒 문장 힌트</span></div>
          <div class="mtp-input"><span>메시지를 입력하세요</span><b>보내기</b></div>
        </div>
      </div>
    `,
  },
  {
    label: "이메일",
    title: "이메일에서는 더 격식 있는 실무 영어를 써요",
    subtitle: "메신저와 같은 상황이라도 제목·인사·본문·마무리까지 업무 메일 문맥에 맞춰 연습해요.",
    points: [
      "상사·거래처 메일에서는 단순 번역보다 요청 강도, 완곡함, 마감 표현처럼 관계에 따른 뉘앙스를 확인해요.",
      "작성 중에도 단어·문장 뼈대 힌트를 사용할 수 있고, 보낸 뒤에는 실제 작성문을 기준으로 피드백이 남아요.",
    ],
    screen: `
      <div class="mtp-appbar"><b>Email</b><span>Ellen · 상사</span></div>
      <div class="mtp-page mtp-mail">
        <section class="mtp-mail-card">
          <small>받은 메일 · 오전 11:05</small>
          <b>Proposal review request</b>
          <p>Could you please review the proposal and share your feedback by this afternoon?</p>
        </section>
        <section class="mtp-reply-card">
          <div class="mtp-reply-title"><small>회신</small><b>Re: Proposal review request</b></div>
          <div class="mtp-hints"><span>한국어</span><span>단어</span><span>문장 뼈대</span></div>
          <p>Hi Ellen,<br><br>I’ve reviewed the proposal. I’ll send my comments by this afternoon.<br><br>Best regards,</p>
          <button type="button" tabindex="-1">보내기</button>
        </section>
        <div class="mtp-feedback"><b>SOLAR FEEDBACK</b><span>상사에게 보고하는 메일로 자연스러워요. 완료 사실과 전달 시점을 명확하게 분리했어요.</span></div>
      </div>
    `,
  },
  {
    label: "리포트",
    title: "퇴근하면 답장들이 하루의 업무일지가 돼요",
    subtitle: "그날의 잘한 표현, 교정 포인트, 필수 암기 표현을 남기고 주간·월간으로 반복 패턴까지 누적해요.",
    points: [
      "일간 리포트는 실제로 내가 쓴 문장을 기준으로 ‘잘한 점 / 교정 내용 / 필수 표현’을 구체적으로 보여줘요.",
      "주간·월간 리포트에서는 반복되는 실수와 다음에 집중할 표현을 묶어서 장기적인 성장 흐름을 확인할 수 있어요.",
    ],
    screen: `
      <div class="mtp-appbar"><b>Work Report</b><span>8월 25일 · 퇴근 완료</span></div>
      <div class="mtp-page mtp-report mtp-long-screen">
        <div class="mtp-period-tabs"><b>일간</b><span>주간</span><span>월간</span></div>
        <div class="mtp-report-headline">
          <small>TODAY'S REPORT</small>
          <b>관계에 맞는 요청·보고 표현을 안정적으로 사용했어요.</b>
          <span>오늘 근무 시간 7시간 42분 · 일간 평균과 비슷하게 근무했어요</span>
        </div>
        <section class="mtp-card mtp-report-section">
          <div class="mtp-report-index"><span>01</span><b>잘한 표현</b></div>
          <div class="mtp-report-item good"><b>“I’ll check it and share feedback before 3.”</b><p>동료에게 부담 없이 일정과 후속 행동을 함께 전달했어요.</p></div>
          <div class="mtp-report-item good"><b>“I’ve reviewed the proposal.”</b><p>완료된 업무를 현재 상태와 연결해 보고할 때 자연스러운 표현이에요.</p></div>
        </section>
        <section class="mtp-card mtp-report-section">
          <div class="mtp-report-index warning"><span>02</span><b>교정 내용</b></div>
          <div class="mtp-correction"><del>I send comments this afternoon.</del><b>→ I’ll send my comments by this afternoon.</b><p>예정된 행동에는 미래 표현을 쓰고, 마감 시점은 <strong>by</strong>로 명확히 잡아주는 편이 자연스러워요.</p></div>
        </section>
        <section class="mtp-card mtp-report-section">
          <div class="mtp-report-index blue"><span>03</span><b>필수 암기 표현</b></div>
          <div class="mtp-key-grid"><div><b>share feedback</b><span>피드백을 공유하다</span></div><div><b>by this afternoon</b><span>오늘 오후까지</span></div><div><b>request confirmation</b><span>확인을 요청하다</span></div><div><b>I’ve reviewed...</b><span>검토를 완료했다</span></div></div>
        </section>
        <section class="mtp-card mtp-report-section">
          <div class="mtp-report-index"><span>04</span><b>관계별 톤</b></div>
          <div class="mtp-tone-row"><span>동료</span><b>자연스러움</b><i>캐주얼 ✓</i></div>
          <div class="mtp-tone-row"><span>상사</span><b>보고 명확함</b><i>격식 ✓</i></div>
          <div class="mtp-tone-row"><span>거래처</span><b>완곡함 유지</b><i>보수적 ✓</i></div>
        </section>
      </div>
    `,
  },
  {
    label: "출석",
    title: "근무 기록이 쌓이면 출석·연차·마일스톤도 쌓여요",
    subtitle: "하루씩 출근한 기록을 캘린더로 보고, 연속 출근과 누적 출석을 게임처럼 이어갈 수 있어요.",
    points: [
      "연속 출근 5일마다 적립연차가 +1 되고, 출석·외근·휴가 기록은 캘린더에서 구분해서 확인할 수 있어요.",
      "출석일이 쌓일수록 마일스톤이 열려 단순 학습일수보다 ‘회사 생활을 이어가는 느낌’을 만들어요.",
    ],
    screen: `
      <div class="mtp-appbar"><b>출석</b><span>2026년 8월</span></div>
      <div class="mtp-page mtp-attendance mtp-long-screen">
        <div class="mtp-grid-3">
          <div><small>현재 연속 출석</small><b>4일</b></div>
          <div><small>누적 출석</small><b>24일</b></div>
          <div><small>다음 마일스톤</small><b>30일</b></div>
        </div>
        <section class="mtp-card">
          <div class="mtp-section-title"><b>사원 → 주임</b><span>24 / 30일</span></div>
          <div class="mtp-progress"><i style="width:80%"></i></div>
          <p>6일 더 근무하면 인사평가 대상이 돼요.</p>
        </section>
        <section class="mtp-card">
          <div class="mtp-section-title"><b>적립연차</b><span>4개 적립</span></div>
          <div class="mtp-leave-segments"><i class="on"></i><i class="on"></i><i class="on"></i><i class="on"></i><i></i></div>
          <p>4/5일 — 1일 더 출근하면 적립연차 +1</p>
        </section>
        <section class="mtp-card mtp-calendar-card">
          <div class="mtp-section-title"><b>2026년 8월</b><span>이전 · 다음</span></div>
          <div class="mtp-calendar-head"><span>일</span><span>월</span><span>화</span><span>수</span><span>목</span><span>금</span><span>토</span></div>
          <div class="mtp-calendar">
            <span class="muted">26</span><span class="muted">27</span><span class="muted">28</span><span class="muted">29</span><span class="muted">30</span><span class="muted">31</span><span>1</span>
            <span>2</span><span>3</span><span>4</span><span>5</span><span>6</span><span>7</span><span>8</span>
            <span>9</span><span>10</span><span>11</span><span>12</span><span>13</span><span>14</span><span>15</span>
            <span>16</span><span>17</span><span>18</span><span>19</span><span>20</span><span>21</span><span class="attended">22</span>
            <span class="attended">23</span><span class="attended">24</span><span class="today attended">25</span><span>26</span><span>27</span><span>28</span><span>29</span>
            <span>30</span><span>31</span><span class="muted">1</span><span class="muted">2</span><span class="muted">3</span><span class="muted">4</span><span class="muted">5</span>
          </div>
          <div class="mtp-calendar-legend"><span>◎ 출근</span><span>◉ 외근</span><span>◌ 휴가</span></div>
        </section>
        <section class="mtp-card">
          <div class="mtp-section-title"><b>마일스톤</b><span>3 / 7 달성</span></div>
          <div class="mtp-badges"><span class="done">첫 출근</span><span class="done">3일 연속</span><span class="done">첫 주 완료</span><span>30일 근무</span><span>첫 승진</span></div>
        </section>
      </div>
    `,
  },
  {
    label: "승급",
    title: "30일 근무 후 인사평가를 거쳐 다음 직급으로 올라가요",
    subtitle: "사원부터 이사까지 직급이 이어지고, 전체 사용자 중 내 위치와 다음 승급까지 남은 기간을 확인할 수 있어요.",
    points: [
      "근무일을 채우면 자동 승진이 아니라 인사평가 단계가 열려 ‘회사에서 성장하는 경험’을 이어가요.",
      "승급하면 직급 캐릭터와 프로필의 분위기도 함께 변해 장기적으로 쌓인 학습 기록을 시각적으로 느낄 수 있어요.",
    ],
    screen: `
      <div class="mtp-appbar"><b>Performance Review</b><span>인사평가</span></div>
      <div class="mtp-page mtp-promotion mtp-long-screen">
        <section class="mtp-card">
          <div class="mtp-section-title"><b>전체 동료 중 내 위치</b><span>상위 18%</span></div>
          <div class="mtp-rank-line">
            <div class="active"><i>👤</i><b>사원</b></div><span>→</span>
            <div><i>👤</i><b>주임</b></div><span>→</span>
            <div><i>👤</i><b>대리</b></div><span>→</span>
            <div><i>👤</i><b>과장</b></div>
          </div>
          <div class="mtp-rank-line second">
            <div><i>👤</i><b>차장</b></div><span>→</span>
            <div><i>👤</i><b>부장</b></div><span>→</span>
            <div><i>👑</i><b>이사</b></div>
          </div>
          <p class="mtp-rank-caption">현재 직급: <strong>사원</strong> · 전체 207명 중 내 성장 위치를 함께 보여줘요.</p>
        </section>
        <section class="mtp-card mtp-review-lock">
          <div class="mtp-review-title"><span>🔒</span><b>아직 인사평가 기간이 아닙니다</b></div>
          <p>현재 사원 직급으로 <strong>24일</strong> 근무했어요. 앞으로 <strong>6일</strong> 더 근무하면 인사평가 대상이 됩니다.</p>
          <div class="mtp-progress"><i style="width:80%"></i></div>
          <small>24 / 30일</small>
        </section>
        <section class="mtp-card mtp-promotion-preview">
          <span>30일 달성 후</span>
          <b>🎉 인사평가 대상이 되었어요</b>
          <p>간단한 인사평가를 완료하면 <strong>사원 → 주임</strong>으로 승진해요.</p>
          <button type="button" tabindex="-1">인사평가 받기</button>
        </section>
        <div class="mtp-rank-note"><b>직급 성장</b><span>사원 → 주임 → 대리 → 과장 → 차장 → 부장 → 이사</span></div>
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
  const details = overlay.querySelector<HTMLElement>("[data-mtp-details]");
  const prev = overlay.querySelector<HTMLButtonElement>("[data-mtp-prev]");
  const next = overlay.querySelector<HTMLButtonElement>("[data-mtp-next]");
  if (!screenHost || !title || !subtitle || !details || !prev || !next) return;

  title.textContent = step.title;
  subtitle.textContent = step.subtitle;
  details.innerHTML = step.points.map((point) => `<p><i>✓</i><span>${point}</span></p>`).join("");
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
        <div class="mtp-details" data-mtp-details></div>
        <small>모바일에서는 서비스의 주요 화면과 흐름을 읽기 전용 미리보기로 제공해요. 실제 답장·첨삭 체험은 PC에서 이용할 수 있어요.</small>
      </div>
      <div class="mtp-tabs" role="tablist">
        ${steps.map((step, index) => `<button type="button" data-mtp-tab="${index}" role="tab">${index + 1}. ${step.label}</button>`).join("")}
      </div>
      <div class="mtp-device">
        <div class="mtp-device-speaker" aria-hidden="true"></div>
        <div class="mtp-screen" data-mtp-screen></div>
      </div>
      <div class="mtp-swipe-hint">화면을 위아래로 스크롤하거나 좌우로 넘겨보세요.</div>
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
  let touchStartY = 0;
  overlay.addEventListener("touchstart", (event) => {
    touchStartX = event.touches[0]?.clientX ?? 0;
    touchStartY = event.touches[0]?.clientY ?? 0;
  }, { passive: true });
  overlay.addEventListener("touchend", (event) => {
    const touchEndX = event.changedTouches[0]?.clientX ?? touchStartX;
    const touchEndY = event.changedTouches[0]?.clientY ?? touchStartY;
    const deltaX = touchEndX - touchStartX;
    const deltaY = touchEndY - touchStartY;
    if (Math.abs(deltaX) < 55 || Math.abs(deltaX) <= Math.abs(deltaY)) return;
    currentStep = deltaX < 0 ? Math.min(steps.length - 1, currentStep + 1) : Math.max(0, currentStep - 1);
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
