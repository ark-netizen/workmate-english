import { useState } from "react";
import { useLocation } from "react-router-dom";
import { Sidebar } from "./Sidebar";
import { TopBar } from "./TopBar";
import { MobileTabBar } from "./MobileTabBar";
import { InAppBanner } from "./InAppBanner";
import { SupportChatWidget } from "@/components/support/SupportChatWidget";
import { SurveyBanner } from "@/components/support/SurveyBanner";
import { TrialGuideBar } from "@/components/trial/TrialGuideBar";
import { useWorkday } from "@/context/useWorkday";
import { useBusinessMode } from "@/context/useBusinessMode";

export function AppShell({ children }: { children: React.ReactNode }) {
  const { workStatus, conversations, emailThreads, isTrial } = useWorkday();
  const { pathname } = useLocation();
  const { businessMode } = useBusinessMode();
  const [chatOpen, setChatOpen] = useState(false);
  const unreadCount =
    conversations.reduce((sum, conversation) => sum + conversation.unreadCount, 0) +
    emailThreads.reduce((sum, thread) => sum + thread.unreadCount, 0);

  // 체험 계정의 안내 카드(TrialGuideBar)는 이제 오버레이(화면 우측 중앙에 떠 있는 카드)라서
  // 실제 레이아웃 공간을 차지하지 않으므로, 일반 계정과 동일한 스크롤 방식을 그대로 쓴다
  return (
    <div className="flex w-full min-h-screen">
      <Sidebar />
      <div className="flex flex-1 flex-col min-w-0">
        <TopBar
          workStatus={workStatus ?? "before-work"}
          unreadCount={unreadCount}
          onOpenChat={() => setChatOpen(true)}
        />
        {/* TopBar가 h-16 고정 높이라서 top-16으로 그 바로 아래에 sticky 고정 — 스크롤해도
            안 사라지고, 사이드바 쪽(Sidebar.tsx)의 로고 밑 디바이더와 같은 높이(h-16 기준)라
            폭만 다를 뿐 끊김 없이 이어져 보인다 */}
        {businessMode && (
          <div className="business-divider-strip sticky top-16 z-10" aria-hidden="true" />
        )}
        <main className="flex-1 min-w-0 pb-16 md:pb-0">{children}</main>
        {isTrial && <TrialGuideBar />}
      </div>
      <MobileTabBar />
      {/* 체험판은 TrialGuideBar가 자체적으로 "메시지가 왔어요" 연출을 단계적으로 보여주므로,
          같은 타이밍에 뜨는 별도 알림 배너는 오히려 정신없어 보여서 끈다 */}
      {!isTrial && <InAppBanner />}
      <SurveyBanner />
      {/* 일반 계정과 체험 계정 모두 홈에서는 동일한 떠다니는 챗봇 진입 버튼을 보여주고,
          다른 화면에서는 상단바의 "?" 버튼으로 챗봇을 열 수 있게 한다 */}
      <SupportChatWidget open={chatOpen} onOpenChange={setChatOpen} showTrigger={pathname === "/"} />
    </div>
  );
}
