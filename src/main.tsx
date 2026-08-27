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

    if (!("Notification" in window) || !("serviceWorker" in navigator)) {
      window.alert("이 브라우저에서는 웹 알림을 사용할 수 없어요. Edge 또는 Chrome에서 다시 시도해주세요.");
      return;
    }

    try {
      let permission = Notification.permission;
      if (permission === "default") {
        permission = await Notification.requestPermission();
      }

      if (permission !== "granted") {
        window.alert(
          "1분 체험의 알림 시연을 위해 사이트 알림 허용이 필요해요. 브라우저 주소창의 사이트 권한에서 알림을 허용한 뒤 다시 눌러주세요.",
        );
        return;
      }

      // 체험 진입 전에 Service Worker까지 준비해 외근 단계에서 시스템 알림이 즉시 뜰 수 있게 한다.
      await navigator.serviceWorker.register("/sw.js");
      await navigator.serviceWorker.ready;

      replayingTrialClick = true;
      button.click();
    } catch {
      window.alert("웹 알림 준비에 실패했어요. 사이트 알림 권한을 확인한 뒤 다시 시도해주세요.");
    } finally {
      replayingTrialClick = false;
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
