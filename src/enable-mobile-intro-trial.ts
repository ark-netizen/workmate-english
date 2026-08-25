/*
 * IntroPage에는 과거 "실서비스는 모바일 미지원" 시절의 방어 로직이 남아 있어
 * 768px 미만에서 1분 체험 CTA를 누르면 체험 시작 대신 안내 모달만 열렸다.
 *
 * IntroPage 전체를 건드리지 않고 모바일 CTA 클릭 이벤트 동안에만 innerWidth 판정을
 * desktop 값으로 통과시킨다. CSS media query는 실제 viewport를 그대로 사용하므로
 * 화면은 계속 모바일 반응형으로 렌더링되고, React의 기존 체험 시작 로직/로딩 상태도 그대로 쓴다.
 * 이 파일은 해당 과거 방어 로직을 제거할 때 함께 삭제할 수 있는 임시 호환 레이어다.
 */

if (typeof window !== "undefined" && typeof document !== "undefined") {
  document.addEventListener(
    "click",
    (event) => {
      if (window.matchMedia("(min-width: 768px)").matches) return;

      const target = event.target instanceof Element ? event.target.closest(".intro-trial-btn, .intro-page .hero .primary, .intro-trial-main") : null;
      if (!target) return;

      const hadOwn = Object.prototype.hasOwnProperty.call(window, "innerWidth");
      const previous = Object.getOwnPropertyDescriptor(window, "innerWidth");

      try {
        Object.defineProperty(window, "innerWidth", {
          configurable: true,
          value: 768,
        });

        queueMicrotask(() => {
          try {
            if (hadOwn && previous) {
              Object.defineProperty(window, "innerWidth", previous);
            } else {
              Reflect.deleteProperty(window, "innerWidth");
            }
          } catch {
            // 복원 실패가 체험 진입을 막지는 않게 한다.
          }
        });
      } catch {
        // 일부 브라우저에서 재정의가 불가능하면 기존 동작을 유지한다.
      }
    },
    true,
  );
}
