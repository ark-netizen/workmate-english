import { useEffect, useRef, useState } from "react";
import { ArrowRight } from "lucide-react";
import { useBusinessMode } from "@/context/useBusinessMode";

// "1분 체험하기" 전체 과정에서 공통으로 쓰는 안내 카드.
// 게임 모드는 홈 투어 안내 카드와 같은 크림+진초록+하드 섀도 문법을 사용하고,
// 비즈니스 모드는 기존의 블루 SaaS 스타일을 유지한다.
const NUDGE_DURATION_MS = 2600;

export function TrialActionBar({
  message,
  dotsTotal,
  dotsFilled,
  primaryLabel,
  onPrimary,
  primaryDisabled,
  onEnd,
  endPrimary,
}: {
  message: string;
  dotsTotal?: number;
  dotsFilled?: number;
  primaryLabel?: string | null;
  onPrimary?: () => void;
  primaryDisabled?: boolean;
  onEnd: () => void;
  endPrimary?: boolean;
}) {
  const barRef = useRef<HTMLDivElement>(null);
  const [showNudge, setShowNudge] = useState(false);
  const { businessMode } = useBusinessMode();
  const isBusinessMode = !businessMode;
  const [entered, setEntered] = useState(false);

  useEffect(() => {
    const timer = setTimeout(() => setEntered(true), 300);
    return () => clearTimeout(timer);
  }, []);

  useEffect(() => {
    if (!primaryLabel || !onPrimary) return;
    let hideTimer: ReturnType<typeof setTimeout> | null = null;
    const handleOutsideClick = (e: MouseEvent) => {
      if (barRef.current?.contains(e.target as Node)) return;
      setShowNudge(true);
      if (hideTimer) clearTimeout(hideTimer);
      hideTimer = setTimeout(() => setShowNudge(false), NUDGE_DURATION_MS);
    };
    document.addEventListener("click", handleOutsideClick, true);
    return () => {
      document.removeEventListener("click", handleOutsideClick, true);
      if (hideTimer) clearTimeout(hideTimer);
    };
  }, [primaryLabel, onPrimary]);

  return (
    <div
      ref={barRef}
      className={`fixed inset-x-3 bottom-[calc(env(safe-area-inset-bottom)+76px)] top-auto z-30 mx-auto max-w-none rounded-xl p-3 transition-[transform,opacity] duration-300 ease-out md:inset-x-auto md:bottom-auto md:right-6 md:top-1/2 md:w-80 md:max-w-sm md:-translate-y-1/2 md:p-4 ${
        isBusinessMode
          ? "border-2 border-[#1a56ff] bg-[#eef4ff] shadow-[0_18px_45px_rgba(26,86,255,0.24)]"
          : "border-2 border-[#28352f] bg-[#fffaf0] text-[#28352f] shadow-[4px_4px_0_#28352f]"
      } ${entered ? "translate-x-0 opacity-100" : "translate-x-6 opacity-0"}`}
    >
      {showNudge && (
        <div className="absolute inset-x-0 -top-10 flex justify-center px-2 sm:px-4">
          <div
            className={`animate-bounce rounded-full px-3 py-2 text-center text-[11px] font-medium text-white shadow-lg sm:px-4 sm:text-xs ${
              isBusinessMode ? "bg-[#1a56ff]" : "bg-[#2f795d]"
            }`}
          >
            👉 이 카드의 버튼을 눌러서 진행해주세요
          </div>
        </div>
      )}

      <div className="flex flex-wrap items-center gap-2">
        <span
          className={`shrink-0 rounded-full px-2.5 py-1 text-xs font-semibold ${
            isBusinessMode
              ? "bg-[#1a56ff] text-white"
              : "border border-[#315d53]/35 bg-[#e6f1e9] text-[#2f795d]"
          }`}
        >
          체험판
        </span>
        {dotsTotal != null && (
          <div className="flex min-w-0 items-center gap-1">
            {Array.from({ length: dotsTotal }).map((_, i) => (
              <span
                key={i}
                className={`h-1.5 w-4 rounded-full sm:w-5 ${
                  i < (dotsFilled ?? 0)
                    ? isBusinessMode
                      ? "bg-[#1a56ff]"
                      : "bg-[#2f795d]"
                    : isBusinessMode
                      ? "bg-[#1a56ff]/20"
                      : "bg-[#2f795d]/18"
                }`}
              />
            ))}
          </div>
        )}
      </div>

      <p
        className={`mt-2 text-[13px] leading-relaxed sm:mt-2.5 sm:text-sm ${
          isBusinessMode ? "font-medium text-[#17345f]" : "font-medium text-[#38443f]"
        }`}
      >
        {message}
      </p>

      <div className="mt-3 flex flex-wrap items-center justify-end gap-1.5">
        <button
          type="button"
          onClick={onEnd}
          className={
            endPrimary
              ? `shrink-0 rounded-full px-3 py-1.5 text-xs font-semibold text-white hover:opacity-90 ${
                  isBusinessMode ? "bg-[#1a56ff]" : "border-2 border-[#28352f] bg-[#2f795d] shadow-[2px_2px_0_#28352f]"
                }`
              : `shrink-0 rounded-full px-3 py-1.5 text-xs hover:bg-black/[.03] ${
                  isBusinessMode
                    ? "border border-[#9bb7ff] text-[#36527a]"
                    : "border border-[#b9cbbb] bg-[#fbfcf7] text-[#52615a]"
                }`
          }
        >
          체험 종료
        </button>
        {primaryLabel && onPrimary && (
          <button
            type="button"
            onClick={onPrimary}
            disabled={primaryDisabled}
            className={`flex min-w-0 flex-1 items-center justify-center gap-1 rounded-full px-3 py-1.5 text-xs font-semibold text-white hover:opacity-90 disabled:opacity-60 sm:flex-none ${
              isBusinessMode
                ? "bg-[#1a56ff]"
                : "border-2 border-[#28352f] bg-[#2f795d] shadow-[2px_2px_0_#28352f]"
            }`}
          >
            <span className="min-w-0 truncate">{primaryLabel}</span>
            <ArrowRight className="size-3.5 shrink-0" strokeWidth={2.5} />
          </button>
        )}
      </div>
    </div>
  );
}
