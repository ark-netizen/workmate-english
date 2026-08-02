import { useState } from "react";
import { Star } from "lucide-react";
import * as api from "@/lib/api";
import type { SurveyQuestion, SurveySource } from "@/types/api";

function StarPicker({ rating, onChange }: { rating: number; onChange: (value: number) => void }) {
  return (
    <div className="flex gap-1">
      {[1, 2, 3, 4, 5].map((value) => (
        <button key={value} type="button" onClick={() => onChange(value)} aria-label={`${value}점`}>
          <Star
            className={`size-6 ${value <= rating ? "fill-amber-400 text-amber-400" : "text-foreground/20"}`}
            strokeWidth={1.5}
          />
        </button>
      ))}
    </div>
  );
}

export function SurveyModal({
  survey,
  source = "banner",
  onClose,
  onSubmitted,
}: {
  survey: { id: string; title: string; description: string | null; questions?: SurveyQuestion[] };
  source?: SurveySource;
  onClose: () => void;
  onSubmitted: () => void;
}) {
  const [rating, setRating] = useState(0);
  const [review, setReview] = useState("");
  const [answers, setAnswers] = useState<string[]>(() => (survey.questions ?? []).map(() => ""));
  const [submitting, setSubmitting] = useState(false);

  const handleSubmit = async () => {
    if (!rating || !review.trim()) return;
    setSubmitting(true);
    try {
      await api.submitSurveyResponse(survey.id, rating, review.trim(), source, answers);
      onSubmitted();
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4" role="dialog" aria-modal="true">
      <div className="absolute inset-0 bg-black/40" onClick={onClose} />
      <div className="relative w-full max-w-md space-y-4 rounded-xl border border-border bg-surface p-5">
        <div>
          <h2 className="text-sm font-semibold text-foreground">{survey.title}</h2>
          {survey.description && <p className="mt-1 text-xs text-foreground/50">{survey.description}</p>}
        </div>

        <div className="space-y-1.5">
          <p className="text-xs text-foreground/60">전체적으로 만족스러우셨나요?</p>
          <StarPicker rating={rating} onChange={setRating} />
        </div>

        {/* 후기/추가 질문 답변 박스는 개수가 늘어나도 전부 같은 크기(rows=2)로 고정 — 칸마다 크기가
            들쭉날쭉해 보이던 문제 방지 */}
        <label className="block space-y-1 text-xs text-foreground/60">
          한 줄 후기
          <textarea
            rows={2}
            className="mt-1 w-full resize-none rounded-md border border-border bg-transparent px-3 py-1.5 text-sm outline-none"
            placeholder="부캐영어를 써보시니 어떠셨나요?"
            value={review}
            onChange={(e) => setReview(e.target.value)}
          />
        </label>

        {(survey.questions ?? []).map((q, i) => (
          <label key={i} className="block space-y-1 text-xs text-foreground/60">
            {q.text}
            <textarea
              rows={2}
              className="mt-1 w-full resize-none rounded-md border border-border bg-transparent px-3 py-1.5 text-sm outline-none"
              placeholder={q.placeholder || undefined}
              value={answers[i] ?? ""}
              onChange={(e) =>
                setAnswers((prev) => {
                  const next = [...prev];
                  next[i] = e.target.value;
                  return next;
                })
              }
            />
          </label>
        ))}

        <div className="flex justify-end gap-2">
          <button
            type="button"
            onClick={onClose}
            className="rounded-md border border-border px-3 py-1.5 text-sm text-foreground/60 hover:bg-black/[.03]"
          >
            취소
          </button>
          <button
            type="button"
            onClick={handleSubmit}
            disabled={submitting || !rating || !review.trim()}
            className="rounded-md bg-accent px-4 py-1.5 text-sm font-medium text-white hover:opacity-90 disabled:opacity-50"
          >
            {submitting ? "제출 중..." : "제출하기"}
          </button>
        </div>
      </div>
    </div>
  );
}
