let introCopyObserver: MutationObserver | null = null;

function polishIntroCopy() {
  const page = document.querySelector<HTMLElement>(".intro-page");
  if (!page) return;

  const heroCopy = page.querySelector<HTMLElement>(".hero .copy > p");
  if (heroCopy && heroCopy.dataset.copyPolished !== "true") {
    heroCopy.dataset.copyPolished = "true";
    heroCopy.innerHTML = [
      '<span class="intro-hero-copy-block">메신저와 이메일로 실제 업무를 주고받으면,<br/><mark class="solar-mark">Solar</mark>가 상대와 상황에 맞는 표현과 문법을 짚어줘요.</span>',
      '<span class="intro-hero-copy-block intro-hero-copy-secondary">동료·상사·거래처마다 달라지는 말투를 익히고,<br/>잘한 표현과 교정 포인트는 퇴근 리포트에서 다시 복습해요.</span>',
    ].join("");
  }

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
