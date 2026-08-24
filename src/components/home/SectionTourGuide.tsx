import { useEffect, useState } from "react";
import { ChevronLeft, ChevronRight, X } from "lucide-react";

const STORAGE_KEY = "go:home-section-tour-dismissed";

export interface TourStep {
  title: string;
  text: string;
  /** CSS 셀렉터 — Sidebar/MobileTabBar처럼 이 컴포넌트 바깥(형제 컴포넌트)에 있는 요소도
   *  React ref를 안 뚫고 그냥 문서에서 찾아 강조할 수 있게 */
  selector: string;
  /** 있으면 "다음" 대신 이 버튼을 보여주고, 누르면 onClick 실행 후 투어를 닫는다(예: "동료에게 가기") */
  cta?: { label: string; onClick: () => void };
  /** 있으면 고정된 카드 대신, 강조된 요소 바로 옆(right)이나 위(top)에 작은 말풍선으로 설명을 띄운다
   *  — 메뉴 항목처럼 "이게 뭔지"가 그 항목 자체와 붙어 있어야 이해되는 경우에 씀 */
  anchor?: "right" | "top";
}

// ring-inset을 썼더니, 프로필 카드처럼 안쪽에 배경이 꽉 찬 자식 요소가 있는 경우 그 자식의
// 배경이 안쪽으로 그려지는 링을 그대로 덮어버려 거의 안 보이는 문제가 있었다(자식은 항상 부모의
// 테두리보다 나중에 칠해짐). ring-offset 없이 바깥으로만 살짝(2px) 튀어나오는 기본 outset 링을
// 쓰면 자식에게 덮일 일도 없고, 뷰포트 가장자리에서도 2px 정도는 거의 안 잘려 보인다.
const HIGHLIGHT_CLASSES = ["ring-2", "ring-accent", "rounded-xl"];

const ANCHOR_WIDTH = 224; // 앵커 말풍선 너비(w-56) — 화면 밖으로 안 나가게 클램프할 때 사용
const ANCHOR_HEIGHT_GUESS = 130; // 실제 렌더 전 높이를 모르니, 클램프용으로 넉넉히 잡은 예상치

function isVisible(el: HTMLElement) {
  return el.offsetParent !== null;
}

function clamp(value: number, min: number, max: number) {
  return Math.min(Math.max(value, min), Math.max(min, max));
}

// 강조할 요소가 Sidebar/MobileTabBar(fixed, z-20)처럼 이미 쌓임 맥락을 가진 요소이거나, 반대로
// z-index가 전혀 없는 일반 요소일 수도 있어서, ring 클래스만으로는 다른 fixed 요소에 가려질 수
// 있다. 인라인 스타일로 무조건 최상단에 오게 강제하고, 이미 포지션이 있으면 건드리지 않는다
// (Sidebar/MobileTabBar 같은 fixed 요소의 위치가 relative로 바뀌어 깨지는 것을 방지).
function bringToFront(el: HTMLElement) {
  const prevPosition = el.style.position;
  const prevZIndex = el.style.zIndex;
  if (getComputedStyle(el).position === "static") {
    el.style.position = "relative";
  }
  el.style.zIndex = "9999";
  return () => {
    el.style.position = prevPosition;
    el.style.zIndex = prevZIndex;
  };
}

// 정식 스포트라이트 투어(요소를 어둡게 가리고 구멍 뚫어 짚어주는 방식)는 아니지만, 화면의 실제
// 섹션을 하나씩 순서대로 테두리로 강조하면서 "여기가 뭐 하는 곳인지"를 카드로 설명해준다.
// 다음/이전으로 넘기고, 닫으면 localStorage에 남아서 다음 방문부터는 다시 안 뜸 — 단, 체험판은
// 계정이 매번 새로 시작되는 일회성이라 이 "기억" 자체가 의미 없어서 persist=false로 끈다.
export function SectionTourGuide({ steps, persist = true }: { steps: TourStep[]; persist?: boolean }) {
  const [dismissed, setDismissed] = useState(() => {
    if (!persist) return false;
    try {
      return localStorage.getItem(STORAGE_KEY) === "1";
    } catch {
      return false;
    }
  });
  const [index, setIndex] = useState(0);
  // 반응형이라 데스크톱/모바일 중 실제로 화면에 보이는(display:none 아닌) 요소가 있는 단계만
  const [availableSteps, setAvailableSteps] = useState<{ step: TourStep; el: HTMLElement }[]>([]);
  // anchor 단계에서 말풍선을 강조 요소 옆에 붙이기 위한 위치 — 스크롤/리사이즈에도 다시 계산함
  const [anchorRect, setAnchorRect] = useState<DOMRect | null>(null);

  useEffect(() => {
    if (dismissed) return;
    // workContext처럼 서버 데이터가 와야 렌더되는 섹션도 있어서, 마운트 직후 바로 찾으면
    // 아직 DOM에 없을 수 있다 — 데이터 로딩이 대충 끝날 시간을 살짝 두고 찾는다
    const timer = setTimeout(() => {
      const found = steps
        .map((step) => {
          const el = document.querySelector<HTMLElement>(step.selector);
          return el && isVisible(el) ? { step, el } : null;
        })
        .filter((v): v is { step: TourStep; el: HTMLElement } => v !== null);
      setAvailableSteps(found);
    }, 400);
    return () => clearTimeout(timer);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [dismissed]);

  useEffect(() => {
    if (dismissed) return;
    const current = availableSteps[index];
    if (!current) return;
    const { el } = current;
    el.classList.add(...HIGHLIGHT_CLASSES);
    const restore = bringToFront(el);
    el.scrollIntoView({ behavior: "smooth", block: "center" });
    const updateRect = () => setAnchorRect(el.getBoundingClientRect());
    updateRect();
    // 스크롤 애니메이션이 끝난 뒤 최종 위치로 한 번 더 맞춰줌
    const settleTimer = setTimeout(updateRect, 350);
    window.addEventListener("resize", updateRect);
    window.addEventListener("scroll", updateRect, true);
    return () => {
      el.classList.remove(...HIGHLIGHT_CLASSES);
      restore();
      clearTimeout(settleTimer);
      window.removeEventListener("resize", updateRect);
      window.removeEventListener("scroll", updateRect, true);
    };
  }, [dismissed, index, availableSteps]);

  if (dismissed || availableSteps.length === 0) return null;

  const dismiss = () => {
    setDismissed(true);
    if (!persist) return;
    try {
      localStorage.setItem(STORAGE_KEY, "1");
    } catch {
      // 저장 안 돼도 이번 세션엔 안 뜨는 채로 유지됨
    }
  };

  const current = availableSteps[Math.min(index, availableSteps.length - 1)];
  const isLast = index >= availableSteps.length - 1;
  const anchor = current.step.anchor;

  let anchorStyle: { top?: number; bottom?: number; left: number } | null = null;
  if (anchor && anchorRect && typeof window !== "undefined") {
    if (anchor === "right") {
      anchorStyle = {
        top: clamp(anchorRect.top, 8, window.innerHeight - ANCHOR_HEIGHT_GUESS - 8),
        left: clamp(anchorRect.right + 12, 8, window.innerWidth - ANCHOR_WIDTH - 8),
      };
    } else {
      // top: 모바일 하단 탭바 위에 붙이는 용도라, 뷰포트 바닥 기준(bottom)으로 띄워야
      // 탭바 높이가 달라져도 항상 탭바 바로 위에 자연스럽게 붙는다
      anchorStyle = {
        bottom: window.innerHeight - anchorRect.top + 10,
        left: clamp(anchorRect.left + anchorRect.width / 2 - ANCHOR_WIDTH / 2, 8, window.innerWidth - ANCHOR_WIDTH - 8),
      };
    }
  }

  const cardClassName = anchor
    ? "fixed z-30 w-56 rounded-xl border border-accent/30 bg-surface p-3 shadow-xl transition-[top,left,bottom] duration-200 ease-out"
    : "fixed inset-x-4 top-1/2 z-30 mx-auto max-w-sm -translate-y-1/2 rounded-xl border border-accent/30 bg-surface p-4 shadow-xl md:inset-x-auto md:right-6 md:w-80";

  return (
    <div className={cardClassName} style={anchorStyle ?? undefined}>
      <div className="flex items-start justify-between gap-2">
        <p className="text-xs font-semibold text-accent">
          {index + 1} / {availableSteps.length} · {current.step.title}
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
      <p className="mt-2 text-sm text-foreground/80">{current.step.text}</p>
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
        {current.step.cta ? (
          <button
            type="button"
            onClick={() => {
              current.step.cta?.onClick();
              dismiss();
            }}
            className="flex items-center gap-1 rounded-full bg-accent px-3 py-1.5 text-xs font-medium text-white hover:opacity-90"
          >
            {current.step.cta.label}
            <ChevronRight className="size-3.5" />
          </button>
        ) : (
          <button
            type="button"
            onClick={() => (isLast ? dismiss() : setIndex((i) => i + 1))}
            className="flex items-center gap-1 rounded-full bg-accent px-3 py-1.5 text-xs font-medium text-white hover:opacity-90"
          >
            {isLast ? "확인했어요" : "다음"}
            {!isLast && <ChevronRight className="size-3.5" />}
          </button>
        )}
      </div>
    </div>
  );
}
