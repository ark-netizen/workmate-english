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
  /** 있으면 고정된 카드 대신, 강조된 요소 바로 옆(right)이나 위(top)에 말풍선으로 설명을 띄운다
   *  — 메뉴처럼 "이게 뭔지"가 그 요소 자체와 붙어 있어야 이해되는 경우에 씀 */
  anchor?: "right" | "top";
  /** 메뉴처럼 강조 영역 안에 항목이 여러 개일 때, 하나씩 넘기지 않고 설명만 한 번에 목록으로
   *  보여줌 — 라벨은 실제 메뉴에 이미 보이므로 반복하지 않는다 */
  items?: string[];
  /** items와 달리, 설명 한 줄 한 줄을 그 항목의 실제 화면 위치(행)에 맞춰 정렬해서 보여준다
   *  — "표의 행"처럼 왼쪽 메뉴와 오른쪽 설명이 같은 높이에 나란히 보이게 함(extendPanel 전용) */
  rowItems?: { selector: string; desc: string }[];
  /** 있으면 흰 카드(테두리·그림자) 대신, 강조된 요소와 같은 배경색으로 틈 없이 이어붙여서
   *  "그 요소 자체가 옆으로 늘어난 것"처럼 보이게 한다 — 메뉴처럼 별도 말풍선보다는 사이드바
   *  자체의 연장처럼 보이는 게 자연스러운 경우에 씀(anchor: "right" 전용) */
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

// ring-inset을 썼더니, 프로필 카드처럼 안쪽에 배경이 꽉 찬 자식 요소가 있는 경우 그 자식의
// 배경이 안쪽으로 그려지는 링을 그대로 덮어버려 거의 안 보이는 문제가 있었다(자식은 항상 부모의
// 테두리보다 나중에 칠해짐). ring-offset 없이 바깥으로만 살짝(2px) 튀어나오는 기본 outset 링을
// 쓰면 자식에게 덮일 일도 없고, 뷰포트 가장자리에서도 2px 정도는 거의 안 잘려 보인다.
// rounded-xl은 넣지 않는다 — 사이드바처럼 화면 가장자리에 딱 붙어 원래 각진 요소에 강제로
// 둥근 모서리를 씌우면 화면 끝이 이상하게 잘려나간 것처럼 보인다. 카드형 섹션들은 이미 자기
// className에 rounded-xl이 있어서 안 넣어도 그대로 둥글게 보임.
const HIGHLIGHT_CLASSES = ["ring-2", "ring-accent"];

const ANCHOR_WIDTH = 272; // 앵커 말풍선 너비(w-68) — 메뉴 항목 목록도 한 번에 담기게 넉넉히
const ANCHOR_HEIGHT_GUESS = 320; // 실제 렌더 전 높이를 모르니, 클램프용으로 넉넉히 잡은 예상치(항목 목록 포함)

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
export function SectionTourGuide({
  steps,
  persist = true,
  onDismiss,
}: {
  steps: TourStep[];
  persist?: boolean;
  /** 투어를 끝까지 보거나 중간에 닫을 때(둘 다) 호출됨 — 체험판에서 "투어 끝나면 첫 연락 도착" 같은 후속 동작에 씀 */
  onDismiss?: () => void;
}) {
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
  // rowItems 단계에서 각 설명을 그 항목의 실제 행 위치에 맞추기 위한 좌표들
  const [rowRects, setRowRects] = useState<{ desc: string; rect: DOMRect }[]>([]);
  // 마지막 단계에서 onDismiss가 있으면(=곧 다른 화면으로 넘어감), 말없이 확 이동하지 않고
  // "이동해요" 안내를 잠깐 보여준 뒤 넘어간다
  const [leaving, setLeaving] = useState(false);

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
    const updateRect = () => {
      setAnchorRect(el.getBoundingClientRect());
      const rowItems = current.step.rowItems;
      if (rowItems) {
        const rects = rowItems
          .map((r) => {
            const target = document.querySelector<HTMLElement>(r.selector);
            return target && isVisible(target) ? { desc: r.desc, rect: target.getBoundingClientRect() } : null;
          })
          .filter((v): v is { desc: string; rect: DOMRect } => v !== null);
        setRowRects(rects);
      } else {
        setRowRects([]);
      }
    };
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
    onDismiss?.();
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

  // 마지막 단계에서 확인하면 곧 다른 화면으로 넘어간다는 걸 먼저 알려주고, 짧게 보여준 뒤 실제로 닫는다
  const handleFinalConfirm = () => {
    if (!onDismiss) {
      dismiss();
      return;
    }
    setLeaving(true);
    setTimeout(dismiss, 900);
  };

  const extendPanel = current.step.extendPanel;

  // rowItems + extendPanel 조합: 설명 한 줄 한 줄을 그 항목의 실제 행 위치에 맞춰 그리는
  // 전용 레이아웃 — "표의 행처럼 나란히" 보여야 해서 일반 카드 렌더링과는 완전히 다르게 그린다
  if (current.step.rowItems && extendPanel && anchorRect && rowRects.length > 0 && typeof window !== "undefined") {
    const HEADER_H = 34;
    const FOOTER_H = 40;
    const PAD = 8;
    const firstRect = rowRects[0].rect;
    const lastRect = rowRects[rowRects.length - 1].rect;
    const panelLeft = clamp(anchorRect.right, 8, window.innerWidth - ANCHOR_WIDTH - 8);
    const panelTop = clamp(firstRect.top - HEADER_H - PAD, 8, window.innerHeight - 100);
    const panelHeight = lastRect.bottom + FOOTER_H + PAD - panelTop;

    return (
      <>
        <div
          className={`fixed z-30 w-[17rem] max-w-[calc(100vw-1rem)] rounded-r-xl transition-[top,left,height] duration-200 ease-out ${extendPanel.bg}`}
          style={{ top: panelTop, left: panelLeft, height: panelHeight }}
        />
        {leaving ? (
          <p
            className={`fixed z-30 flex items-center gap-2 px-3 text-sm ${extendPanel.body}`}
            style={{ top: panelTop + panelHeight / 2 - 10, left: panelLeft, width: ANCHOR_WIDTH }}
          >
            <span className="size-3.5 shrink-0 animate-spin rounded-full border-2 border-current/30 border-t-current" />
            곧 다음 화면으로 이동해요...
          </p>
        ) : (
          <>
            <div
              className="fixed z-30 flex items-center justify-between px-3"
              style={{ top: panelTop + 8, left: panelLeft, width: ANCHOR_WIDTH }}
            >
              <p className={`text-xs font-semibold ${extendPanel.title}`}>
                {index + 1} / {availableSteps.length} · {current.step.title}
              </p>
              <button
                type="button"
                onClick={dismiss}
                aria-label="안내 닫기"
                className={`shrink-0 rounded p-0.5 ${extendPanel.close}`}
              >
                <X className="size-4" />
              </button>
            </div>
            {rowRects.map(({ desc, rect }, i) => (
              <p
                key={i}
                className={`fixed z-30 truncate px-3 text-xs leading-none ${extendPanel.item}`}
                style={{ top: rect.top + rect.height / 2 - 6, left: panelLeft, width: ANCHOR_WIDTH }}
              >
                {desc}
              </p>
            ))}
            <div
              className="fixed z-30 flex items-center justify-end gap-1.5 px-3"
              style={{ top: lastRect.bottom + PAD, left: panelLeft, width: ANCHOR_WIDTH }}
            >
              <button
                type="button"
                onClick={() => setIndex((i) => Math.max(0, i - 1))}
                disabled={index === 0}
                aria-label="이전"
                className={`flex h-7 w-7 items-center justify-center rounded-full border disabled:opacity-30 ${extendPanel.prevBtn}`}
              >
                <ChevronLeft className="size-4" />
              </button>
              <button
                type="button"
                onClick={() => (isLast ? handleFinalConfirm() : setIndex((i) => i + 1))}
                className={`flex items-center gap-1 rounded-full px-3 py-1.5 text-xs font-medium hover:opacity-90 ${extendPanel.nextBtn}`}
              >
                {isLast ? "확인했어요" : "다음"}
                {!isLast && <ChevronRight className="size-3.5" />}
              </button>
            </div>
          </>
        )}
      </>
    );
  }

  let anchorStyle: { top?: number; bottom?: number; left: number } | null = null;
  if (anchor && anchorRect && typeof window !== "undefined") {
    if (anchor === "right") {
      // extendPanel은 "같은 색으로 이어붙여서 늘어난 것처럼" 보여야 하므로 틈을 안 둔다.
      // 말풍선일 때는 겹치지 않게 12px 띄운다.
      const gap = extendPanel ? 0 : 12;
      anchorStyle = {
        top: clamp(anchorRect.top, 8, window.innerHeight - ANCHOR_HEIGHT_GUESS - 8),
        left: clamp(anchorRect.right + gap, 8, window.innerWidth - ANCHOR_WIDTH - 8),
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

  // extendPanel이 있으면 흰 카드(테두리·그림자·둥근 모서리) 대신, 강조된 요소와 같은 배경색을
  // 틈 없이 이어붙이고 오른쪽 모서리만 둥글게 해서 "그 요소가 옆으로 늘어난 것"처럼 보이게 한다
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
          <div className="mt-3 flex items-center justify-end gap-1.5">
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
              <button type="button" onClick={() => (isLast ? handleFinalConfirm() : setIndex((i) => i + 1))} className={nextBtnClass}>
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
