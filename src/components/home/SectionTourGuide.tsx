import { useEffect, useState } from "react";
import { ChevronLeft, ChevronRight, X } from "lucide-react";
import { useBusinessMode } from "@/context/useBusinessMode";

const STORAGE_KEY = "go:home-section-tour-dismissed";

export interface TourStep {
  title: string;
  text: string;
  /** CSS 셀렉터 — Sidebar/MobileTabBar처럼 이 컴포넌트 바깥(형제 컴포넌트)에 있는 요소도
   *  React ref를 안 뚫고 그냥 문서에서 찾아 강조할 수 있게 */
  selector: string;
  /** 있으면 "다음" 대신 이 버튼을 보여주고, 누르면 onClick 실행 후 투어를 닫는다(예: "동료에게 가기") */
  cta?: { label: string; onClick: () => void };
  /** 있으면 고정된 카드 대신, 강조된 요소 바로 옆(right)이나 위(top)에 말풍선으로 설명을 띄운다 */
  anchor?: "right" | "top";
  /** 메뉴처럼 강조 영역 안에 항목이 여러 개일 때 설명만 한 번에 목록으로 보여준다 */
  items?: string[];
  /** 설명 한 줄 한 줄을 실제 화면 행 위치에 맞춰 나란히 정렬해서 보여준다 */
  rowItems?: { selector: string; desc: string }[];
  /** 사이드바에 붙는 확장 패널 테마. rowItems 전용 패널에서는 모드별 전용 색을 별도로 적용한다. */
  extendPanel?: {
    bg: string;
    title: string;
    body: string;
    item: string;
    close: string;
    prevBtn: string;
    nextBtn: string;
  };
}

const HIGHLIGHT_CLASSES = ["ring-2", "ring-accent"];
const ANCHOR_WIDTH = 272;
const ANCHOR_HEIGHT_GUESS = 320;

function isVisible(el: HTMLElement) {
  return el.offsetParent !== null;
}

function clamp(value: number, min: number, max: number) {
  return Math.min(Math.max(value, min), Math.max(min, max));
}

function bringToFront(el: HTMLElement) {
  const prevPosition = el.style.position;
  const prevZIndex = el.style.zIndex;
  const prevBorderRadius = el.style.borderRadius;
  if (getComputedStyle(el).position === "static") {
    el.style.position = "relative";
  }
  el.style.zIndex = "9999";
  // 투어 강조선은 대상 카드의 원래 모서리 모양과 무관하게 항상 같은 둥근 사각형으로 보이게 한다.
  // 인라인 값은 투어가 끝나면 원래대로 복원하므로 기존 컴포넌트 디자인 자체는 바뀌지 않는다.
  el.style.borderRadius = "12px";
  return () => {
    el.style.position = prevPosition;
    el.style.zIndex = prevZIndex;
    el.style.borderRadius = prevBorderRadius;
  };
}

export function SectionTourGuide({
  steps,
  persist = true,
  onDismiss,
}: {
  steps: TourStep[];
  persist?: boolean;
  onDismiss?: () => void;
}) {
  // 이 프로젝트에서 businessMode=true는 실제 UI상 "게임 모드"로 매핑되어 있다.
  const { businessMode } = useBusinessMode();
  const gameMode = businessMode;
  const [dismissed, setDismissed] = useState(() => {
    if (!persist) return false;
    try {
      return localStorage.getItem(STORAGE_KEY) === "1";
    } catch {
      return false;
    }
  });
  const [index, setIndex] = useState(0);
  const [availableSteps, setAvailableSteps] = useState<{ step: TourStep; el: HTMLElement }[]>([]);
  const [anchorRect, setAnchorRect] = useState<DOMRect | null>(null);
  const [rowRects, setRowRects] = useState<{ selector: string; desc: string; rect: DOMRect }[]>([]);
  const [leaving, setLeaving] = useState(false);

  useEffect(() => {
    if (dismissed) return;
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

    const updateRect = () => {
      setAnchorRect(el.getBoundingClientRect());
      const rowItems = current.step.rowItems;
      if (rowItems) {
        const rects = rowItems
          .map((r) => {
            const target = document.querySelector<HTMLElement>(r.selector);
            return target && isVisible(target)
              ? { selector: r.selector, desc: r.desc, rect: target.getBoundingClientRect() }
              : null;
          })
          .filter((v): v is { selector: string; desc: string; rect: DOMRect } => v !== null);
        setRowRects(rects);
      } else {
        setRowRects([]);
      }
    };

    updateRect();
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
    onDismiss?.();
    if (!persist) return;
    try {
      localStorage.setItem(STORAGE_KEY, "1");
    } catch {
      // 저장 실패여도 현재 세션에서는 닫힌 상태를 유지한다.
    }
  };

  const current = availableSteps[Math.min(index, availableSteps.length - 1)];
  const isLast = index >= availableSteps.length - 1;
  const anchor = current.step.anchor;

  const handleFinalConfirm = () => {
    if (!onDismiss) {
      dismiss();
      return;
    }
    setLeaving(true);
    setTimeout(dismiss, 900);
  };

  const extendPanel = current.step.extendPanel;

  // 데스크톱 메뉴 단계: 메뉴와 기능 설명은 왼쪽에서 한 번에 나란히 보여주고,
  // 투어 진행 버튼은 계속 보던 위치인 우측 중앙에 따로 둔다. 메뉴를 자동으로 훑거나
  // 순차 점멸시키지 않아 사용자가 자기 속도로 이름과 기능을 살펴볼 수 있게 한다.
  if (current.step.rowItems && extendPanel && anchorRect && rowRects.length > 0 && typeof window !== "undefined") {
    const HEADER_H = 38;
    const PAD = 8;
    const firstRect = rowRects[0].rect;
    const lastRect = rowRects[rowRects.length - 1].rect;
    const panelLeft = clamp(anchorRect.right, 8, window.innerWidth - ANCHOR_WIDTH - 8);
    const panelTop = clamp(firstRect.top - HEADER_H - PAD, 8, window.innerHeight - 100);
    const panelBottom = lastRect.bottom + PAD;
    const panelHeight = panelBottom - panelTop;

    const panelClass = gameMode
      ? "border-y-2 border-r-2 border-[#315d53] bg-[#d9efe9] text-[#24483b] shadow-[4px_4px_0_rgba(40,53,47,.14)]"
      : "border-y border-r border-[#c6d5eb] bg-[#edf3ff] text-[#294f7c] shadow-[0_10px_28px_rgba(49,89,138,.10)]";
    const guideClass = gameMode
      ? "border-2 border-[#28352f] bg-[#fff9e9] text-[#28352f] shadow-[4px_4px_0_#28352f]"
      : "border border-[#cbd6e6] bg-white text-[#172033] shadow-xl";
    const prevClass = gameMode
      ? "border-2 border-[#315d53] bg-[#eef8ed] text-[#24483b] hover:bg-white"
      : "border border-[#cbd6e6] bg-white text-[#55708f] hover:bg-[#f5f8fd]";
    const nextClass = gameMode
      ? "border-2 border-[#28352f] bg-[#2f795d] text-white shadow-[2px_2px_0_#28352f] hover:bg-[#286b52]"
      : "border border-[#1a56ff] bg-[#1a56ff] text-white hover:bg-[#1649d8]";

    return (
      <>
        <div
          className={`fixed z-[10000] w-[17rem] max-w-[calc(100vw-1rem)] rounded-r-lg ${panelClass}`}
          style={{ top: panelTop, left: panelLeft, height: panelHeight }}
        >
          <div className="flex h-9 items-center justify-between px-3">
            <p className="text-xs font-bold">
              {index + 1} / {availableSteps.length} · {current.step.title}
            </p>
            <button
              type="button"
              onClick={dismiss}
              aria-label="안내 닫기"
              className="rounded p-0.5 opacity-55 hover:bg-black/5 hover:opacity-90"
            >
              <X className="size-4" />
            </button>
          </div>
          {rowRects.map(({ desc, rect }, i) => (
            <p
              key={i}
              className="fixed z-[10001] truncate px-3 text-xs font-medium leading-none"
              style={{
                top: rect.top + rect.height / 2 - 6,
                left: panelLeft,
                width: ANCHOR_WIDTH,
              }}
            >
              {desc}
            </p>
          ))}
        </div>

        <div
          className={`fixed right-6 top-1/2 z-[10000] w-72 -translate-y-1/2 rounded-xl p-4 ${guideClass}`}
        >
          {leaving ? (
            <p className="flex items-center gap-2 text-sm opacity-75">
              <span className="size-3.5 shrink-0 animate-spin rounded-full border-2 border-current/30 border-t-current" />
              곧 다음 화면으로 이동해요...
            </p>
          ) : (
            <>
              <p className="text-sm font-semibold leading-relaxed">왼쪽 메뉴의 이름과 기능을 살펴보세요.</p>
              <p className="mt-1.5 text-xs leading-relaxed opacity-60">각 메뉴 옆에 어떤 기능인지 바로 표시해두었어요.</p>
              <div className="mt-4 flex items-center justify-between gap-2">
                <button
                  type="button"
                  onClick={() => setIndex((i) => Math.max(0, i - 1))}
                  disabled={index === 0}
                  aria-label="이전"
                  className={`flex h-8 w-8 items-center justify-center rounded-md disabled:opacity-30 ${prevClass}`}
                >
                  <ChevronLeft className="size-4" />
                </button>
                <button
                  type="button"
                  onClick={() => (isLast ? handleFinalConfirm() : setIndex((i) => i + 1))}
                  className={`flex items-center gap-1 rounded-md px-4 py-2 text-xs font-semibold ${nextClass}`}
                >
                  {isLast ? "확인했어요" : "다음"}
                  {!isLast && <ChevronRight className="size-3.5" />}
                </button>
              </div>
            </>
          )}
        </div>
      </>
    );
  }

  let anchorStyle: { top?: number; bottom?: number; left: number } | null = null;
  if (anchor && anchorRect && typeof window !== "undefined") {
    if (anchor === "right") {
      const gap = extendPanel ? 0 : 12;
      anchorStyle = {
        top: clamp(anchorRect.top, 8, window.innerHeight - ANCHOR_HEIGHT_GUESS - 8),
        left: clamp(anchorRect.right + gap, 8, window.innerWidth - ANCHOR_WIDTH - 8),
      };
    } else {
      anchorStyle = {
        bottom: window.innerHeight - anchorRect.top + 10,
        left: clamp(anchorRect.left + anchorRect.width / 2 - ANCHOR_WIDTH / 2, 8, window.innerWidth - ANCHOR_WIDTH - 8),
      };
    }
  }

  const cardClassName = extendPanel
    ? `fixed z-30 w-[17rem] max-w-[calc(100vw-1rem)] rounded-r-xl p-3 transition-[top,left,bottom] duration-200 ease-out ${extendPanel.bg}`
    : anchor
      ? "fixed z-30 w-[17rem] max-w-[calc(100vw-1rem)] rounded-xl border border-accent/30 bg-surface p-3 shadow-xl transition-[top,left,bottom] duration-200 ease-out"
      : "fixed inset-x-4 top-1/2 z-30 mx-auto max-w-sm -translate-y-1/2 rounded-xl border border-accent/30 bg-surface p-4 shadow-xl md:inset-x-auto md:right-6 md:w-80";

  const titleClass = extendPanel ? `text-xs font-semibold ${extendPanel.title}` : "text-xs font-semibold text-accent";
  const closeClass = extendPanel
    ? `shrink-0 rounded p-0.5 ${extendPanel.close}`
    : "shrink-0 rounded p-0.5 text-foreground/40 hover:bg-black/[.05] hover:text-foreground/70";
  const bodyClass = extendPanel ? `mt-2 text-sm ${extendPanel.body}` : "mt-2 text-sm text-foreground/80";
  const itemsListClass = extendPanel
    ? "mt-2.5 max-h-64 space-y-1.5 overflow-y-auto border-t border-white/20 pt-2.5"
    : "mt-2.5 max-h-64 space-y-1.5 overflow-y-auto border-t border-border pt-2.5";
  const itemClass = extendPanel ? `text-xs ${extendPanel.item}` : "text-xs text-foreground/60";
  const prevBtnClass = extendPanel
    ? `flex h-7 w-7 items-center justify-center rounded-full border disabled:opacity-30 ${extendPanel.prevBtn}`
    : "flex h-7 w-7 items-center justify-center rounded-full border border-border text-foreground/60 hover:bg-black/[.03] disabled:opacity-30";
  const nextBtnClass = extendPanel
    ? `flex items-center gap-1 rounded-full px-3 py-1.5 text-xs font-medium hover:opacity-90 ${extendPanel.nextBtn}`
    : "flex items-center gap-1 rounded-full bg-accent px-3 py-1.5 text-xs font-medium text-white hover:opacity-90";

  return (
    <div className={cardClassName} style={anchorStyle ?? undefined}>
      {leaving ? (
        <p className={`flex items-center gap-2 text-sm ${extendPanel ? extendPanel.body : "text-foreground/70"}`}>
          <span className="size-3.5 shrink-0 animate-spin rounded-full border-2 border-current/30 border-t-current" />
          곧 다음 화면으로 이동해요...
        </p>
      ) : (
        <>
          <div className="flex items-start justify-between gap-2">
            <p className={titleClass}>
              {index + 1} / {availableSteps.length} · {current.step.title}
            </p>
            <button type="button" onClick={dismiss} aria-label="안내 닫기" className={closeClass}>
              <X className="size-4" />
            </button>
          </div>
          <p className={bodyClass}>{current.step.text}</p>
          {current.step.items && (
            <ul className={itemsListClass}>
              {current.step.items.map((desc, i) => (
                <li key={i} className={itemClass}>
                  {desc}
                </li>
              ))}
            </ul>
          )}
          <div className="mt-3 flex items-center justify-between gap-1.5">
            <button
              type="button"
              onClick={() => setIndex((i) => Math.max(0, i - 1))}
              disabled={index === 0}
              aria-label="이전"
              className={prevBtnClass}
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
                className={nextBtnClass}
              >
                {current.step.cta.label}
                <ChevronRight className="size-3.5" />
              </button>
            ) : (
              <button
                type="button"
                onClick={() => (isLast ? handleFinalConfirm() : setIndex((i) => i + 1))}
                className={nextBtnClass}
              >
                {isLast ? "확인했어요" : "다음"}
                {!isLast && <ChevronRight className="size-3.5" />}
              </button>
            )}
          </div>
        </>
      )}
    </div>
  );
}