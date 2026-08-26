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
const TRIAL_HIGHLIGHT_MS = 2800;

export function ReplyHints({
  hints,
  externalOpenSignal,
  onLevelChange,
}: {
  hints: ReplyHintsData;
  /** 체험판 안내 바가 "한국어 힌트를 대신 눌러줌"을 연출할 때 쓰는 신호 — 0/undefined면 무시, 값이 바뀌면 한국어 힌트를 강제로 연다 */
  externalOpenSignal?: number;
  /** 단어/문장 힌트까지 열었는지 — "이 답변이 어려웠는지" 판정 및 복습 정책에 쓰인다. 한국어 힌트만 열었으면 null */
  onLevelChange?: (level: "word" | "sentence" | null) => void;
}) {
  const [openHints, setOpenHints] = useState<Set<HintKey>>(new Set());
  const [everOpened, setEverOpened] = useState<Set<HintKey>>(new Set());
  const [trialHighlight, setTrialHighlight] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!externalOpenSignal) return;
    setEverOpened((prev) => new Set(prev).add("korean"));
    setOpenHints((prev) => new Set(prev).add("korean"));
    setTrialHighlight(true);

    const scrollTimer = window.setTimeout(() => {
      containerRef.current?.scrollIntoView({ behavior: "smooth", block: "nearest" });
    }, 60);
    const highlightTimer = window.setTimeout(() => setTrialHighlight(false), TRIAL_HIGHLIGHT_MS);

    return () => {
      window.clearTimeout(scrollTimer);
      window.clearTimeout(highlightTimer);
    };
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
    <div
      ref={containerRef}
      className={`relative space-y-2 rounded-xl p-1 transition-[background-color,box-shadow] duration-300 ${
        trialHighlight
          ? "bg-[#eef4ff] shadow-[0_0_0_2px_#1a56ff,0_8px_24px_rgba(26,86,255,0.18)]"
          : ""
      }`}
    >
      {trialHighlight && (
        <span className="absolute -top-3 left-2 z-10 rounded-full bg-[#1a56ff] px-2.5 py-1 text-[10px] font-bold text-white shadow-md">
          힌트는 여기에서 확인해요
        </span>
      )}

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
        <div
          className={`rounded-lg border p-3 transition-colors duration-300 ${
            trialHighlight ? "border-[#6f99ff] bg-[#f5f8ff]" : "border-border bg-black/[.02]"
          }`}
        >
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
