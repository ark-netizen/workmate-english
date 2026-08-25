/*
 * IntroPage에는 과거 "실서비스는 모바일 미지원" 시절의 방어 로직이 남아 있어
 * 768px 미만에서 1분 체험 CTA를 누르면 체험 시작 대신 안내 모달만 열렸다.
 *
 * IntroPage 전체를 크게 건드리지 않고, 모바일에서 체험 CTA를 누르는 짧은 순간에만
 * innerWidth를 데스크톱 기준으로 보이게 해 기존 체험 시작 로직을 그대로 통과시킨다.
 * CSS media query는 실제 viewport를 그대로 쓰므로 화면 반응형에는 영향을 주지 않는다.
 */

if (typeof window !== "undefined" && typeof document !== "undefined") {
  const selector = ".intro-trial-btn, .intro-page .hero .primary, .intro-trial-main";
  let restoreTimer: ReturnType<typeof setTimeout> | null = null;
  let originalDescriptor: PropertyDescriptor | undefined;
  let hadOwnInnerWidth = false;
  let patched = false;

  const patchInnerWidth = () => {
    if (window.matchMedia("(min-width: 768px)").matches) return;

    if (!patched) {
      hadOwnInnerWidth = Object.prototype.hasOwnProperty.call(window, "innerWidth");
      originalDescriptor = Object.getOwnPropertyDescriptor(window, "innerWidth");
    }

    try {
      Object.defineProperty(window, "innerWidth", {
        configurable: true,
        value: 1024,
      });
      patched = true;
    } catch {
      return;
    }

    if (restoreTimer) clearTimeout(restoreTimer);
    /* pointer/touch 뒤 실제 click 및 React handler가 끝날 때까지 충분히 유지 */
    restoreTimer = setTimeout(() => {
      try {
        if (hadOwnInnerWidth && originalDescriptor) {
          Object.defineProperty(window, "innerWidth", originalDescriptor);
        } else {
          Reflect.deleteProperty(window, "innerWidth");
        }
      } catch {
        // 복원 실패가 체험 진입을 막지는 않게 한다.
      } finally {
        patched = false;
        restoreTimer = null;
      }
    }, 1500);
  };

  const handleStartGesture = (event: Event) => {
    const target = event.target instanceof Element ? event.target.closest(selector) : null;
    if (!target) return;
    patchInnerWidth();
  };

  /* 모바일 브라우저별로 click 전에 pointer/touch에서 미리 판정을 바꿔 둔다. */
  document.addEventListener("pointerdown", handleStartGesture, true);
  document.addEventListener("touchstart", handleStartGesture, { capture: true, passive: true });
  document.addEventListener("click", handleStartGesture, true);
}
