import { Link, useLocation } from "react-router-dom";
import { navItems } from "./nav-items";
import { Logo } from "@/components/ui/Logo";
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

  const unreadByHref: Record<string, number> = {
    "/messenger": conversations.reduce((sum, c) => sum + c.unreadCount, 0),
    "/email": emailThreads.reduce((sum, t) => sum + t.unreadCount, 0),
  };

  return (
    <div className="sticky top-0 hidden h-screen self-start md:flex md:shrink-0">
      <aside
        id="tour-nav-desktop"
        className={`flex w-56 flex-col overflow-y-auto ${
          businessMode ? "border-r-0 bg-[#5aa89a]" : "border-r border-border bg-surface"
        }`}
      >
        {/* 로고 영역 높이를 TopBar와 똑같이 h-16으로 맞추고, 로고 자리와 디바이더 모두
            sticky top-*로 aside 자체 스크롤 위에 고정해서 내비게이션이 넘쳐 스크롤되어도
            로고+디바이더는 항상 화면에 고정되어 보이게 함(= TopBar 아래 디바이더와 폭만
            다를 뿐 같은 높이에서 끊김 없이 이어져 보임) */}
        <div
          className={`sticky top-0 z-10 flex h-16 shrink-0 items-center px-5 ${
            businessMode ? "bg-[#5aa89a]" : "bg-surface"
          }`}
        >
          <Link to="/">
            <Logo />
          </Link>
        </div>
        {businessMode && (
          <div className="business-divider-strip sticky top-16 z-10 shrink-0" aria-hidden="true" />
        )}
        <nav className="flex-1 px-3 py-3 space-y-1">
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
                className={`flex items-center gap-2.5 rounded-md px-3 py-2 text-sm transition-colors ${
                  businessMode
                    ? active
                      ? "bg-white/15 text-white font-medium"
                      : "text-white/80 hover:bg-black/[.03] hover:text-white"
                    : active
                      ? "bg-accent/10 text-accent font-medium"
                      : "text-foreground/70 hover:bg-black/[.03] hover:text-foreground"
                }`}
              >
                <Icon className="size-4 shrink-0" strokeWidth={2} />
                <span className="flex-1">{item.label}</span>
                {unread > 0 && (
                  <span className="inline-flex h-4 min-w-4 shrink-0 items-center justify-center rounded-full bg-red-500 px-1 text-[10px] font-semibold text-white">
                    {unread}
                  </span>
                )}
              </Link>
            );
          })}
        </nav>
      </aside>
    </div>
  );
}
