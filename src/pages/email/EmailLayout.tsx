import { Outlet, useLocation } from "react-router-dom";
import { EmailList } from "@/components/email/EmailList";
import { useBusinessMode } from "@/context/useBusinessMode";

export function EmailLayout() {
  const { pathname } = useLocation();
  const { businessMode } = useBusinessMode();
  const isIndex = pathname === "/email";
  const gameMode = businessMode;

  // TopBar는 64px이고 게임 모드에는 그 아래 6px 구분선이 하나 더 있다.
  // 이메일 영역을 남은 뷰포트 안에 정확히 고정해 작성창/보내기 버튼이 화면 아래로 밀리지 않게 한다.
  const emailHeight = gameMode ? "calc(100dvh - 70px)" : "calc(100dvh - 64px)";

  return (
    <div className="flex overflow-hidden" style={{ height: emailHeight }}>
      <div className={`${isIndex ? "flex" : "hidden"} min-h-0 md:flex`}>
        <EmailList />
      </div>
      <div className={`${isIndex ? "hidden" : "flex"} min-h-0 min-w-0 flex-1 overflow-hidden md:flex`}>
        <Outlet />
      </div>
    </div>
  );
}
