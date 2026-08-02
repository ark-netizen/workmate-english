export type AttendanceStatus =
  | "present"
  | "field-work"
  | "leave"
  | "absent"
  | "weekend"
  | "future"
  | "before-join";

export interface AttendanceDay {
  date: string;
  status: AttendanceStatus;
  checkInAt?: string;
  checkOutAt?: string;
}

export type MilestoneType = "streak" | "total";

export interface MilestoneDefinition {
  id: string;
  type: MilestoneType;
  threshold: number;
  label: string;
  description: string;
}

export interface Milestone extends MilestoneDefinition {
  achieved: boolean;
  progress: number;
}
