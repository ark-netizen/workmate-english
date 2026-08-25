import { useEffect, useState } from "react";
import * as api from "@/lib/api";
import type { PromotionStatus } from "@/lib/api";
import { PromotionModal } from "@/components/promotion/PromotionModal";
import { RankLineup } from "@/components/promotion/RankLineup";
import { TrialLockedPage } from "@/components/trial/TrialLockedPage";
import { useWorkday } from "@/context/useWorkday";

export function EvaluationPage() {
  const { isTrial } = useWorkday();
  const [status, setStatus] = useState<PromotionStatus | null>(null);
  const [loading, setLoading] = useState(true);
  const [modalOpen, setModalOpen] = useState(false);

  const load = () => {
    setLoading(true);
    api
      .getPromotionStatus()
      .then(setStatus)
      .catch(() => setStatus(null))
      .finally(() => setLoading(false));
  };
  useEffect(() => {
    if (isTrial) return;
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isTrial]);

  if (isTrial) return <TrialLockedPage title="인사평가" />;

  const workdayCount = status?.workdayCount ?? 0;
  const requiredDays = status?.requiredDays ?? 30;
  const remaining = Math.max(0, requiredDays - workdayCount);
  const progressPct = Math.min(100, Math.round((workdayCount / requiredDays) * 100));

  return (
    <div className="mx-auto max-w-[1230px] [zoom:1.1] space-y-6 px-4 py-6 md:px-8 md:py-8">
      <div>
        <p className="text-[11px] font-medium uppercase tracking-[0.2em] text-foreground/40">Performance Review</p>
        <h1 className="mt-1 text-lg font-semibold">인사평가</h1>
        <p className="mt-1 text-sm text-foreground/60">
          {requiredDays}일 근무를 채우면 인사평가를 통해 다음 직급으로 승진할 수 있어요.
        </p>
      </div>

      {loading && (
        <p className="rounded-xl border border-dashed border-border px-4 py-8 text-center text-sm text-foreground/50">
          불러오는 중...
        </p>
      )}

      {/* 전체 동료 중 내 위치 — 직급 캐릭터 라인업 + 실제 전체 사용자 대비 상위 % */}
      {!loading && status && (
        <section className="space-y-4 rounded-xl border border-border bg-surface p-5 md:p-6">
          <h2 className="text-sm font-semibold text-foreground">전체 동료 중 내 위치</h2>
          <RankLineup currentRank={status.currentRank} topPercent={status.topPercent} totalUsers={status.totalUsers} />
        </section>
      )}

      {/* 아직 대상이 아닐 때 — "아직 인사평가 기간이 아닙니다" */}
      {!loading && status && !status.eligible && !status.atTop && (
        <section className="space-y-4 rounded-xl border border-border bg-surface p-5 md:p-6">
          <div className="flex items-center gap-2">
            <span className="text-lg">🔒</span>
            <h2 className="text-sm font-semibold text-foreground">아직 인사평가 기간이 아닙니다</h2>
          </div>
          <p className="text-sm leading-relaxed text-foreground/70">
            현재 <span className="font-semibold text-foreground">{status.currentRank ?? "사원"}</span> 직급으로{" "}
            <span className="font-semibold text-foreground">{workdayCount}일</span> 근무하셨어요.{" "}
            앞으로 <span className="font-semibold text-accent">{remaining}일</span> 더 근무하면 인사평가 대상이 됩니다.
          </p>
          <div>
            <div className="h-2 w-full overflow-hidden rounded-full bg-black/[.06]">
              <div className="h-full rounded-full bg-accent transition-all" style={{ width: `${progressPct}%` }} />
            </div>
            <p className="mt-1.5 text-right text-xs text-foreground/50">
              {workdayCount} / {requiredDays}일
            </p>
          </div>
        </section>
      )}

      {/* 최고 직급 도달 */}
      {!loading && status?.atTop && (
        <section className="rounded-xl border border-border bg-surface p-5 md:p-6 text-center">
          <div className="text-3xl">🏆</div>
          <h2 className="mt-2 text-sm font-semibold text-foreground">최고 직급에 도달했어요</h2>
          <p className="mt-1 text-sm text-foreground/60">
            현재 <span className="font-semibold text-foreground">{status.currentRank}</span> 직급으로, 더 이상의 승진 단계가 없어요.
          </p>
        </section>
      )}

      {/* 인사평가 대상 — 접근 가능 알림 + 평가 시작 */}
      {!loading && status?.eligible && (
        <section className="space-y-4 rounded-xl border border-accent/30 bg-accent/5 p-5 md:p-6">
          <div className="flex items-center gap-2">
            <span className="text-lg">🎉</span>
            <h2 className="text-sm font-semibold text-accent">인사평가 대상이 되었어요</h2>
          </div>
          <p className="text-sm leading-relaxed text-foreground/80">
            {requiredDays}일간 수고하셨어요! 간단한 인사평가를 진행하면{" "}
            <span className="font-semibold text-foreground">{status.currentRank}</span> →{" "}
            <span className="font-semibold text-accent">{status.nextRank}</span>로 승진합니다.
          </p>
          <button
            type="button"
            onClick={() => setModalOpen(true)}
            className="w-full rounded-md bg-accent px-4 py-2.5 text-sm font-medium text-white hover:opacity-90"
          >
            인사평가 받기
          </button>
        </section>
      )}

      {modalOpen && (
        <PromotionModal
          onClose={() => setModalOpen(false)}
          onPromoted={load}
        />
      )}
    </div>
  );
}
