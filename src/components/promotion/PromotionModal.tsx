import { useEffect, useState } from "react";
import * as api from "@/lib/api";

// 인사평가/승급 모달
// 흐름: 안내 → 1단계(동료/상사/거래처 각각 만족도+개선 제안) → 2단계(수준 맞춤 역량평가 3문항) → 무조건 승진 축하
export function PromotionModal({ onClose, onPromoted }: { onClose: () => void; onPromoted: () => void }) {
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [step, setStep] = useState<"feedback" | "quiz">("feedback");

  const [personas, setPersonas] = useState<api.PromotionPersona[]>([]);
  const [ratings, setRatings] = useState<Record<string, number>>({});
  const [suggestions, setSuggestions] = useState<Record<string, string>>({});

  const [questions, setQuestions] = useState<api.PromotionQuestion[]>([]);
  const [answers, setAnswers] = useState<Record<string, string>>({});

  const [ranks, setRanks] = useState<{ current?: string; next?: string }>({});
  const [submitting, setSubmitting] = useState(false);
  const [result, setResult] = useState<{ fromRank?: string; toRank?: string } | null>(null);

  useEffect(() => {
    api
      .startPromotion()
      .then((r) => {
        if (!r.eligible) {
          setError("아직 인사평가 대상이 아니에요.");
          return;
        }
        setPersonas(r.personas ?? []);
        setQuestions(r.questions ?? []);
        setRanks({ current: r.currentRank, next: r.nextRank });
      })
      .catch((e) => setError(e instanceof Error ? e.message : "불러오지 못했습니다."))
      .finally(() => setLoading(false));
  }, []);

  const feedbackDone = personas.every((p) => (ratings[p.role] ?? 0) > 0);
  const quizDone = questions.every((q) => (answers[q.id] ?? "").trim().length > 0);

  const handleSubmit = async () => {
    if (!quizDone || submitting) return;
    setSubmitting(true);
    try {
      const personaFeedback: api.PersonaFeedback[] = personas.map((p) => ({
        role: p.role,
        name: p.name,
        satisfaction: ratings[p.role] ?? 0,
        suggestion: (suggestions[p.role] ?? "").trim(),
      }));
      // 관리자 상세보기에서 유저가 뭐라고 답했는지 보이도록 문제+답변을 함께 저장
      const qna = questions.map((q) => ({ prompt: q.prompt, answer: (answers[q.id] ?? "").trim() }));
      const r = await api.submitPromotion({ personaFeedback, qna });
      if (r.promoted) {
        setResult({ fromRank: r.fromRank, toRank: r.toRank });
        // 사원증·상단 이름의 직급이 즉시 바뀌도록 알림
        window.dispatchEvent(new Event("go:profile-updated"));
      } else {
        setError("승진 처리에 실패했어요.");
      }
    } catch (e) {
      setError(e instanceof Error ? e.message : "제출에 실패했습니다.");
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4" role="dialog" aria-modal="true">
      <div className="absolute inset-0 bg-black/40" onClick={onClose} />
      <div className="relative max-h-[85vh] w-full max-w-md overflow-y-auto rounded-2xl border border-border bg-background p-6 shadow-xl">
        {result ? (
          <div className="text-center">
            <div className="text-4xl">🎉</div>
            <h2 className="mt-3 text-lg font-bold">승진을 축하합니다!</h2>
            <p className="mt-2 text-sm text-foreground/70">
              <span className="text-foreground/50">{result.fromRank}</span> →{" "}
              <span className="font-semibold text-accent">{result.toRank}</span>
            </p>
            <p className="mt-1 text-xs text-foreground/50">그동안의 노고에 감사드립니다. 앞으로도 화이팅!</p>
            <button
              onClick={() => {
                onPromoted();
                onClose();
              }}
              className="mt-5 w-full rounded-md bg-accent px-4 py-2.5 text-sm font-medium text-white hover:opacity-90"
            >
              확인
            </button>
          </div>
        ) : (
          <>
            <div className="mb-4">
              <h2 className="text-lg font-bold">인사평가</h2>
              <p className="mt-1 text-sm text-foreground/60">
                {ranks.current && ranks.next ? (
                  <>
                    수고하셨어요! 평가를 마치면 <span className="font-medium text-accent">{ranks.next}</span>로 승진합니다.
                  </>
                ) : (
                  "그동안의 근무를 평가합니다."
                )}
              </p>
            </div>

            {loading && <p className="py-8 text-center text-sm text-foreground/50">불러오는 중...</p>}
            {error && <p className="py-4 text-center text-sm text-red-600">{error}</p>}

            {!loading && !error && step === "feedback" && (
              <div className="space-y-5">
                <p className="text-xs font-semibold text-foreground/50">
                  1단계 · 함께 일한 동료·상사·거래처 평가
                </p>
                {personas.map((p) => (
                  <div key={p.role} className="rounded-lg border border-border p-3">
                    <p className="text-sm font-medium text-foreground">
                      {p.name} <span className="text-xs font-normal text-foreground/40">({p.label})</span>
                    </p>
                    <div className="mt-2 flex gap-1.5">
                      {[1, 2, 3, 4, 5].map((n) => (
                        <button
                          key={n}
                          type="button"
                          onClick={() => setRatings((prev) => ({ ...prev, [p.role]: n }))}
                          className={`text-2xl ${n <= (ratings[p.role] ?? 0) ? "text-amber-400" : "text-foreground/20"}`}
                          aria-label={`${p.label} ${n}점`}
                        >
                          ★
                        </button>
                      ))}
                    </div>
                    <textarea
                      rows={2}
                      value={suggestions[p.role] ?? ""}
                      onChange={(e) => setSuggestions((prev) => ({ ...prev, [p.role]: e.target.value }))}
                      className="mt-2 w-full resize-none rounded-md border border-border bg-surface p-2.5 text-sm outline-none"
                      placeholder={`${p.name}와의 대화에서 개선되면 좋을 점 (선택)`}
                    />
                  </div>
                ))}
                <button
                  onClick={() => setStep("quiz")}
                  disabled={!feedbackDone}
                  className="w-full rounded-md bg-accent px-4 py-2.5 text-sm font-medium text-white hover:opacity-90 disabled:opacity-50"
                >
                  다음 (역량평가)
                </button>
              </div>
            )}

            {!loading && !error && step === "quiz" && (
              <div className="space-y-5">
                <p className="text-xs font-semibold text-foreground/50">2단계 · 역량평가 (3문항)</p>
                {questions.map((q, i) => (
                  <div key={q.id}>
                    <p className="whitespace-pre-line text-sm text-foreground/80">
                      {i + 1}. {q.prompt}
                    </p>
                    {q.korean_hint && <p className="mt-1 text-xs text-foreground/45">💡 {q.korean_hint}</p>}
                    <textarea
                      rows={2}
                      value={answers[q.id] ?? ""}
                      onChange={(e) => setAnswers((prev) => ({ ...prev, [q.id]: e.target.value }))}
                      className="mt-1.5 w-full resize-none rounded-md border border-border bg-surface p-2.5 text-sm outline-none"
                      placeholder="영어로 답변해보세요"
                    />
                  </div>
                ))}
                <div className="flex gap-2">
                  <button
                    onClick={() => setStep("feedback")}
                    className="rounded-md border border-border px-4 py-2.5 text-sm text-foreground/60 hover:bg-black/[.03]"
                  >
                    이전
                  </button>
                  <button
                    onClick={handleSubmit}
                    disabled={!quizDone || submitting}
                    className="flex-1 rounded-md bg-accent px-4 py-2.5 text-sm font-medium text-white hover:opacity-90 disabled:opacity-50"
                  >
                    {submitting ? "제출 중..." : "제출하고 승진하기"}
                  </button>
                </div>
              </div>
            )}
          </>
        )}
      </div>
    </div>
  );
}
