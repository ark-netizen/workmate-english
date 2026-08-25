import { useEffect, useState } from "react";
import type { ReactNode } from "react";
import { Navigate, Route, Routes, useLocation, useNavigate } from "react-router-dom";
import * as api from "@/lib/api";
import { startFreshGuestTrial, hasRealSession } from "@/lib/session";
import { AppShell } from "@/components/shell/AppShell";
import { CopyrightNotice } from "@/components/ui/CopyrightNotice";
import { BusinessModeProvider } from "@/context/BusinessModeContext";
import { WorkdayProvider } from "@/context/WorkdayContext";
import { useWorkday } from "@/context/useWorkday";
import { HomePage } from "@/pages/HomePage";
import { IntroPage } from "@/pages/IntroPage";
import { OnboardingPage } from "@/pages/OnboardingPage";
import { PrivacyPolicyPage } from "@/pages/PrivacyPolicyPage";
import { AdminPage } from "@/pages/AdminPage";
import { QaPanelPage } from "@/pages/QaPanelPage";
import { MessengerLayout } from "@/pages/messenger/MessengerLayout";
import { MessengerIndexPage } from "@/pages/messenger/MessengerIndexPage";
import { ConversationPage } from "@/pages/messenger/ConversationPage";
import { VentStartPage } from "@/pages/messenger/VentStartPage";
import { EmailLayout } from "@/pages/email/EmailLayout";
import { EmailIndexPage } from "@/pages/email/EmailIndexPage";
import { ComposeEmailPage } from "@/pages/email/ComposeEmailPage";
import { EmailThreadPage } from "@/pages/email/EmailThreadPage";
import { NotificationsPage } from "@/pages/NotificationsPage";
import { AttendancePage } from "@/pages/AttendancePage";
import { WorkHoursPage } from "@/pages/WorkHoursPage";
import { ReportsPage } from "@/pages/ReportsPage";
import { EvaluationPage } from "@/pages/EvaluationPage";
import { SettingsPage } from "@/pages/SettingsPage";
import { NoticePage } from "@/pages/NoticePage";
import { NotFoundPage } from "@/pages/NotFoundPage";

function StandalonePage({ children }: { children: ReactNode }) {
  return (
    <div className="flex min-h-screen flex-col">
      <div className="flex-1">{children}</div>
      <footer className="border-t border-border/60 bg-background px-4 py-4 text-center">
        <CopyrightNotice className="text-[10px] leading-4 text-foreground/40" />
      </footer>
    </div>
  );
}

function AppRoutes() {
  const location = useLocation();
  const navigate = useNavigate();
  const { loading, error, needsOnboarding, refresh } = useWorkday();

  // 로그인한 계정이 관리자면 온보딩/홈으로 안 보내고 바로 관리자 대시보드로
  const redirectIfAdmin = async () => {
    try {
      const dash = await api.getAdminDashboard();
      if (dash.role) {
        navigate("/admin");
        return true;
      }
    } catch {
      /* 관리자 아니면 403 — 그냥 일반 플로우 진행 */
    }
    return false;
  };

  // 러프한 인트로 게이트: 새로고침/재방문할 때마다 매번 노출(영구 저장 안 함).
  const [entered, setEntered] = useState(() => {
    // 카카오 등 OAuth 콜백으로 돌아온 경우(#access_token / ?code)만 인트로 건너뛰기
    if (typeof window !== "undefined") {
      if (window.location.hash.includes("access_token") || window.location.search.includes("code=")) {
        return true;
      }
    }
    return false;
  });
  // 알림(웹푸시) 클릭으로 새 탭이 열린 경우처럼, 실계정으로 이미 로그인된 세션이 남아있으면
  // 인트로(소개) 화면을 거치지 않고 바로 앱으로 들어가야 함 — 확인 전까지 잠깐 로딩만 보여준다
  const [checkingRealSession, setCheckingRealSession] = useState(!entered);

  useEffect(() => {
    if (entered) return;
    let cancelled = false;
    hasRealSession().then((yes) => {
      if (cancelled) return;
      if (yes) setEntered(true);
      setCheckingRealSession(false);
    });
    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // 로그아웃하면 익명 게스트로 조용히 이어지지 않고, 소개 페이지(/intro)로 명시적으로 돌아가야 함
  useEffect(() => {
    const onForceIntro = () => {
      setEntered(false);
      navigate("/intro", { replace: true });
    };
    window.addEventListener("go:force-intro", onForceIntro);
    return () => window.removeEventListener("go:force-intro", onForceIntro);
  }, [navigate]);

  // 로그인/온보딩 상태와 무관하게 항상 열람 가능해야 함
  if (location.pathname === "/privacy") {
    return (
      <StandalonePage>
        <PrivacyPolicyPage />
      </StandalonePage>
    );
  }
  if (location.pathname === "/admin") {
    return <AdminPage />;
  }
  // 듀얼 모니터로 시연 녹화할 때 QA 도구만 따로 띄우는 창 — AppShell 없이 단독 페이지로 연다
  if (location.pathname === "/qa") {
    return <QaPanelPage />;
  }

  // 소개(랜딩)와 실제 서비스는 URL을 분리 — 소개는 항상 /intro, 서비스는 / 이하
  if (entered && location.pathname === "/intro") {
    return <Navigate to="/" replace />;
  }

  if (!entered && checkingRealSession) {
    return (
      <div className="flex min-h-screen items-center justify-center">
        <div className="flex flex-col items-center gap-3 text-sm text-foreground/50">
          <span className="h-5 w-5 animate-spin rounded-full border-2 border-border border-t-accent" />
          불러오는 중...
        </div>
      </div>
    );
  }

  if (!entered) {
    if (location.pathname !== "/intro") {
      return <Navigate to="/intro" replace />;
    }
    return (
      <StandalonePage>
        <IntroPage
          onContinueWithoutLogin={async () => {
            await startFreshGuestTrial();
            await refresh();
            setEntered(true);
          }}
          onLoggedIn={async () => {
            // refresh()와 관리자 여부 확인은 서로 결과가 필요 없는 독립적인 요청이라
            // 병렬로 실행 — 순서대로 기다리면 그만큼 전환이 버벅거려 보임.
            const [, isAdmin] = await Promise.all([refresh(), redirectIfAdmin()]);
            if (!isAdmin) setEntered(true);
          }}
        />
      </StandalonePage>
    );
  }

  if (loading) {
    return (
      <div className="flex min-h-screen items-center justify-center">
        <div className="flex flex-col items-center gap-3 text-sm text-foreground/50">
          <span className="h-5 w-5 animate-spin rounded-full border-2 border-border border-t-accent" />
          불러오는 중...
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="flex min-h-screen flex-col items-center justify-center gap-3 px-4 text-center">
        <p className="text-sm text-foreground/60">{error}</p>
        <button
          type="button"
          onClick={() => refresh()}
          className="rounded-md border border-border px-3 py-1.5 text-sm text-foreground/70 hover:bg-black/[.03]"
        >
          다시 시도
        </button>
      </div>
    );
  }

  if (needsOnboarding) {
    return (
      <Routes>
        <Route
          path="*"
          element={
            <StandalonePage>
              <OnboardingPage />
            </StandalonePage>
          }
        />
      </Routes>
    );
  }

  return (
    <AppShell>
      <Routes>
        <Route index element={<HomePage />} />
        <Route path="onboarding" element={<Navigate to="/" replace />} />
        <Route path="messenger" element={<MessengerLayout />}>
          <Route index element={<MessengerIndexPage />} />
          <Route path="vent" element={<VentStartPage />} />
          <Route path=":conversationId" element={<ConversationPage />} />
        </Route>
        <Route path="email" element={<EmailLayout />}>
          <Route index element={<EmailIndexPage />} />
          <Route path="compose" element={<ComposeEmailPage />} />
          <Route path=":threadId" element={<EmailThreadPage />} />
        </Route>
        <Route path="notifications" element={<NotificationsPage />} />
        <Route path="attendance" element={<AttendancePage />} />
        <Route path="hours" element={<WorkHoursPage />} />
        <Route path="reports" element={<ReportsPage />} />
        <Route path="evaluation" element={<EvaluationPage />} />
        <Route path="settings" element={<SettingsPage />} />
        <Route path="notice" element={<NoticePage />} />
        <Route path="*" element={<NotFoundPage />} />
      </Routes>
    </AppShell>
  );
}

export function App() {
  return (
    <BusinessModeProvider>
      <WorkdayProvider>
        <AppRoutes />
      </WorkdayProvider>
    </BusinessModeProvider>
  );
}
