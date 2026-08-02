import type { WorkStatus } from "@/types/domain";
import type { StatusTone } from "@/components/ui/StatusBadge";
import type { PresenceTone } from "@/components/ui/PresenceDot";

export const workStatusLabel: Record<WorkStatus, string> = {
  "before-work": "출근 전",
  working: "근무 중",
  "off-work": "퇴근",
  leave: "휴가",
};

export const workStatusTone: Record<WorkStatus, StatusTone> = {
  "before-work": "neutral",
  working: "success",
  "off-work": "neutral",
  leave: "pending",
};

export const workStatusPresence: Record<WorkStatus, PresenceTone> = {
  "before-work": "offline",
  working: "online",
  "off-work": "offline",
  leave: "away",
};
