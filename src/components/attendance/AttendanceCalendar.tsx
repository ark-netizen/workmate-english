import { CheckCircle2, Compass, Palmtree } from "lucide-react";
import type { AttendanceDay } from "@/types/attendance";
import { attendanceStatusLabel, buildMonthGrid } from "@/lib/attendance";

const WEEKDAY_LABELS = ["일", "월", "화", "수", "목", "금", "토"];

const STAMP_ICON = {
  present: CheckCircle2,
  "field-work": Compass,
  leave: Palmtree,
} as const;

const STAMP_CLASSES: Record<keyof typeof STAMP_ICON, string> = {
  present: "border-emerald-300 bg-emerald-50 text-emerald-600",
  "field-work": "border-blue-300 bg-blue-50 text-blue-600",
  leave: "border-orange-300 bg-orange-50 text-orange-600",
};

const DOT_CLASSES: Record<AttendanceDay["status"], string> = {
  present: "bg-emerald-500",
  "field-work": "bg-blue-500",
  leave: "bg-orange-500",
  absent: "bg-red-500",
  weekend: "bg-transparent",
  future: "bg-transparent",
  "before-join": "bg-transparent",
};

function isStampable(status: AttendanceDay["status"]): status is keyof typeof STAMP_ICON {
  return status === "present" || status === "field-work" || status === "leave";
}

function DayMark({ status, tilt }: { status?: AttendanceDay["status"]; tilt: boolean }) {
  if (!status) return null;
  if (status === "absent") {
    return <span className="h-1.5 w-1.5 rounded-full bg-red-500" aria-hidden="true" />;
  }
  if (!isStampable(status)) return null;

  const Icon = STAMP_ICON[status];
  return (
    <span
      className={`flex h-4 w-4 items-center justify-center rounded-full border ${STAMP_CLASSES[status]} ${
        tilt ? "-rotate-6" : "rotate-6"
      }`}
      aria-hidden="true"
    >
      <Icon className="size-2.5" />
    </span>
  );
}

function todayKey(): string {
  const now = new Date();
  return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}-${String(now.getDate()).padStart(2, "0")}`;
}

export function AttendanceCalendar({
  year,
  month,
  days,
  onPrevMonth,
  onNextMonth,
}: {
  year: number;
  month: number;
  days: AttendanceDay[];
  onPrevMonth: () => void;
  onNextMonth: () => void;
}) {
  const cells = buildMonthGrid(year, month, days);
  const current = todayKey();

  return (
    <section className="w-full space-y-3 rounded-xl border border-border bg-surface p-5">
      <div className="flex items-center justify-between">
        <h2 className="text-sm font-medium text-foreground/70">
          {year}년 {month + 1}월
        </h2>
        <div className="flex gap-1">
          <button
            type="button"
            onClick={onPrevMonth}
            className="rounded-md border border-border px-2.5 py-1 text-xs text-foreground/60 hover:bg-black/[.03]"
          >
            이전
          </button>
          <button
            type="button"
            onClick={onNextMonth}
            className="rounded-md border border-border px-2.5 py-1 text-xs text-foreground/60 hover:bg-black/[.03]"
          >
            다음
          </button>
        </div>
      </div>

      <div className="grid grid-cols-7 gap-1 text-center text-xs text-foreground/40">
        {WEEKDAY_LABELS.map((label) => (
          <div key={label} className="py-1">
            {label}
          </div>
        ))}
      </div>

      <div className="grid grid-cols-7 gap-1">
        {cells.map((cell) => {
          const status = cell.day?.status;
          const isToday = cell.date === current;
          return (
            <div
              key={cell.date}
              className={`flex h-11 flex-col items-center justify-center gap-1 rounded-md text-xs ${
                cell.inCurrentMonth ? "text-foreground" : "text-foreground/25"
              } ${isToday ? "border border-accent" : "border border-transparent"}`}
              title={status ? attendanceStatusLabel[status] : undefined}
            >
              <span>{Number(cell.date.slice(-2))}</span>
              <DayMark status={status} tilt={Number(cell.date.slice(-2)) % 2 === 0} />
            </div>
          );
        })}
      </div>

      <div className="flex flex-wrap gap-3 border-t border-border pt-3 text-xs text-foreground/50">
        {(["present", "field-work", "leave"] as const).map((status) => {
          const Icon = STAMP_ICON[status];
          return (
            <span key={status} className="inline-flex items-center gap-1.5">
              <span className={`flex h-4 w-4 items-center justify-center rounded-full border ${STAMP_CLASSES[status]}`}>
                <Icon className="size-2.5" />
              </span>
              {attendanceStatusLabel[status]}
            </span>
          );
        })}
        <span className="inline-flex items-center gap-1.5">
          <span className={`h-1.5 w-1.5 rounded-full ${DOT_CLASSES.absent}`} />
          {attendanceStatusLabel.absent}
        </span>
      </div>
    </section>
  );
}
