import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { Bell, MessageCircleQuestion, Sparkles } from "lucide-react";
import { StatusBadge } from "@/components/ui/StatusBadge";
import { PresenceDot } from "@/components/ui/PresenceDot";
import { workStatusLabel, workStatusPresence, workStatusTone } from "@/lib/work-status";
import type { WorkStatus } from "@/types/domain";
import { Logo } from "@/components/ui/Logo";
import { useBusinessMode } from "@/context/useBusinessMode";
import { setStoredBusinessMode } from "@/lib/businessModePref";
import { AccountButton } from "./AccountButton";

export function TopBar({
  workStatus,
  unreadCount,
  onOpenChat,
}: {
  workStatus: WorkStatus;
  unreadCount: number;
  onOpenChat: () => void;
}) {
  const [now, setNow] = useState<Date | null>(null);
  const { businessMode, setBusinessMode } = useBusinessMode();

  useEffect(() => {
    const tick = () => setNow(new Date());
    tick();
    const timer = setInterval(tick, 60_000);
    return () => clearInterval(timer);
  }, []);

  return (
    <header
      className={`sticky top-0 z-10 flex h-16 items-center justify-between gap-3 px-4 md:px-6 ${
        businessMode ? "border-b-0 bg-[#5aa89a]" : "border-b border-border bg-surface"
      }`}
    >
      <div className="flex min-w-0 items-center gap-3">
        <Link to="/" className="shrink-0 md:hidden">
          <Logo compact />
        </Link>
        <span className={`h-4 w-px shrink-0 md:hidden ${businessMode ? "bg-white/30" : "bg-border"}`} aria-hidden="true" />
        <div className="flex shrink-0 items-center gap-1.5">
          <PresenceDot tone={workStatusPresence[workStatus]} />
          <StatusBadge tone={workStatusTone[workStatus]}>{workStatusLabel[workStatus]}</StatusBadge>
        </div>
        <span className={`hidden truncate text-sm sm:inline ${businessMode ? "text-white/70" : "text-foreground/50"}`}>
          {now
            ? now.toLocaleDateString("ko-KR", { timeZone: "Asia/Seoul", month: "long", day: "numeric", weekday: "short" })
            : ""}
        </span>
        <span className={`shrink-0 text-sm tabular-nums ${businessMode ? "text-white/80" : "text-foreground/60"}`}>
          {now
            ? now.toLocaleTimeString("ko-KR", {
                timeZone: "Asia/Seoul",
                hour: "2-digit",
                minute: "2-digit",
              })
            : "--:--"}
        </span>
      </div>
      <div className="flex shrink-0 items-center gap-2">
        <button
          type="button"
          onClick={() =>
            setBusinessMode((v) => {
              const next = !v;
              setStoredBusinessMode(next); // 직접 고른 값이니 저장 — 다른 페이지·다음 방문에도 유지
              return next;
            })
          }
          aria-label={`테마 전환 (현재 ${businessMode ? "비즈니스 모드" : "게임 모드"})`}
          className={`flex shrink-0 items-center gap-1.5 rounded-full border px-2 py-2 text-xs font-medium sm:px-3 sm:py-1.5 ${
            businessMode
              ? "border-white/50 text-white hover:bg-white/10"
              : "border-border text-foreground/70 hover:bg-black/[.03]"
          }`}
        >
          <Sparkles className="size-4" strokeWidth={2} />
          <span className="hidden sm:inline">{businessMode ? "비즈니스 모드" : "게임 모드"}</span>
        </button>
        <button
          type="button"
          onClick={onOpenChat}
          aria-label="도움말 챗봇 열기"
          className={`shrink-0 rounded-full border p-2 ${
            businessMode ? "border-white/50 text-white hover:bg-white/10" : "border-border text-foreground/70 hover:bg-black/[.03]"
          }`}
        >
          <MessageCircleQuestion className="size-4" strokeWidth={2} />
        </button>
        <Link
          to="/notifications"
          aria-label="알림"
          className={`relative shrink-0 rounded-full border p-2 ${
            businessMode ? "border-white/50 text-white hover:bg-white/10" : "border-border text-foreground/70 hover:bg-black/[.03]"
          }`}
        >
          <Bell className="size-4" strokeWidth={2} />
          {unreadCount > 0 && (
            <span className="absolute -top-1.5 -right-1.5 flex h-4 min-w-4 items-center justify-center rounded-full bg-accent px-1 text-[10px] font-medium text-white ring-2 ring-surface">
              {unreadCount}
            </span>
          )}
        </Link>
        <AccountButton />
      </div>
    </header>
  );
}
