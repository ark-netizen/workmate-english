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
  const gameMode = businessMode;
  const [chatOpen, setChatOpen] = useState(false);
  const unreadCount =
    conversations.reduce((sum, conversation) => sum + conversation.unreadCount, 0) +
    emailThreads.reduce((sum, thread) => sum + thread.unreadCount, 0);

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
        {isTrial && <TrialGuideBar />}
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
