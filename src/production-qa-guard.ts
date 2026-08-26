// Production safety guard for internal QA-only controls.
// They remain available in local development and intentional production QA (?qa=1),
// but must not appear for ordinary signed-in users.

function qaUiEnabled() {
  if (import.meta.env.DEV) return true;
  const params = new URLSearchParams(window.location.search);
  return params.get("qa") === "1";
}

function hideProductionQaControls() {
  if (qaUiEnabled()) return;

  // HomePage's fixed QA controller/collapsed button.
  document.querySelectorAll<HTMLElement>(".fixed.right-3.top-20.z-40").forEach((element) => {
    const text = element.textContent ?? "";
    if (text.includes("QA 도구") || text.trim() === "QA") {
      element.hidden = true;
      element.setAttribute("aria-hidden", "true");
    }
  });

  // ReportsPage still contains a developer-only backfill button in the regular user UI.
  // Server authorization also blocks it; this removes the confusing dead control from production.
  document.querySelectorAll<HTMLButtonElement>("button").forEach((button) => {
    const text = button.textContent?.trim() ?? "";
    if (text.includes("테스트용 지난 하루 추가") || text.includes("(개발용)")) {
      button.hidden = true;
      button.setAttribute("aria-hidden", "true");
      button.tabIndex = -1;
    }
  });
}

if (typeof window !== "undefined" && typeof document !== "undefined") {
  const start = () => {
    const root = document.getElementById("root") ?? document.body;
    hideProductionQaControls();
    const observer = new MutationObserver(hideProductionQaControls);
    observer.observe(root, { childList: true, subtree: true });
  };

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", start, { once: true });
  } else {
    start();
  }
}
