import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { Bell, Briefcase, Gamepad2, MessageCircleQuestion } from "lucide-react";
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
  // businessMode=true가 실제 화면에서는 게임 모드로 쓰인다.
  const gameMode = businessMode;

  useEffect(() => {
    const tick = () => setNow(new Date());
    tick();
    const timer = setInterval(tick, 60_000);
    return () => clearInterval(timer);
  }, []);

  return (
    <header
      className={`sticky top-0 z-10 flex h-16 items-center justify-between gap-3 px-4 md:px-6 ${
        gameMode ? "bg-[#5fb8b0]" : "border-b border-[#dfe5ef] bg-white"
      }`}
    >
      <div className="flex min-w-0 items-center gap-3">
        <Link to="/" className="shrink-0 md:hidden">
          <Logo compact />
        </Link>
        <span
          className={`h-4 w-px shrink-0 md:hidden ${gameMode ? "bg-[#28352f]/35" : "bg-[#dfe5ef]"}`}
          aria-hidden="true"
        />
        <div className="flex shrink-0 items-center gap-2">
          <PresenceDot
            tone={workStatusPresence[workStatus]}
            className={gameMode ? "ring-[3px] ring-[#fffaf0] shadow-[0_0_0_1px_#28352f]" : ""}
          />
          <StatusBadge tone={workStatusTone[workStatus]}>{workStatusLabel[workStatus]}</StatusBadge>
        </div>
        <span className={`hidden truncate text-sm sm:inline ${gameMode ? "font-medium text-[#24483b]/75" : "text-[#6b7a90]"}`}>
          {now
            ? now.toLocaleDateString("ko-KR", { timeZone: "Asia/Seoul", month: "long", day: "numeric", weekday: "short" })
            : ""}
        </span>
        <span className={`shrink-0 text-sm tabular-nums ${gameMode ? "font-semibold text-[#24483b]" : "text-[#5f6f86]"}`}>
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
        <div
          role="group"
          aria-label="모드 선택"
          className={`flex shrink-0 items-center gap-0.5 p-0.5 ${
            gameMode
              ? "rounded-md border-2 border-[#28352f] bg-[#eaf7f5] shadow-[2px_2px_0_rgba(40,53,47,.22)]"
              : "rounded-full border border-[#cbd6e6] bg-white"
          }`}
        >
          {(
            [
              { key: "game", active: gameMode, Icon: Gamepad2, label: "게임" },
              { key: "business", active: !gameMode, Icon: Briefcase, label: "비즈니스" },
            ] as const
          ).map(({ key, active, Icon, label }) => (
            <button
              key={key}
              type="button"
              onClick={() => {
                if (active) return;
                const next = key === "game";
                setBusinessMode(next);
                setStoredBusinessMode(next);
              }}
              aria-pressed={active}
              aria-label={`${label} 모드${active ? " (현재 선택됨)" : "로 전환"}`}
              style={{
                backgroundColor: active ? (gameMode ? "#ffe28a" : "#1a56ff") : "transparent",
                color: active ? (gameMode ? "#28352f" : "#ffffff") : undefined,
              }}
              className={`flex items-center gap-1 px-2 py-1.5 text-xs font-semibold transition-colors ${
                gameMode ? "rounded-[3px]" : "rounded-full"
              } ${
                active
                  ? ""
                  : gameMode
                    ? "text-[#31524b] hover:bg-white/30"
                    : "text-[#6b7a90] hover:bg-[#f5f8fd]"
              }`}
            >
              <Icon className="size-4" strokeWidth={2} />
              <span className="hidden sm:inline">{label}</span>
            </button>
          ))}
        </div>

        <button
          type="button"
          onClick={onOpenChat}
          aria-label="도움말 챗봇 열기"
          className={`shrink-0 p-2 transition-colors ${
            gameMode
              ? "rounded-[4px] border-2 border-[#28352f] bg-[#fff9e9] text-[#28352f] shadow-[2px_2px_0_#28352f] hover:bg-white"
              : "rounded-full border border-[#cbd6e6] bg-white text-[#55708f] hover:bg-[#f5f8fd]"
          }`}
        >
          <MessageCircleQuestion className="size-4" strokeWidth={2} />
        </button>

        <Link
          to="/notifications"
          aria-label="알림"
          className={`relative shrink-0 p-2 transition-colors ${
            gameMode
              ? "rounded-[4px] border-2 border-[#28352f] bg-[#fff9e9] text-[#28352f] shadow-[2px_2px_0_#28352f] hover:bg-white"
              : "rounded-full border border-[#cbd6e6] bg-white text-[#55708f] hover:bg-[#f5f8fd]"
          }`}
        >
          <Bell className="size-4" strokeWidth={2} />
          {unreadCount > 0 && (
            <span
              className={`absolute -right-1.5 -top-1.5 flex h-4 min-w-4 items-center justify-center rounded-full bg-[#e53935] px-1 text-[10px] font-bold text-white ring-2 ${
                gameMode ? "ring-[#fff9e9]" : "ring-white"
              }`}
            >
              {unreadCount}
            </span>
          )}
        </Link>
        <AccountButton />
      </div>
    </header>
  );
}
