import type { StatusTone } from "@/components/ui/StatusBadge";
import type { AttendanceDay, AttendanceStatus, Milestone, MilestoneDefinition } from "@/types/attendance";

export const attendanceStatusLabel: Record<AttendanceStatus, string> = {
  present: "출근",
  "field-work": "외근",
  leave: "휴가",
  absent: "결근",
  weekend: "주말",
  future: "예정",
  "before-join": "",
};

export const attendanceStatusTone: Record<AttendanceStatus, StatusTone> = {
  present: "success",
  "field-work": "pending",
  leave: "warning",
  absent: "error",
  weekend: "neutral",
  future: "neutral",
  "before-join": "neutral",
};

const ATTENDED_STATUSES: AttendanceStatus[] = ["present", "field-work"];

function toDateKey(date: Date): string {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

function fromDateKey(key: string): Date {
  const [year, month, day] = key.split("-").map(Number);
  return new Date(year, month - 1, day);
}

export function getCurrentStreak(days: AttendanceDay[]): number {
  const byDate = [...days].sort((a, b) => (a.date < b.date ? 1 : -1));
  let streak = 0;

  for (const day of byDate) {
    if (day.status === "future") continue;
    if (day.status === "weekend") continue;
    if (ATTENDED_STATUSES.includes(day.status)) {
      streak += 1;
    } else {
      break;
    }
  }

  return streak;
}

export function getTotalAttendedDays(days: AttendanceDay[]): number {
  return days.filter((day) => ATTENDED_STATUSES.includes(day.status)).length;
}

export const MILESTONE_DEFINITIONS: MilestoneDefinition[] = [
  { id: "streak-3", type: "streak", threshold: 3, label: "3일 연속 출석", description: "3일 연속으로 출근했어요." },
  { id: "streak-7", type: "streak", threshold: 7, label: "7일 연속 출석", description: "일주일 연속 출근을 달성했어요." },
  { id: "streak-30", type: "streak", threshold: 30, label: "30일 연속 출석", description: "한 달 연속 출근, 꾸준함이 자리잡고 있어요." },
  { id: "streak-100", type: "streak", threshold: 100, label: "100일 연속 출석", description: "100일 연속 출근을 달성했어요." },
  { id: "total-20", type: "total", threshold: 20, label: "누적 출석 20일", description: "누적 출석일수 20일을 넘겼어요." },
  { id: "total-50", type: "total", threshold: 50, label: "누적 출석 50일", description: "누적 출석일수 50일을 넘겼어요." },
  { id: "total-100", type: "total", threshold: 100, label: "누적 출석 100일", description: "누적 출석일수 100일을 넘겼어요." },
];

export function evaluateMilestones(days: AttendanceDay[]): Milestone[] {
  const streak = getCurrentStreak(days);
  const total = getTotalAttendedDays(days);

  return MILESTONE_DEFINITIONS.map((definition) => {
    const current = definition.type === "streak" ? streak : total;
    return {
      ...definition,
      achieved: current >= definition.threshold,
      progress: Math.min(1, current / definition.threshold),
    };
  });
}

export interface CalendarCell {
  date: string;
  inCurrentMonth: boolean;
  day?: AttendanceDay;
}

export function buildMonthGrid(year: number, month: number, days: AttendanceDay[]): CalendarCell[] {
  const byDate = new Map(days.map((day) => [day.date, day]));
  const firstOfMonth = new Date(year, month, 1);
  const startOffset = firstOfMonth.getDay();
  const daysInMonth = new Date(year, month + 1, 0).getDate();

  const cells: CalendarCell[] = [];

  for (let i = 0; i < startOffset; i += 1) {
    const date = new Date(year, month, 1 - (startOffset - i));
    cells.push({ date: toDateKey(date), inCurrentMonth: false, day: byDate.get(toDateKey(date)) });
  }

  for (let day = 1; day <= daysInMonth; day += 1) {
    const date = new Date(year, month, day);
    const key = toDateKey(date);
    cells.push({ date: key, inCurrentMonth: true, day: byDate.get(key) });
  }

  while (cells.length % 7 !== 0) {
    const last = fromDateKey(cells[cells.length - 1].date);
    last.setDate(last.getDate() + 1);
    const key = toDateKey(last);
    cells.push({ date: key, inCurrentMonth: false, day: byDate.get(key) });
  }

  return cells;
}
