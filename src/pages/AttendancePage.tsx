import { useEffect, useMemo, useState } from "react";
import type { ReactNode } from "react";
import * as api from "@/lib/api";
import type { PromotionStatus } from "@/lib/api";
import type { AttendanceDay } from "@/types/attendance";
import { AttendanceCalendar } from "@/components/attendance/AttendanceCalendar";
import { MilestoneBadges } from "@/components/attendance/MilestoneBadges";
import { TrialLockedPage } from "@/components/trial/TrialLockedPage";
import { useWorkday } from "@/context/useWorkday";
import { evaluateMilestones, getCurrentStreak, getTotalAttendedDays } from "@/lib/attendance";

function StatTile({ label, value }: { label: string; value: ReactNode }) {
  return (
    <div className="space-y-1.5">
      <p className="text-xs font-medium text-foreground/50">{label}</p>
      <div className="text-sm font-semibold text-foreground">{value}</div>
    </div>
  );
}

export function AttendancePage() {
  const { isTrial, leaveBalance } = useWorkday();
  const today = useMemo(() => new Date(), []);
  const [history, setHistory] = useState<AttendanceDay[]>([]);
  const [loadingHistory, setLoadingHistory] = useState(true);
  const [cursor, setCursor] = useState({ year: today.getFullYear(), month: today.getMonth() });
  const [promotion, setPromotion] = useState<PromotionStatus | null>(null);

  useEffect(() => {
    if (isTrial) return;
    api.getPromotionStatus().then(setPromotion).catch(() => setPromotion(null));
  }, [isTrial]);

  useEffect(() => {
    if (isTrial) return;
    setLoadingHistory(true);
    api
      .getAttendanceHistory(119)
      .then((res) => setHistory(res.days))
      .catch(() => setHistory([]))
      .finally(() => setLoadingHistory(false));
  }, [isTrial]);

  const streak = getCurrentStreak(history);
  const totalAttended = getTotalAttendedDays(history);
  const milestones = evaluateMilestones(history);

  const goToPrevMonth = () => {
    setCursor((prev) => {
      const month = prev.month === 0 ? 11 : prev.month - 1;
      const year = prev.month === 0 ? prev.year - 1 : prev.year;
      return { year, month };
    });
  };

  const goToNextMonth = () => {
    setCursor((prev) => {
      const month = prev.month === 11 ? 0 : prev.month + 1;
      const year = prev.month === 11 ? prev.year + 1 : prev.year;
      return { year, month };
    });
  };

  if (isTrial) return <TrialLockedPage title="출석" />;

  return (
    <div className="mx-auto max-w-[1180px] space-y-5 px-4 py-6 md:px-8 md:py-7">
      <div>
        <h1 className="text-lg font-semibold">출석</h1>
        <p className="mt-1 text-sm text-foreground/60">근태 기록과 마일스톤을 확인하세요.</p>
      </div>

      <section className="rounded-xl border border-border bg-surface p-4">
        <div className="grid grid-cols-2 gap-4 sm:grid-cols-3">
          <StatTile label="현재 연속 출석" value={`${streak}일`} />
          <StatTile label="누적 출석" value={`${totalAttended}일`} />
          <StatTile
            label="다음 마일스톤"
            value={milestones.find((m) => !m.achieved)?.label ?? "모든 마일스톤 달성"}
          />
        </div>
      </section>

      {promotion && (
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          <div className="rounded-xl border border-border bg-surface p-4">
            {promotion.atTop ? (
              <p className="text-xs text-foreground/50">최고 직급에 도달했어요 🎉</p>
            ) : (
              <>
                <div className="flex items-center justify-between text-xs text-foreground/50">
                  <span>
                    {promotion.currentRank} → {promotion.nextRank}
                  </span>
                  <span>
                    {promotion.workdayCount ?? 0} / {promotion.requiredDays ?? 0}일
                  </span>
                </div>
                <div className="mt-1.5 h-2 w-full overflow-hidden rounded-full bg-black/[.06]">
                  <div
                    className="h-full rounded-full bg-accent transition-all"
                    style={{
                      width: `${Math.min(100, Math.round(((promotion.workdayCount ?? 0) / (promotion.requiredDays || 1)) * 100))}%`,
                    }}
                  />
                </div>
              </>
            )}
          </div>

          <div className="rounded-xl border border-border bg-surface p-4">
            <div className="flex items-center justify-between text-xs text-foreground/50">
              <span>적립연차 (연속 출근 5일마다 +1)</span>
              <span>{leaveBalance?.earnedLeave ?? 0}개 적립</span>
            </div>
            <div className="mt-1.5 flex gap-1">
              {Array.from({ length: 5 }).map((_, i) => (
                <div
                  key={i}
                  className={`h-2 flex-1 rounded-full ${
                    i < (promotion.workdayCount ?? 0) % 5 ? "bg-accent" : "bg-black/[.06]"
                  }`}
                />
              ))}
            </div>
            <p className="mt-1.5 text-xs text-foreground/40">
              {(promotion.workdayCount ?? 0) % 5}/5일 — {5 - ((promotion.workdayCount ?? 0) % 5)}일 더 출근하면 적립연차 +1
            </p>
          </div>
        </div>
      )}

      {loadingHistory ? (
        <div className="rounded-xl border border-dashed border-border px-4 py-10 text-center text-sm text-foreground/50">
          불러오는 중...
        </div>
      ) : (
        <div className="grid grid-cols-1 items-start gap-5 lg:grid-cols-[380px_minmax(0,1fr)]">
          <AttendanceCalendar
            year={cursor.year}
            month={cursor.month}
            days={history}
            onPrevMonth={goToPrevMonth}
            onNextMonth={goToNextMonth}
          />
          <MilestoneBadges milestones={milestones} />
        </div>
      )}
    </div>
  );
}
