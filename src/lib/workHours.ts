import type { AttendanceStatus } from "@/types/attendance";

export interface WorkHoursDay {
  date: string;
  status: AttendanceStatus;
  minutes: number;
}

export const STANDARD_WORKDAY_MINUTES = 8 * 60;
