let introCopyObserver: MutationObserver | null = null;

const processCopy = [
  {
    title: "동료·상사·거래처, 다른 표현",
    body: "같은 상황도 상대에 따라 캐주얼·격식·보수적 톤으로 구분해 배워요.\n대화가 쌓일수록 더 고도화돼요.",
  },
  {
    title: "내 업종·직무 맞춤 시나리오",
    body: "업종·직무만 입력하면 나만의 동료·상사·거래처가\n매일 자동으로 생겨서 대화할 수 있어요.",
  },
  {
    title: "웹·카카오톡으로 놓치지 않는 알림",
    body: "새 업무 연락과 리마인더를 웹과 카카오톡으로 받을 수 있어요.\n바쁠 때는 '외근 중'으로 미루면 30분 뒤 다시 알려드려요.",
  },
  {
    title: "하루·주간·월간 리포트",
    body: "퇴근 리포트부터 매주·매달 성장 흐름까지 정리해드려요.",
  },
  {
    title: "스트레스 받을 때는, 고함항아리에 소리질러봐요!",
    body: "영어를 배우는 걸 넘어서, 영어로 솔직하게 털어놓을 수 있는\n스트레스 공유 동료가 생겨요.\n바쁜 하루가 감지되면 먼저 위로와 표현을 건네고,\n내가 먼저 말을 걸 수도 있어요.",
  },
] as const;

function renderProcessBody(body: HTMLElement, copy: string) {
  const lines = copy.split("\n");
  const expectedText = lines.join("\n");
  const currentText = body.innerText.replace(/\r/g, "");
  const hasExpectedBreakCount = body.querySelectorAll(":scope > br").length === Math.max(0, lines.length - 1);

  // 과거 QA 패치가 남긴 inline white-space가 CSS 레이아웃을 덮어쓰지 않게 제거한다.
  if (body.style.getPropertyValue("white-space")) {
    body.style.removeProperty("white-space");
  }

  if (currentText === expectedText && hasExpectedBreakCount) return;

  const nodes: Node[] = [];
  lines.forEach((line, index) => {
    if (index > 0) nodes.push(document.createElement("br"));
    nodes.push(document.createTextNode(line));
  });

  body.replaceChildren(...nodes);
  body.dataset.processCopyQa = "applied";
}

function polishProcessCopy(page: HTMLElement) {
  const cards = page.querySelectorAll<HTMLElement>(".intro-game-feature-window, .intro-business-feature-card");

  cards.forEach((card, index) => {
    const copy = processCopy[index];
    if (!copy) return;

    const paragraphs = card.querySelectorAll<HTMLElement>("p");
    const title = paragraphs.item(0);
    const body = paragraphs.item(1);
    if (!title || !body) return;

    if (title.textContent !== copy.title) title.textContent = copy.title;
    renderProcessBody(body, copy.body);
  });
}

function polishMobilePreviewCopy() {
  const heading = document.querySelector<HTMLElement>(".intro-device-preview-head b");
  const subheading = document.querySelector<HTMLElement>(".intro-device-preview-head span");
  const note = document.querySelector<HTMLElement>(".intro-device-preview-note");

  if (heading && heading.textContent !== "모바일 화면 미리보기") {
    heading.textContent = "모바일 화면 미리보기";
  }
  if (subheading && subheading.textContent !== "390px 화면 기준") {
    subheading.textContent = "390px 화면 기준";
  }
  if (note && note.textContent !== "모바일에서 보이는 화면과 1분 무료체험 흐름을 미리 확인해보세요.") {
    note.textContent = "모바일에서 보이는 화면과 1분 무료체험 흐름을 미리 확인해보세요.";
  }

  const mobilePickerCopy = document.querySelector<HTMLElement>('[data-preview-device="mobile"] span');
  if (mobilePickerCopy && mobilePickerCopy.textContent !== "모바일 화면 미리보기") {
    mobilePickerCopy.textContent = "모바일 화면 미리보기";
  }
}

function polishIntroAboutLink(page: HTMLElement) {
  const navGroup = page.querySelector<HTMLElement>(".intro-nav-inner > div:last-child > div:first-child");
  const sampleNavLink = navGroup?.querySelector<HTMLElement>(".intro-nav-link:not(.intro-about-link)");
  if (!navGroup || !sampleNavLink) return;

  let aboutLink = navGroup.querySelector<HTMLAnchorElement>(".intro-about-link");
  const expectedClassName = `${sampleNavLink.className} intro-about-link`;

  if (!aboutLink) {
    aboutLink = document.createElement("a");
    aboutLink.href = "https://www.idealwhy.com";
    aboutLink.textContent = "About";
    aboutLink.setAttribute("aria-label", "About · 외부 사이트로 이동");
    aboutLink.className = expectedClassName;
  }

  if (aboutLink.href !== "https://www.idealwhy.com/") {
    aboutLink.href = "https://www.idealwhy.com";
  }
  if (aboutLink.textContent !== "About") {
    aboutLink.textContent = "About";
  }
  if (aboutLink.className !== expectedClassName) {
    aboutLink.className = expectedClassName;
  }

  aboutLink.onclick = (event) => {
    event.preventDefault();
    const shouldLeave = window.confirm(
      "WorkMate English를 만든 제작자의 개인 브랜드 페이지로 연결돼요.\nidealwhy.com으로 이동할까요?",
    );
    if (shouldLeave) window.location.assign("https://www.idealwhy.com");
  };

  if (navGroup.firstElementChild !== aboutLink) {
    navGroup.insertBefore(aboutLink, navGroup.firstElementChild);
  }
}

function polishIntroCopy() {
  const page = document.querySelector<HTMLElement>(".intro-page");
  if (!page) return;

  polishIntroAboutLink(page);

  // 비즈니스 모드의 모바일 히어로만 문장을 짧게 잘라 의도한 줄바꿈을 고정한다.
  // 데스크톱과 게임 모드는 기존 문구/레이아웃을 그대로 유지한다.
  const isBusinessMobile = page.classList.contains("intro-business") && window.innerWidth < 768;
  const heroTitle = page.querySelector<HTMLElement>(".hero .copy > h1");
  const heroTitleVariant = isBusinessMobile ? "business-mobile" : "default";
  if (heroTitle && heroTitle.dataset.copyVariant !== heroTitleVariant) {
    heroTitle.dataset.copyVariant = heroTitleVariant;
    heroTitle.innerHTML = isBusinessMobile
      ? '영어 공부 대신,<br/><em><span class="headline-wiggle">영어로 출근해 보세요.</span></em>'
      : '영어를 배우는 대신,<br/><em><span class="headline-wiggle">영어로 출근</span></em>해 보세요.';
  }

  const heroCopy = page.querySelector<HTMLElement>(".hero .copy > p");
  const heroCopyVariant = isBusinessMobile ? "business-mobile" : "default";
  if (heroCopy && heroCopy.dataset.copyPolished !== heroCopyVariant) {
    heroCopy.dataset.copyPolished = heroCopyVariant;
    heroCopy.innerHTML = isBusinessMobile
      ? [
          '<span class="intro-hero-copy-block">메신저와 이메일로 실제 업무를 처리하면,<br/><mark class="solar-mark">Solar</mark>가 관계별 표현과 문법을 첨삭해요.</span>',
          '<span class="intro-hero-copy-block intro-hero-copy-secondary">잘한 표현과 교정 포인트는<br/>퇴근 리포트에서 다시 복습할 수 있어요.</span>',
        ].join("")
      : [
          '<span class="intro-hero-copy-block">메신저와 이메일로 실제 업무를 처리하면, <mark class="solar-mark">Solar</mark>가 관계별 표현과 문법을 첨삭하고 하루의 성장을 업무 리포트로 남겨요.</span>',
          '<span class="intro-hero-copy-block intro-hero-copy-secondary">동료·상사·거래처마다 달라지는 말투까지 익히고, 잘한 표현과<br/>교정 포인트는 퇴근 후 다시 복습할 수 있어요.</span>',
        ].join("");
  }

  polishProcessCopy(page);
  polishMobilePreviewCopy();

  const finalHeading = page.querySelector<HTMLElement>(".intro-final-cta h2");
  if (finalHeading && finalHeading.dataset.copyPolished !== "true") {
    finalHeading.dataset.copyPolished = "true";
    finalHeading.textContent = "실무 영어, 오늘 한 건부터 시작해 보세요.";
  }

  const finalCopy = document.querySelector<HTMLElement>(".intro-final-copy");
  if (finalCopy && finalCopy.dataset.copyPolished !== "true") {
    finalCopy.dataset.copyPolished = "true";
    finalCopy.textContent = "메신저와 이메일을 주고받으며 자연스럽게 업무 영어를 쌓아가세요.";
  }
}

function startIntroCopyPolish() {
  polishIntroCopy();
  if (!document.body || introCopyObserver) return;

  introCopyObserver = new MutationObserver(polishIntroCopy);
  introCopyObserver.observe(document.body, {
    childList: true,
    subtree: true,
    characterData: true,
  });
}

if (document.readyState === "loading") {
  document.addEventListener("DOMContentLoaded", startIntroCopyPolish, { once: true });
} else {
  startIntroCopyPolish();
}
