import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import { BrowserRouter } from "react-router-dom";
import { App } from "./App";
import "./index.css";
import "./intro-solar-highlight.css";
import "./game-mode-workspace.css";
import "./intro-mobile.css";
import "./intro-mobile-hotfix.css";
import "./mobile-responsive-v2.css";
import "./mobile-trial-preview.css";
import "./mobile-trial-preview-v2.css";
import "./mobile-trial-fidelity.css";
import "./mobile-spacing-pass.css";
import "./mobile-rank-otters.css";
import "./intro-nav-responsive.css";
import "./intro-scroll-enhance.css";
import "./intro-business-process-layout.css";
import "./intro-game-process-layout.css";
import "./intro-game-flutter.css";
import "./intro-progress-mode.css";
import "./intro-scroll-qa.css";
import "./mobile-device-resilience.css";
import "./mobile-vertical-density.css";
import "./foldable-vertical-reset.css";
import "./mobile-designer-polish.css";
import "./mobile-runtime-qa.css";
import "./mobile-nav-order-fix.css";
// 히어로 글자 확대는 index.html 인라인 규칙까지 덮어야 해서 CSS 중 가장 마지막에 둔다.
import "./intro-hero-type-scale.css";
import "./admin-layout-fix.css";
import "./intro-scroll-enhance";
import "./intro-game-flutter";
import "./intro-copy-polish";
import "./foldable-login-guard";
import "./enable-mobile-intro-trial";
import "./qa-field-reminder-button";

// 1분 체험은 외근 단계에서 실제 브라우저/OS 알림을 시연하므로,
// 체험을 시작하는 최초 사용자 클릭에서 권한을 먼저 확보한다.
// 인트로에 체험 버튼이 여러 개 있어 특정 컴포넌트에 중복 로직을 넣지 않고 캡처 단계에서 공통 처리한다.
let replayingTrialClick = false;

document.addEventListener(
  "click",
  async (event) => {
    if (replayingTrialClick || window.innerWidth < 768) return;

    const target = event.target;
    if (!(target instanceof Element)) return;
    const button = target.closest("button");
    if (!button) return;

    const label = button.textContent?.replace(/\s+/g, " ").trim() ?? "";
    const isTrialButton =
      label.includes("1분 체험") ||
      label.includes("1분 가상 근무 체험") ||
      label.includes("무료로 1분 체험");
    if (!isTrialButton || button.disabled) return;

    // 권한을 확인하는 동안 기존 React onClick이 먼저 체험을 시작하지 못하게 막는다.
    event.preventDefault();
    event.stopPropagation();
    event.stopImmediatePropagation();

    // 알림 준비가 어떻게 끝나든 체험 자체는 반드시 열어준다.
    // 체험 대화는 고정 콘텐츠라 푸시 없이도 전부 동작하고, 시스템 알림 대신 앱 안에서 보일 뿐이다.
    // 예전에는 권한이 없으면 여기서 return으로 막아버려서, 알림 팝업에서 "차단"을 한 번 누른
    // 사람이나 시크릿 창처럼 푸시가 제한된 환경에서는 제품을 아예 볼 수 없었다 — 잃는 건 연출
    // 하나인데 막는 대가는 체험 자체라서 맞바꿀 값이 아니다.
    const enterTrial = () => {
      replayingTrialClick = true;
      try {
        button.click();
      } finally {
        replayingTrialClick = false;
      }
    };

    if (!("Notification" in window) || !("serviceWorker" in navigator)) {
      window.alert("이 브라우저는 웹 알림을 지원하지 않아 연락이 앱 안에서만 표시돼요. 체험은 그대로 진행됩니다.");
      enterTrial();
      return;
    }

    try {
      let permission = Notification.permission;
      if (permission === "default") {
        permission = await Notification.requestPermission();
      }

      if (permission === "granted") {
        // 체험 진입 전에 Service Worker까지 준비해 외근 단계에서 시스템 알림이 즉시 뜰 수 있게 한다.
        await navigator.serviceWorker.register("/sw.js");
        await navigator.serviceWorker.ready;
      } else {
        window.alert("알림을 허용하면 실제 푸시로 연락이 도착하는 걸 볼 수 있어요. 지금은 연락이 앱 안에서만 표시됩니다.");
      }
    } catch {
      // 시크릿 창의 푸시 제한 등으로 알림 준비가 실패해도 체험 진입은 막지 않는다
    } finally {
      enterTrial();
    }
  },
  true,
);

createRoot(document.getElementById("root")!).render(
  <StrictMode>
    <BrowserRouter basename={import.meta.env.BASE_URL}>
      <App />
    </BrowserRouter>
  </StrictMode>,
);
