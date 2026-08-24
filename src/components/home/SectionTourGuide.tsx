import { useEffect, useState } from "react";
import type { RefObject } from "react";
import { ChevronLeft, ChevronRight, X } from "lucide-react";

const STORAGE_KEY = "go:home-section-tour-dismissed";

export interface TourStep {
  title: string;
  text: string;
  ref: RefObject<HTMLElement | null>;
}

const HIGHLIGHT_CLASSES = ["ring-2", "ring-accent", "ring-offset-2", "rounded-xl"];

// 정식 스포트라이트 투어(요소를 어둡게 가리고 구멍 뚫어 짚어주는 방식)는 아니지만, 화면의 실제
// 섹션을 하나씩 순서대로 테두리로 강조하면서 "여기가 뭐 하는 곳인지"를 카드로 설명해준다.
// 다음/이전으로 넘기고, 닫으면 localStorage에 남아서 다음 방문부터는 다시 안 뜸.
export function SectionTourGuide({ steps }: { steps: TourStep[] }) {
  const [dismissed, setDismissed] = useState(() => {
    try {
      return localStorage.getItem(STORAGE_KEY) === "1";
    } catch {
      return false;
    }
  });
  const [index, setIndex] = useState(0);

  // 실제로 화면에 존재하는(ref가 붙은) 단계만 — 체험판 등에서 특정 섹션이 없을 수 있음
  const availableSteps = steps.filter((s) => s.ref.current);

  useEffect(() => {
    if (dismissed) return;
    const step = availableSteps[index];
    if (!step?.ref.current) return;
    const el = step.ref.current;
    el.classList.add(...HIGHLIGHT_CLASSES);
    el.scrollIntoView({ behavior: "smooth", block: "center" });
    return () => {
      el.classList.remove(...HIGHLIGHT_CLASSES);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [dismissed, index, availableSteps.length]);

  if (dismissed || availableSteps.length === 0) return null;

  const dismiss = () => {
    setDismissed(true);
    try {
      localStorage.setItem(STORAGE_KEY, "1");
    } catch {
      // 저장 안 돼도 이번 세션엔 안 뜨는 채로 유지됨
    }
  };

  const step = availableSteps[Math.min(index, availableSteps.length - 1)];
  const isLast = index >= availableSteps.length - 1;

  return (
    <div className="fixed inset-x-4 bottom-20 z-30 mx-auto max-w-sm rounded-xl border border-accent/30 bg-surface p-4 shadow-xl md:inset-x-auto md:right-6 md:bottom-6">
      <div className="flex items-start justify-between gap-2">
        <p className="text-xs font-semibold text-accent">
          {index + 1} / {availableSteps.length} · {step.title}
        </p>
        <button
          type="button"
          onClick={dismiss}
          aria-label="안내 닫기"
          className="shrink-0 rounded p-0.5 text-foreground/40 hover:bg-black/[.05] hover:text-foreground/70"
        >
          <X className="size-4" />
        </button>
      </div>
      <p className="mt-2 text-sm text-foreground/80">{step.text}</p>
      <div className="mt-3 flex items-center justify-end gap-1.5">
        <button
          type="button"
          onClick={() => setIndex((i) => Math.max(0, i - 1))}
          disabled={index === 0}
          aria-label="이전"
          className="flex h-7 w-7 items-center justify-center rounded-full border border-border text-foreground/60 hover:bg-black/[.03] disabled:opacity-30"
        >
          <ChevronLeft className="size-4" />
        </button>
        <button
          type="button"
          onClick={() => (isLast ? dismiss() : setIndex((i) => i + 1))}
          className="flex items-center gap-1 rounded-full bg-accent px-3 py-1.5 text-xs font-medium text-white hover:opacity-90"
        >
          {isLast ? "확인했어요" : "다음"}
          {!isLast && <ChevronRight className="size-3.5" />}
        </button>
      </div>
    </div>
  );
}
