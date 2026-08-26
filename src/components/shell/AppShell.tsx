import { useEffect, useState } from "react";
import { useLocation } from "react-router-dom";
import { Sidebar } from "./Sidebar";
import { TopBar } from "./TopBar";
import { MobileTabBar } from "./MobileTabBar";
import { InAppBanner } from "./InAppBanner";
import { SupportChatWidget } from "@/components/support/SupportChatWidget";
import { SurveyBanner } from "@/components/support/SurveyBanner";
import { TrialGuideBarV2 } from "@/components/trial/TrialGuideBarV2";
import { TrialTourExitInjector } from "@/components/trial/TrialTourExitInjector";
import { useWorkday } from "@/context/useWorkday";
import { useBusinessMode } from "@/context/useBusinessMode";

export function AppShell({ children }: { children: React.ReactNode }) {
  const { workStatus, conversations, emailThreads, isTrial } = useWorkday();
  const { pathname } = useLocation();
  const { businessMode } = useBusinessMode();
  const gameMode = businessMode;
  const [chatOpen, setChatOpen] = useState(false);
  const unreadCount =
    conversations.reduce((sum, conversation) => sum + conversation.unreadCount, 0) +
    emailThreads.reduce((sum, thread) => sum + thread.unreadCount, 0);

  // 알림을 이미 허용해 둔 시연 브라우저는 설정의 "알림 켜기"를 다시 누르지 않을 수 있다.
  // 앱에 들어올 때 현재 등록된 서비스워커의 새 버전을 조용히 확인해서, 푸시 액션/외근 재알림
  // 수정사항이 오래된 sw.js 때문에 적용되지 않는 상황을 막는다. 권한 요청이나 신규 구독은 하지 않는다.
  useEffect(() => {
    if (!("serviceWorker" in navigator)) return;
    navigator.serviceWorker
      .getRegistration()
      .then((registration) => registration?.update())
      .catch(() => {});
  }, []);

  const shellTheme = gameMode
    ? ({
        "--background": "#eef5ec",
        "--foreground": "#28352f",
        "--surface": "#fbfcf7",
        "--border": "#cbd8cd",
        "--accent": "#2f795d",
        "--accent-2": "#f09a63",
      } as React.CSSProperties)
    : undefined;

  return (
    <div className={`flex min-h-screen w-full bg-background ${isTrial ? "trial-shell" : ""}`} style={shellTheme}>
      <Sidebar />
      <div className="flex min-h-0 min-w-0 flex-1 flex-col">
        <TopBar
          workStatus={workStatus ?? "before-work"}
          unreadCount={unreadCount}
          onOpenChat={() => setChatOpen(true)}
        />
        {gameMode && (
          <div
            className="sticky top-16 z-10 h-1.5 shrink-0 border-y-2 border-[#28352f] bg-[#dfeee5]"
            aria-hidden="true"
          />
        )}
        {/* 모바일에서는 TrialActionBar가 일반 흐름에 참여해서 메시지 입력창을 덮지 않는다.
            데스크톱에서는 TrialActionBar 자체가 fixed라 기존 우측 오버레이 동작을 그대로 유지한다. */}
        {isTrial && <TrialGuideBarV2 />}
        {isTrial && <TrialTourExitInjector />}
        <main className="min-h-0 min-w-0 flex-1 bg-background pb-16 md:pb-0">{children}</main>
      </div>
      <MobileTabBar />
      {!isTrial && <InAppBanner />}
      {!isTrial && <SurveyBanner />}
      <SupportChatWidget
        open={chatOpen}
        onOpenChange={setChatOpen}
        showTrigger={isTrial && pathname === "/"}
      />
    </div>
  );
}
