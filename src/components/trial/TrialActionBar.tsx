import { useEffect, useRef, useState } from "react";
import { ArrowRight } from "lucide-react";

// "1분 체험하기" 전체 과정(온보딩 → 사원증 → 오늘의 연락 → 답장 3개 → 리포트)에서 공통으로 쓰는
// 안내 카드. 화면 우측 중앙(모바일은 화면 중앙)에 떠서, 홈 화면의 섹션 투어 카드(SectionTourGuide)와
// 같은 자리·같은 스타일로 통일했다. 페이지 레이아웃 공간을 차지하지 않는 오버레이라 아래 화면을
// 가리지 않는다.
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

  // 진행 버튼이 있는 동안(=아직 눌러야 할 액션이 남아있는 동안) 카드 바깥을 클릭/입력하려 하면
  // 이 카드를 놓치기 쉬워서, 바깥 클릭을 감지해 잠깐 안내 문구를 띄워준다
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
      className="fixed inset-x-4 top-1/2 z-30 mx-auto max-w-sm -translate-y-1/2 rounded-xl border border-accent/30 bg-surface p-4 shadow-xl md:inset-x-auto md:right-6 md:w-80"
    >
      {showNudge && (
        <div className="absolute inset-x-0 -top-10 flex justify-center px-4">
          <div className="animate-bounce rounded-full bg-accent px-4 py-2 text-xs font-medium text-white shadow-lg">
            👉 이 카드의 버튼을 눌러서 진행해주세요
          </div>
        </div>
      )}
      <div className="flex items-center gap-2">
        <span className="shrink-0 rounded-full bg-accent px-2.5 py-1 text-xs font-medium text-white">체험판</span>
        {dotsTotal != null && (
          <div className="flex shrink-0 items-center gap-1">
            {Array.from({ length: dotsTotal }).map((_, i) => (
              <span
                key={i}
                className={`h-1.5 w-5 rounded-full ${i < (dotsFilled ?? 0) ? "bg-accent" : "bg-foreground/15"}`}
              />
            ))}
          </div>
        )}
      </div>
      <p className="mt-2.5 text-sm text-foreground/80">{message}</p>
      <div className="mt-3 flex items-center justify-end gap-1.5">
        <button
          type="button"
          onClick={onEnd}
          className={
            endPrimary
              ? "shrink-0 rounded-full bg-accent px-3 py-1.5 text-xs font-semibold text-white hover:opacity-90"
              : "shrink-0 rounded-full border border-border px-3 py-1.5 text-xs text-foreground/60 hover:bg-black/[.03]"
          }
        >
          체험 종료
        </button>
        {primaryLabel && onPrimary && (
          <button
            type="button"
            onClick={onPrimary}
            disabled={primaryDisabled}
            className="flex shrink-0 items-center gap-1 rounded-full bg-accent px-3 py-1.5 text-xs font-medium text-white hover:opacity-90 disabled:opacity-60"
          >
            {primaryLabel}
            <ArrowRight className="size-3.5" strokeWidth={2.5} />
          </button>
        )}
      </div>
    </div>
  );
}
