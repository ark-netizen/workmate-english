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

  return (
    <div className="flex min-h-screen w-full">
      <Sidebar />
      <div className="flex min-w-0 flex-1 flex-col">
        <TopBar
          workStatus={workStatus ?? "before-work"}
          unreadCount={unreadCount}
          onOpenChat={() => setChatOpen(true)}
        />
        {/* 기존 6px 높이는 그대로 유지해 본문 위치를 바꾸지 않고, 게임 모드에서만
            인트로의 픽셀/레트로 프레임과 맞는 얇은 구분선으로 보이게 한다. */}
        {gameMode && (
          <div
            className="sticky top-16 z-10 h-1.5 shrink-0 border-y-2 border-[#28352f] bg-[#eaf5dc]"
            aria-hidden="true"
          />
        )}
        <main className="min-w-0 flex-1 pb-16 md:pb-0">{children}</main>
        {isTrial && <TrialGuideBar />}
      </div>
      <MobileTabBar />
      {!isTrial && <InAppBanner />}
      <SurveyBanner />
      <SupportChatWidget open={chatOpen} onOpenChange={setChatOpen} showTrigger={pathname === "/"} />
    </div>
  );
}
