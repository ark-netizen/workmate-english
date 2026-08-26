import { useEffect, useRef, useState } from "react";
import type { ReplyHintsData } from "@/lib/hints";

type HintKey = "word" | "korean" | "sentence";

const HINT_LABELS: Record<HintKey, string> = {
  word: "단어 힌트",
  korean: "한국어 힌트",
  sentence: "문장 힌트",
};

// 힌트는 순서대로 열어야 함: 답변이 한국어로도 안 떠오를 수 있으니 한국어 힌트부터, 그 다음 단어,
// 그래도 안 되면 마지막으로 영어 문장 힌트가 풀림 — 단어/문장 힌트까지 연 건 "그 문항이 어려웠다"는 신호
const HINT_ORDER: HintKey[] = ["korean", "word", "sentence"];

export function ReplyHints({
  hints,
  externalOpenSignal,
  onLevelChange,
}: {
  hints: ReplyHintsData;
  /** 체험판 안내 바가 "한국어 힌트를 대신 눌러줌"을 연출할 때 쓰는 신호 — 0/undefined면 무시, 값이 새로 증가할 때만 한국어 힌트를 강제로 연다 */
  externalOpenSignal?: number;
  /** 단어/문장 힌트까지 열었는지 — "이 답변이 어려웠는지" 판정 및 복습 정책에 쓰인다. 한국어 힌트만 열었으면 null */
  onLevelChange?: (level: "word" | "sentence" | null) => void;
}) {
  const [openHints, setOpenHints] = useState<Set<HintKey>>(new Set());
  const [everOpened, setEverOpened] = useState<Set<HintKey>>(new Set());
  const containerRef = useRef<HTMLDivElement>(null);
  // 체험 신호는 전역 값이라 상사 단계 이후 다른 대화(특히 고함항아리)가 새로 마운트돼도 같은 값이 남아 있다.
  // 마운트 시점의 값을 기준값으로 잡고 "그 이후 새로 증가한 신호"에만 반응해서, 외근/위로 단계에서
  // 한국어 힌트가 갑자기 다시 열리거나 강조되는 현상을 막는다.
  const lastExternalSignalRef = useRef(externalOpenSignal ?? 0);

  useEffect(() => {
    const signal = externalOpenSignal ?? 0;
    if (!signal || signal <= lastExternalSignalRef.current) return;
    lastExternalSignalRef.current = signal;

    setEverOpened((prev) => new Set(prev).add("korean"));
    setOpenHints((prev) => new Set(prev).add("korean"));

    const scrollTimer = window.setTimeout(() => {
      containerRef.current?.scrollIntoView({ behavior: "smooth", block: "nearest" });
    }, 60);

    return () => window.clearTimeout(scrollTimer);
  }, [externalOpenSignal]);

  useEffect(() => {
    if (!onLevelChange) return;
    onLevelChange(everOpened.has("sentence") ? "sentence" : everOpened.has("word") ? "word" : null);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [everOpened]);

  const isLocked = (key: HintKey) => {
    const prevKey = HINT_ORDER[HINT_ORDER.indexOf(key) - 1];
    return !!prevKey && !everOpened.has(prevKey);
  };

  const toggle = (key: HintKey) => {
    if (isLocked(key)) return;
    setEverOpened((prev) => new Set(prev).add(key));
    setOpenHints((prev) => {
      const next = new Set(prev);
      if (next.has(key)) {
        next.delete(key);
      } else {
        next.add(key);
      }
      return next;
    });
  };

  return (
    <div ref={containerRef} className="space-y-2">
      <div className="flex flex-wrap gap-1.5">
        {HINT_ORDER.map((key) => {
          const active = openHints.has(key);
          const locked = isLocked(key);
          return (
            <button
              key={key}
              type="button"
              onClick={() => toggle(key)}
              disabled={locked}
              className={`rounded-full border px-2.5 py-1 text-xs font-medium ${
                locked
                  ? "cursor-not-allowed border-border text-foreground/30"
                  : active
                    ? "border-accent bg-accent/10 text-accent"
                    : "border-border text-foreground/60 hover:bg-black/[.03]"
              }`}
            >
              {locked ? "🔒 " : ""}
              {HINT_LABELS[key]}
            </button>
          );
        })}
      </div>

      {openHints.has("korean") && (
        <div className="rounded-lg border border-border bg-black/[.02] p-3">
          <p className="whitespace-pre-wrap text-xs leading-relaxed text-foreground/70">{hints.korean}</p>
        </div>
      )}

      {openHints.has("word") && (
        <div className="rounded-lg border border-border bg-black/[.02] p-3">
          <div className="flex flex-wrap gap-1.5">
            {hints.words.map((word) => (
              <span
                key={word}
                className="rounded-full bg-blue-50 px-2.5 py-1 text-xs font-medium text-blue-700"
              >
                {word}
              </span>
            ))}
          </div>
        </div>
      )}

      {openHints.has("sentence") && (
        <div className="rounded-lg border border-border bg-black/[.02] p-3">
          <p className="whitespace-pre-wrap text-xs leading-relaxed text-foreground/70">{hints.sentence}</p>
        </div>
      )}
    </div>
  );
}
