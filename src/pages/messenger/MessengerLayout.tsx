import { Outlet, useLocation } from "react-router-dom";
import { ConversationList } from "@/components/messenger/ConversationList";

export function MessengerLayout() {
  const { pathname } = useLocation();
  const isIndex = pathname === "/messenger";

  return (
    <div className="flex" style={{ height: "calc(100vh - 57px)" }}>
      <div className={`${isIndex ? "flex" : "hidden"} md:flex`}>
        <ConversationList />
      </div>
      <div className={`${isIndex ? "hidden" : "flex"} min-w-0 flex-1 md:flex`}>
        <Outlet />
      </div>
    </div>
  );
}
