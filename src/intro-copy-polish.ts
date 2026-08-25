let introCopyObserver: MutationObserver | null = null;

const processCopy = [
  {
    title: "동료·상사·거래처, 다른 표현",
    body: "같은 상황도 상대에 따라 캐주얼·격식·보수적 톤을 구분해 배우고, 대화가 쌓일수록 더 고도화돼요.",
  },
  {
    title: "내 업종·직무 맞춤 시나리오",
    body: "업종·직무만 입력하면 나만의 동료·상사·거래처가 매일 자동으로 생겨요.",
  },
  {
    title: "웹·카카오톡으로 놓치지 않는 알림",
    body: "새 업무 연락과 리마인더를 웹과 카카오톡으로 받을 수 있어요. 바쁠 때는 '외근 중'으로 미루면 30분 뒤 다시 알려드려요.",
  },
  {
    title: "하루·주간·월간 리포트",
    body: "퇴근 리포트부터 매주·매달 성장 흐름까지 정리해드려요.",
  },
  {
    title: "스트레스 받을 때는, 고함항아리에 소리질러봐요!",
    body: "영어를 배우는 걸 넘어서, 영어로 솔직하게 털어놓을 수 있는 스트레스 공유 동료가 생겨요. 바쁜 하루가 감지되면 먼저 위로와 표현을 건네고, 내가 먼저 말을 걸 수도 있어요.",
  },
] as const;

function polishProcessCopy(page: HTMLElement) {
  const cards = page.querySelectorAll<HTMLElement>(".intro-game-feature-window, .intro-business-feature-card");

  cards.forEach((card, index) => {
    const copy = processCopy[index];
    if (!copy || card.dataset.processCopyPolished === "true") return;

    const isGameCard = card.classList.contains("intro-game-feature-window");
    const title = isGameCard
      ? card.querySelector<HTMLElement>(":scope > div:last-child > div:first-child > p:first-of-type")
      : card.querySelector<HTMLElement>(":scope > div:first-child > p:first-of-type");
    const body = isGameCard
      ? card.querySelector<HTMLElement>(":scope > div:last-child > div:first-child > p:nth-of-type(2)")
      : card.querySelector<HTMLElement>(":scope > div:first-child > p:nth-of-type(2)");

    if (!title || !body) return;

    title.textContent = copy.title;
    body.textContent = copy.body;
    card.dataset.processCopyPolished = "true";
  });
}

function polishIntroCopy() {
  const page = document.querySelector<HTMLElement>(".intro-page");
  if (!page) return;

  const heroCopy = page.querySelector<HTMLElement>(".hero .copy > p");
  if (heroCopy && heroCopy.dataset.copyPolished !== "true") {
    heroCopy.dataset.copyPolished = "true";
    heroCopy.innerHTML = [
      '<span class="intro-hero-copy-block">메신저와 이메일로 실제 업무를 처리하면, <mark class="solar-mark">Solar</mark>가 관계별 표현과 문법을 첨삭하고 하루의 성장을 업무 리포트로 남겨요.</span>',
      '<span class="intro-hero-copy-block intro-hero-copy-secondary">동료·상사·거래처마다 달라지는 말투까지 익히고, 잘한 표현과<br/>교정 포인트는 퇴근 후 다시 복습할 수 있어요.</span>',
    ].join("");
  }

  polishProcessCopy(page);

  const finalHeading = page.querySelector<HTMLElement>(".intro-final-cta h2");
  if (finalHeading && finalHeading.dataset.copyPolished !== "true") {
    finalHeading.dataset.copyPolished = "true";
    finalHeading.textContent = "실무 영어, 오늘 한 건부터 시작해 보세요.";
  }

  const finalCopy = page.querySelector<HTMLElement>(".intro-final-copy");
  if (finalCopy && finalCopy.dataset.copyPolished !== "true") {
    finalCopy.dataset.copyPolished = "true";
    finalCopy.textContent = "메신저와 이메일을 주고받으며 자연스럽게 업무 영어를 쌓아가세요.";
  }
}

function startIntroCopyPolish() {
  polishIntroCopy();
  if (!document.body || introCopyObserver) return;
  introCopyObserver = new MutationObserver(polishIntroCopy);
  introCopyObserver.observe(document.body, { childList: true, subtree: true });
}

if (document.readyState === "loading") {
  document.addEventListener("DOMContentLoaded", startIntroCopyPolish, { once: true });
} else {
  startIntroCopyPolish();
}
