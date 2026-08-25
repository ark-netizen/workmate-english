import { Link, useLocation } from "react-router-dom";
import { navItems } from "./nav-items";
import { Logo } from "@/components/ui/Logo";
import { CopyrightNotice } from "@/components/ui/CopyrightNotice";
import { useWorkday } from "@/context/useWorkday";
import { useBusinessMode } from "@/context/useBusinessMode";

function isActive(pathname: string, href: string) {
  if (href === "/") return pathname === "/";
  return pathname.startsWith(href);
}

export function Sidebar() {
  const { pathname } = useLocation();
  const { conversations, emailThreads } = useWorkday();
  const { businessMode } = useBusinessMode();
  // 이 프로젝트에서 businessMode=true는 실제 UI상 게임 모드다.
  const gameMode = businessMode;

  const unreadByHref: Record<string, number> = {
    "/messenger": conversations.reduce((sum, c) => sum + c.unreadCount, 0),
    "/email": emailThreads.reduce((sum, t) => sum + t.unreadCount, 0),
  };

  return (
    <div className="sticky top-0 hidden h-screen self-start md:flex md:shrink-0">
      <aside
        id="tour-nav-desktop"
        className={`flex w-56 flex-col overflow-y-auto ${
          gameMode
            ? "border-r-[3px] border-[#28352f] bg-[#5fb8b0]"
            : "border-r border-[#dfe5ef] bg-white"
        }`}
      >
        <div
          className={`sticky top-0 z-10 flex h-16 shrink-0 items-center justify-center px-5 ${gameMode ? "bg-[#5fb8b0]" : "bg-white"}`}
        >
          <Link to="/">
            <Logo />
          </Link>
        </div>

        {/* 기존 6px 공간은 유지하되, 게임 모드에서는 인트로의 레트로 프레임 무드에 맞춘 얇은 구분선으로 바꾼다. */}
        {gameMode && (
          <div
            className="sticky top-16 z-10 h-1.5 shrink-0 border-y-2 border-[#28352f] bg-[#eaf5dc]"
            aria-hidden="true"
          />
        )}

        <nav className="flex-1 space-y-1 px-3 py-3">
          {navItems.map((item) => {
            const active = isActive(pathname, item.href);
            const Icon = item.icon;
            const unread = unreadByHref[item.href] ?? 0;
            return (
              <Link
                key={item.href}
                to={item.href}
                title={item.labelKo}
                data-tour-navitem={item.href}
                className={`flex items-center gap-2.5 px-3 py-2 text-sm transition-colors ${
                  gameMode
                    ? active
                      ? "rounded-[3px] bg-[#ffe28a] font-bold text-[#28352f] shadow-[2px_2px_0_#28352f] ring-2 ring-[#28352f]"
                      : "rounded-[3px] font-medium text-[#24483b] hover:bg-white/25 hover:text-[#173d35]"
                    : active
                      ? "rounded-md bg-[#edf3ff] font-semibold text-[#174fae]"
                      : "rounded-md text-[#5f6f86] hover:bg-[#f5f8fd] hover:text-[#172033]"
                }`}
              >
                <Icon className="size-4 shrink-0" strokeWidth={2} />
                <span className="flex-1">{item.label}</span>
                {unread > 0 && (
                  <span className="inline-flex h-4 min-w-4 shrink-0 items-center justify-center rounded-full bg-[#e53935] px-1 text-[10px] font-bold text-white">
                    {unread}
                  </span>
                )}
              </Link>
            );
          })}
        </nav>

        <CopyrightNotice
          className={`shrink-0 px-4 pb-4 text-[9px] leading-4 ${
            gameMode ? "text-[#24483b]/65" : "text-[#7d8ba0]"
          }`}
        />
      </aside>
    </div>
  );
}
