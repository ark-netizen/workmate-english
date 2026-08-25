import { Outlet, useLocation } from "react-router-dom";
import { ConversationList } from "@/components/messenger/ConversationList";
import { useBusinessMode } from "@/context/useBusinessMode";

export function MessengerLayout() {
  const { pathname } = useLocation();
  const { businessMode } = useBusinessMode();
  const isIndex = pathname === "/messenger";
  const gameMode = businessMode;

  const messengerHeight = gameMode ? "calc(100dvh - 70px)" : "calc(100dvh - 64px)";

  return (
    <div className="messenger-layout flex overflow-hidden" style={{ height: messengerHeight }}>
      <div className={`${isIndex ? "flex" : "hidden"} min-h-0 md:flex`}>
        <ConversationList />
      </div>
      <div className={`${isIndex ? "hidden" : "flex"} min-h-0 min-w-0 flex-1 overflow-hidden md:flex`}>
        <Outlet />
      </div>
    </div>
  );
}
