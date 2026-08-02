import { useEffect, useState } from "react";
import * as api from "@/lib/api";
import { attendanceStatusLabel } from "@/lib/attendance";
import { formatHoursMinutes } from "@/lib/format";
import { STANDARD_WORKDAY_MINUTES } from "@/lib/workHours";
import type { WorkHoursDay } from "@/lib/workHours";
import { WorkHoursChart } from "@/components/hours/WorkHoursChart";

const DAYS_BACK = 13; // 오늘 포함 최근 14일

export function WorkHoursPage() {
  const [days, setDays] = useState<WorkHoursDay[] | null>(null);
  const [showTable, setShowTable] = useState(false);

  useEffect(() => {
    api.getWorkHoursHistory(DAYS_BACK).then((res) => setDays(res.days));
  }, []);

  if (!days) {
    return <div className="mx-auto max-w-3xl px-4 py-10 text-sm text-foreground/50">불러오는 중...</div>;
  }

  const workedDays = days.filter((d) => d.minutes > 0);
  const totalMinutes = workedDays.reduce((sum, d) => sum + d.minutes, 0);
  const averageMinutes = workedDays.length > 0 ? Math.round(totalMinutes / workedDays.length) : 0;
  const todayMinutes = days[days.length - 1]?.minutes ?? 0;

  return (
    <div className="mx-auto max-w-3xl space-y-6 px-4 py-6 md:px-8 md:py-8">
      <div>
        <h1 className="text-lg font-semibold">근무 시간</h1>
        <p className="mt-1 text-sm text-foreground/60">최근 2주간의 하루 근무 시간을 확인하세요.</p>
      </div>

      <section className="rounded-xl border border-border bg-surface p-5">
        <div className="grid grid-cols-3 gap-4">
          <div className="space-y-1.5">
            <p className="text-xs font-medium text-foreground/50">오늘</p>
            <p className="text-sm font-semibold text-foreground">{formatHoursMinutes(todayMinutes)}</p>
          </div>
          <div className="space-y-1.5">
            <p className="text-xs font-medium text-foreground/50">근무일 평균</p>
            <p className="text-sm font-semibold text-foreground">{formatHoursMinutes(averageMinutes)}</p>
          </div>
          <div className="space-y-1.5">
            <p className="text-xs font-medium text-foreground/50">목표</p>
            <p className="text-sm font-semibold text-foreground">{formatHoursMinutes(STANDARD_WORKDAY_MINUTES)}</p>
          </div>
        </div>
      </section>

      <section className="rounded-xl border border-border bg-surface p-5">
        <div className="flex items-center justify-between">
          <h2 className="text-sm font-medium text-foreground">일별 근무 시간</h2>
          <button
            type="button"
            onClick={() => setShowTable((v) => !v)}
            className="text-xs text-foreground/50 underline hover:text-foreground/70"
          >
            {showTable ? "그래프로 보기" : "표로 보기"}
          </button>
        </div>

        <div className="mt-4">
          {showTable ? (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-border text-left text-xs text-foreground/50">
                    <th className="py-1.5 pr-4 font-medium">날짜</th>
                    <th className="py-1.5 pr-4 font-medium">상태</th>
                    <th className="py-1.5 font-medium">근무 시간</th>
                  </tr>
                </thead>
                <tbody>
                  {days.map((day) => (
                    <tr key={day.date} className="border-b border-border/60">
                      <td className="py-1.5 pr-4 tabular-nums text-foreground/70">{day.date}</td>
                      <td className="py-1.5 pr-4 text-foreground/70">{attendanceStatusLabel[day.status]}</td>
                      <td className="py-1.5 tabular-nums text-foreground">
                        {day.minutes > 0 ? formatHoursMinutes(day.minutes) : "—"}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          ) : (
            <WorkHoursChart days={days} />
          )}
        </div>
      </section>
    </div>
  );
}
