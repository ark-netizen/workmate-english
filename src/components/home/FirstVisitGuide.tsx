import { useState } from "react";
import { X } from "lucide-react";

const STORAGE_KEY = "go:home-first-visit-guide-dismissed";

const STEPS = [
  "오늘의 연락에서 동료·상사·거래처의 메시지를 확인해요",
  "번역·힌트를 참고해서 영어로 답장해요",
  "답장하면 다음 연락이 이어서 도착해요",
  "다 처리하고 퇴근하면 오늘의 리포트가 완성돼요",
];

// 홈 화면에 처음 들어왔을 때만 보여주는 4단계 안내 카드. 정식 스포트라이트 투어(요소별
// 화살표로 짚어주는 방식)는 아니지만, "이 화면에서 뭘 하면 되는지"를 순서대로 알려준다는
// 점에서 비슷한 역할. 한 번 닫으면 localStorage에 남겨서 다음 방문부터는 다시 안 뜸.
export function FirstVisitGuide() {
  const [dismissed, setDismissed] = useState(() => {
    try {
      return localStorage.getItem(STORAGE_KEY) === "1";
    } catch {
      return false;
    }
  });

  if (dismissed) return null;

  const dismiss = () => {
    setDismissed(true);
    try {
      localStorage.setItem(STORAGE_KEY, "1");
    } catch {
      // 저장 안 돼도(시크릿모드 등) 이번 세션 안 뜨는 것 자체는 유지됨
    }
  };

  return (
    <section className="relative rounded-xl border border-accent/30 bg-accent/5 p-4">
      <button
        type="button"
        onClick={dismiss}
        aria-label="안내 닫기"
        className="absolute right-3 top-3 rounded p-1 text-foreground/40 hover:bg-black/[.05] hover:text-foreground/70"
      >
        <X className="size-4" />
      </button>
      <p className="pr-6 text-sm font-semibold text-accent">처음이시라면 이렇게 시작해보세요</p>
      <ol className="mt-3 space-y-2">
        {STEPS.map((step, i) => (
          <li key={step} className="flex items-start gap-2.5 text-sm text-foreground/75">
            <span className="mt-0.5 flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-accent text-[11px] font-bold text-white">
              {i + 1}
            </span>
            {step}
          </li>
        ))}
      </ol>
      <button
        type="button"
        onClick={dismiss}
        className="mt-3 rounded-full bg-accent px-4 py-1.5 text-xs font-medium text-white hover:opacity-90"
      >
        확인했어요
      </button>
    </section>
  );
}
