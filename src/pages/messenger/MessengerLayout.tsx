import { Outlet, useLocation } from "react-router-dom";
import { ConversationList } from "@/components/messenger/ConversationList";
import { useWorkday } from "@/context/useWorkday";
import { TRIAL_ACTION_BAR_HEIGHT } from "@/components/trial/TrialActionBar";

export function MessengerLayout() {
  const { pathname } = useLocation();
  const { isTrial } = useWorkday();
  const isIndex = pathname === "/messenger";

  return (
    <div
      className="flex"
      style={{ height: isTrial ? `calc(100vh - 57px - ${TRIAL_ACTION_BAR_HEIGHT}px)` : "calc(100vh - 57px)" }}
    >
      <div className={`${isIndex ? "flex" : "hidden"} md:flex`}>
        <ConversationList />
      </div>
      <div className={`${isIndex ? "hidden" : "flex"} min-w-0 flex-1 md:flex`}>
        <Outlet />
      </div>
    </div>
  );
}
