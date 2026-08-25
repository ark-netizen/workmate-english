import { Outlet, useLocation } from "react-router-dom";
import { ConversationList } from "@/components/messenger/ConversationList";
import { useBusinessMode } from "@/context/useBusinessMode";

export function MessengerLayout() {
  const { pathname } = useLocation();
  const { businessMode } = useBusinessMode();
  const isIndex = pathname === "/messenger";
  const gameMode = businessMode;

  // TopBar는 64px이고 게임 모드에는 그 아래 6px 구분선이 하나 더 있다.
  // 메신저 자체 높이를 정확히 남은 뷰포트만큼 잡고 바깥 overflow를 막아서,
  // 페이지 스크롤과 대화 스크롤이 동시에 생기는 이중 스크롤을 없앤다.
  const messengerHeight = gameMode ? "calc(100dvh - 70px)" : "calc(100dvh - 64px)";

  return (
    <div className="flex overflow-hidden" style={{ height: messengerHeight }}>
      <div className={`${isIndex ? "flex" : "hidden"} min-h-0 md:flex`}>
        <ConversationList />
      </div>
      <div className={`${isIndex ? "hidden" : "flex"} min-h-0 min-w-0 flex-1 overflow-hidden md:flex`}>
        <Outlet />
      </div>
    </div>
  );
}
