// Production safety guard for the internal Home QA controller.
// The controller is useful during local development and intentional production QA,
// but it must not appear for ordinary signed-in users.

function qaUiEnabled() {
  if (import.meta.env.DEV) return true;
  const params = new URLSearchParams(window.location.search);
  return params.get("qa") === "1";
}

function hideHomeQaControls() {
  if (qaUiEnabled()) return;

  // HomePage's QA controller has no dedicated class in the legacy component,
  // so identify only the fixed top-right controller/collapsed button by its own label.
  document.querySelectorAll<HTMLElement>(".fixed.right-3.top-20.z-40").forEach((element) => {
    const text = element.textContent ?? "";
    if (text.includes("QA 도구") || text.trim() === "QA") {
      element.hidden = true;
      element.setAttribute("aria-hidden", "true");
    }
  });
}

if (typeof window !== "undefined" && typeof document !== "undefined") {
  const start = () => {
    const root = document.getElementById("root") ?? document.body;
    hideHomeQaControls();
    const observer = new MutationObserver(hideHomeQaControls);
    observer.observe(root, { childList: true, subtree: true });
  };

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", start, { once: true });
  } else {
    start();
  }
}
