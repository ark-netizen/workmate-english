import { Link } from "react-router-dom";
import type { TodayItem } from "@/types/domain";
import { useWorkday } from "@/context/useWorkday";
import { StatusBadge } from "@/components/ui/StatusBadge";
import { formatTime } from "@/lib/format";

const statusLabel = {
  pending: "대기",
  answered: "답변함",
  resolved: "완료",
} as const;

const statusTone = {
  pending: "pending",
  answered: "warning",
  resolved: "success",
} as const;

const channelStyle = {
  messenger: { label: "Messenger", className: "bg-accent/10 text-accent" },
  email: { label: "Email", className: "bg-slate-500/10 text-slate-600" },
} as const;

function initials(name?: string) {
  if (!name) return "";
  return name
    .split(" ")
    .map((part) => part[0])
    .join("")
    .slice(0, 2)
    .toUpperCase();
}

export function TodayItemRow({ item, highlighted }: { item: TodayItem; highlighted?: boolean }) {
  const { getContactById } = useWorkday();
  const contact = getContactById(item.contactId);
  const href = item.channel === "messenger" ? `/messenger/${item.targetId}` : `/email/${item.targetId}`;
  const channel = channelStyle[item.channel];
  const isUnread = item.status === "pending";

  return (
    <Link
      to={href}
      className={`flex items-center gap-3 rounded-lg border border-border bg-surface py-3 pl-4 pr-4 transition-shadow hover:bg-black/[.015] ${
        highlighted ? "ring-2 ring-accent ring-offset-2 animate-pulse" : ""
      }`}
    >
      <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-black/[.04] text-xs font-semibold text-foreground/70">
        {initials(contact?.name)}
      </span>
      <div className="min-w-0 flex-1">
        <div className="flex items-center gap-2">
          <span
            className={`inline-flex shrink-0 items-center rounded px-1.5 py-0.5 text-[10px] font-medium ${channel.className}`}
          >
            {channel.label}
          </span>
          <p className={`truncate text-sm ${isUnread ? "font-semibold" : "font-medium text-foreground/70"}`}>
            {contact?.name}
          </p>
          {item.kind === "review" && (
            <span className="shrink-0 rounded-full bg-blue-100 px-1.5 py-0.5 text-[10px] font-medium text-blue-700">
              복습
            </span>
          )}
          {item.kind === "checkin" && (
            <span className="shrink-0 rounded-full bg-black/[.06] px-1.5 py-0.5 text-[10px] font-medium text-foreground/60">
              추가 연락
            </span>
          )}
        </div>
        <p className={`truncate text-sm ${isUnread ? "text-foreground/80" : "text-foreground/50"}`}>
          {item.title}
        </p>
      </div>
      <span className="shrink-0 text-xs text-foreground/40">{formatTime(item.dueAt)}</span>
      <StatusBadge tone={statusTone[item.status]}>{statusLabel[item.status]}</StatusBadge>
    </Link>
  );
}
