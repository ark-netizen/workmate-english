import { useState } from "react";
import { attendanceStatusLabel } from "@/lib/attendance";
import { formatHoursMinutes } from "@/lib/format";
import { STANDARD_WORKDAY_MINUTES } from "@/lib/workHours";
import type { WorkHoursDay } from "@/lib/workHours";

function shortDateLabel(dateKey: string): string {
  const [, month, day] = dateKey.split("-");
  return `${Number(month)}/${Number(day)}`;
}

// 근무 시간이 없는 날(주말/휴가/결근/예정)은 막대 대신 기준선 위의 작은 회색 눈금으로만 표시
function BarColumn({ day, scaleMax, hovered, onHover, onLeave }: {
  day: WorkHoursDay;
  scaleMax: number;
  hovered: boolean;
  onHover: () => void;
  onLeave: () => void;
}) {
  const hasHours = day.minutes > 0;
  const heightPct = hasHours ? Math.max(2, (day.minutes / scaleMax) * 100) : 0;
  const tooltipText = hasHours
    ? `${shortDateLabel(day.date)} · ${formatHoursMinutes(day.minutes)}`
    : `${shortDateLabel(day.date)} · ${attendanceStatusLabel[day.status]}`;

  return (
    <div
      className="group relative flex h-full flex-1 flex-col items-center justify-end"
      onMouseEnter={onHover}
      onMouseLeave={onLeave}
    >
      {hovered && (
        <div className="absolute -top-8 z-10 whitespace-nowrap rounded-md bg-foreground px-2 py-1 text-[11px] font-medium text-background shadow-sm">
          {tooltipText}
        </div>
      )}
      {hasHours ? (
        <div
          className={`w-full max-w-6 rounded-t-[4px] transition-opacity ${hovered ? "bg-accent" : "bg-accent/80"}`}
          style={{ height: `${heightPct}%` }}
        />
      ) : (
        <div className={`h-0.5 w-full max-w-6 rounded-full ${hovered ? "bg-black/20" : "bg-black/10"}`} />
      )}
    </div>
  );
}

export function WorkHoursChart({ days }: { days: WorkHoursDay[] }) {
  const [hoveredIndex, setHoveredIndex] = useState<number | null>(null);
  const scaleMax = Math.max(STANDARD_WORKDAY_MINUTES + 60, ...days.map((d) => d.minutes)) + 30;
  const targetLinePct = (STANDARD_WORKDAY_MINUTES / scaleMax) * 100;

  return (
    <div className="overflow-x-auto">
      <div className="relative flex h-40 min-w-[560px] items-end gap-1 pl-10">
        <div
          className="absolute left-10 right-0 border-t border-black/15"
          style={{ bottom: `${targetLinePct}%` }}
        />
        <span
          className="absolute left-0 -translate-y-1/2 text-[11px] text-foreground/40"
          style={{ bottom: `${targetLinePct}%` }}
        >
          8시간
        </span>
        {days.map((day, i) => (
          <BarColumn
            key={day.date}
            day={day}
            scaleMax={scaleMax}
            hovered={hoveredIndex === i}
            onHover={() => setHoveredIndex(i)}
            onLeave={() => setHoveredIndex(null)}
          />
        ))}
      </div>
      <div className="mt-1.5 flex min-w-[560px] gap-1 pl-10">
        {days.map((day) => (
          <p key={day.date} className="flex-1 text-center text-[11px] text-foreground/40">
            {shortDateLabel(day.date)}
          </p>
        ))}
      </div>
    </div>
  );
}
