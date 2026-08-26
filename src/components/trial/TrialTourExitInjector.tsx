import { useEffect } from "react";
import { useBusinessMode } from "@/context/useBusinessMode";
import { endGuestTrial } from "@/lib/session";
import { useTrialSequence } from "@/lib/trialSequence";

const EXIT_ATTR = "data-trial-tour-exit";

/**
 * 최초 화면 구성 설명은 기존 SectionTourGuide를 그대로 재사용한다.
 * 그 컴포넌트의 레이아웃을 다시 건드리지 않고, 체험 세션에서만 실제 '다음' 버튼 바로 왼쪽에
 * 체험 종료 버튼을 삽입한다. step이 home-tour일 때만 동작하므로 이후 일반 체험 가이드와 겹치지 않는다.
 */
export function TrialTourExitInjector() {
  const { step } = useTrialSequence();
  const { businessMode } = useBusinessMode();
  const isGameMode = businessMode;

  useEffect(() => {
    if (step !== "home-tour") return;

    let disposed = false;

    const cleanup = () => {
      document.querySelectorAll<HTMLButtonElement>(`button[${EXIT_ATTR}]`).forEach((button) => button.remove());
    };

    const inject = () => {
      if (disposed) return;
      if (document.querySelector(`button[${EXIT_ATTR}]`)) return;

      const nextButton = Array.from(document.querySelectorAll<HTMLButtonElement>("button")).find((button) => {
        const label = button.textContent?.trim();
        if (label !== "다음" && label !== "확인했어요") return false;
        return !!button.closest('[class*="z-[10000]"]');
      });
      if (!nextButton?.parentElement) return;

      const exitButton = document.createElement("button");
      exitButton.type = "button";
      exitButton.setAttribute(EXIT_ATTR, "1");
      exitButton.textContent = "체험 종료";
      exitButton.style.marginLeft = "auto";
      const radius = nextButton.classList.contains("rounded-md") ? "rounded-md" : "rounded-full";
      exitButton.className = isGameMode
        ? `shrink-0 ${radius} border border-[#78a48c] bg-[#f5faf7] px-3 py-1.5 text-xs font-medium text-[#2f795d] hover:bg-white`
        : `shrink-0 ${radius} border border-[#9bb7ff] bg-white px-3 py-1.5 text-xs font-medium text-[#36527a] hover:bg-[#f5f8fd]`;

      exitButton.addEventListener("click", async (event) => {
        event.preventDefault();
        event.stopPropagation();
        exitButton.disabled = true;
        exitButton.textContent = "종료 중...";
        try {
          await endGuestTrial();
        } finally {
          window.location.replace("/intro");
        }
      });

      nextButton.parentElement.insertBefore(exitButton, nextButton);
    };

    inject();
    const observer = new MutationObserver(() => {
      cleanup();
      inject();
    });
    observer.observe(document.body, { childList: true, subtree: true });

    return () => {
      disposed = true;
      observer.disconnect();
      cleanup();
    };
  }, [step, isGameMode]);

  return null;
}
