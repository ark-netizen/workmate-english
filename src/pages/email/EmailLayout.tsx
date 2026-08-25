import { Outlet, useLocation } from "react-router-dom";
import { EmailList } from "@/components/email/EmailList";
import { useBusinessMode } from "@/context/useBusinessMode";

export function EmailLayout() {
  const { pathname } = useLocation();
  const { businessMode } = useBusinessMode();
  const isIndex = pathname === "/email";
  const gameMode = businessMode;

  const emailHeight = gameMode ? "calc(100dvh - 70px)" : "calc(100dvh - 64px)";

  return (
    <div className="email-layout flex overflow-hidden" style={{ height: emailHeight }}>
      <div className={`${isIndex ? "flex" : "hidden"} min-h-0 md:flex`}>
        <EmailList />
      </div>
      <div className={`${isIndex ? "hidden" : "flex"} min-h-0 min-w-0 flex-1 overflow-hidden md:flex`}>
        <Outlet />
      </div>
    </div>
  );
}
