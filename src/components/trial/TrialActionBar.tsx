import { useEffect, useRef, useState } from "react";
import { ArrowRight } from "lucide-react";

// "1분 체험하기" 전체 과정(온보딩 → 사원증 → 오늘의 연락 → 답장 3개 → 리포트)에서 공통으로 쓰는
// 하단 안내 바. 항상 같은 자리에 같은 모양으로 나와서 "이 버튼 하나만 계속 누르면 된다"는 느낌을 준다.
// 실제 레이아웃 공간을 차지하도록(overlay 아님) TRIAL_ACTION_BAR_HEIGHT 만큼의 고정 높이를 갖는다.
export const TRIAL_ACTION_BAR_HEIGHT = 64;
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

  // 진행 버튼이 있는 동안(=아직 눌러야 할 액션이 남아있는 동안) 안내 바 바깥을 클릭/입력하려 하면
  // "이 버튼을 눌러 진행하라"는 걸 놓치기 쉬워서, 바 바깥 클릭을 감지해 잠깐 안내 문구를 띄워준다
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
    <div ref={barRef} className="relative shrink-0">
      {showNudge && (
        <div className="absolute inset-x-0 bottom-full mb-2 flex justify-center px-4">
          <div className="animate-bounce rounded-full bg-accent px-4 py-2 text-xs font-medium text-white shadow-lg">
            👇 아래 버튼을 눌러서 진행해주세요
          </div>
        </div>
      )}
      <div
        style={{ height: TRIAL_ACTION_BAR_HEIGHT }}
        className="flex shrink-0 items-center gap-3 overflow-hidden border-t border-accent/20 bg-surface px-4"
      >
      <div className="mx-auto flex w-full max-w-3xl items-center gap-3">
        <span className="shrink-0 rounded-full bg-accent px-2.5 py-1 text-xs font-medium text-white">체험판</span>
        {dotsTotal != null && (
          <div className="hidden shrink-0 items-center gap-1 sm:flex">
            {Array.from({ length: dotsTotal }).map((_, i) => (
              <span key={i} className={`h-2 w-7 rounded-full ${i < (dotsFilled ?? 0) ? "bg-accent" : "bg-foreground/15"}`} />
            ))}
          </div>
        )}
        <div className="min-w-0 flex-1 truncate text-sm text-foreground/60">{message}</div>
        {primaryLabel && onPrimary && (
          <button
            type="button"
            onClick={onPrimary}
            disabled={primaryDisabled}
            className="shrink-0 animate-pulse rounded-full bg-accent px-4 py-2 text-sm font-semibold text-white ring-2 ring-accent ring-offset-2 hover:opacity-90 disabled:opacity-60"
          >
            <span className="flex items-center gap-1.5">
              {primaryLabel}
              <ArrowRight className="size-4" strokeWidth={2.5} />
            </span>
          </button>
        )}
        <button
          type="button"
          onClick={onEnd}
          className={
            endPrimary
              ? "shrink-0 rounded-full bg-accent px-4 py-2 text-sm font-semibold text-white hover:opacity-90"
              : "shrink-0 rounded-full border border-border px-3 py-2 text-xs text-foreground/60 hover:bg-black/[.03]"
          }
        >
          체험 종료
        </button>
      </div>
      </div>
    </div>
  );
}
