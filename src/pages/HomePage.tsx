import { useEffect, useState } from "react";
import type { ReactNode } from "react";
import { Link } from "react-router-dom";
import * as api from "@/lib/api";
import { useWorkday } from "@/context/useWorkday";
import { TodayItemRow } from "@/components/home/TodayItemRow";
import { ProfileHoursCard } from "@/components/home/ProfileHoursCard";
import { WorkStatusMenu } from "@/components/shell/WorkStatusMenu";
import { ConfirmDialog } from "@/components/ui/ConfirmDialog";
import { formatTime } from "@/lib/format";
import type { ProfileResponse } from "@/types/api";
import type { PromotionStatus } from "@/lib/api";
import { RANKS } from "@/components/promotion/rankArt";
import { isAutoAdvanceEnabled, setAutoAdvance } from "@/lib/qaAutoAdvance";
import { SectionTourGuide, type TourStep } from "@/components/home/SectionTourGuide";
import { isAnonymousSession } from "@/lib/session";

// 심사 기간 등 외부에 라이브 사이트를 공개하는 동안은, 데이터를 실제로 지우거나 조작하는
// 위험한 QA 버튼(초기화/승급 게이트 채우기 등)은 숨긴다 — 실수로 눌러도 안전한 "연락 바로
// 받기" 계열만 남겨서 기능 시연은 여전히 가능하게 함. 기간이 끝나면 true로 되돌리면 됨.
const SHOW_DESTRUCTIVE_QA_TOOLS = false;

// 직급별 승급에 필요한 "연속 출근일수" — server/promotion.js의 DAYS_PER_STEP(30)와 반드시 같은 값이어야 함
const RANK_DAYS_PER_STEP = 30;
const RANK_STEPS = RANKS.slice(0, -1).map((from, i) => ({
  from,
  to: RANKS[i + 1],
  days: RANK_DAYS_PER_STEP * (i + 1),
}));

// 개발/QA 전용 버튼 모음 — 화면 우측에 별도 컨트롤러로 띄워서 실제 UI와 섞이지 않게 하고,
// 캡처 등에서 안 보이게 접을 수 있게 함. 접은 상태는 저장하지 않아 새로고침하면 다시 펼쳐진 채로 보인다.
function QaControlPanel({
  onDeliverNext,
  deliveringNext,
  onResetToday,
  resettingToday,
  onBackfillDays,
  backfillingDays,
  onAdvanceDay,
  advancingDay,
  onResetAccount,
  resettingAccount,
}: {
  onDeliverNext: () => void;
  deliveringNext: boolean;
  onResetToday: () => void;
  resettingToday: boolean;
  onBackfillDays: (days: number) => void;
  backfillingDays: number | null;
  onAdvanceDay: () => void;
  advancingDay: boolean;
  onResetAccount: () => void;
  resettingAccount: boolean;
}) {
  const [collapsed, setCollapsed] = useState(false);
  const [autoAdvance, setAutoAdvanceState] = useState(() => isAutoAdvanceEnabled());

  if (collapsed) {
    return (
      <button
        type="button"
        onClick={() => setCollapsed(false)}
        className="fixed right-3 top-20 z-40 rounded-full border border-dashed border-foreground/30 bg-surface px-2.5 py-1.5 text-xs text-foreground/50 shadow-sm hover:bg-black/[.03]"
      >
        QA
      </button>
    );
  }

  return (
    <div className="fixed right-3 top-20 z-40 w-52 space-y-1.5 rounded-xl border border-dashed border-foreground/30 bg-surface p-3 shadow-lg">
      <div className="mb-1 flex items-center justify-between">
        <span className="text-[11px] font-semibold uppercase tracking-wide text-foreground/40">QA 도구</span>
        <div className="flex items-center gap-1">
          <button
            type="button"
            onClick={() => {
              window.open("/qa", "qa-panel", "width=280,height=640,noopener");
              setCollapsed(true);
            }}
            title="듀얼 모니터로 녹화할 때, QA 도구만 별도 창으로 열어서 다른 모니터에 둘 수 있어요"
            aria-label="QA 도구 새 창으로 분리"
            className="rounded px-1.5 text-xs leading-none text-foreground/40 hover:bg-black/[.05]"
          >
            ⧉
          </button>
          <button
            type="button"
            onClick={() => setCollapsed(true)}
            aria-label="QA 패널 접기"
            className="rounded px-1.5 text-sm leading-none text-foreground/40 hover:bg-black/[.05]"
          >
            −
          </button>
        </div>
      </div>
      <button
        type="button"
        onClick={() => {
          const next = !autoAdvance;
          setAutoAdvance(next);
          setAutoAdvanceState(next);
        }}
        title="켜두면 답장을 보낼 때마다, 그 답장 하나에 대해서만 다음 연락이 바로 도착합니다(전체가 한번에 오지 않음)"
        className={`w-full rounded-md border border-dashed px-2.5 py-1.5 text-left text-xs font-medium disabled:opacity-50 ${
          autoAdvance
            ? "border-green-500 bg-green-50 text-green-700"
            : "border-foreground/30 text-foreground/60 hover:bg-black/[.03]"
        }`}
      >
        자동 진행(시연용): {autoAdvance ? "ON" : "OFF"}
      </button>
      <button
        type="button"
        onClick={onDeliverNext}
        disabled={deliveringNext}
        title="다음 예정 연락을 예정 시각과 상관없이 바로 발송합니다"
        className="w-full rounded-md border border-dashed border-amber-400 px-2.5 py-1.5 text-left text-xs font-medium text-amber-600 hover:bg-amber-50 disabled:opacity-50"
      >
        {deliveringNext ? "받는 중..." : "연락 바로 받기"}
      </button>
      {SHOW_DESTRUCTIVE_QA_TOOLS && (
        <>
          <button
            type="button"
            onClick={onResetToday}
            disabled={resettingToday}
            title="오늘 workday를 삭제해서 출근 전 상태로 되돌립니다(같은 날 반복 테스트용)"
            className="w-full rounded-md border border-dashed border-red-300 px-2.5 py-1.5 text-left text-xs font-medium text-red-600 hover:bg-red-50 disabled:opacity-50"
          >
            {resettingToday ? "초기화 중..." : "오늘 초기화"}
          </button>
          <div className="space-y-1 border-t border-dashed border-foreground/20 pt-1.5">
            <p className="px-0.5 text-[10px] font-medium text-foreground/40">
              직급별 승급 게이트 채우기 (현재 직급 기준으로 골라 누르기)
            </p>
            {RANK_STEPS.map((step) => (
              <button
                key={step.days}
                type="button"
                onClick={() => onBackfillDays(step.days)}
                disabled={backfillingDays !== null}
                title={`지난 ${step.days}일치 더미 근무 기록을 채워 ${step.from}→${step.to} 승급 조건을 채웁니다`}
                className="w-full rounded-md border border-dashed border-blue-300 px-2.5 py-1.5 text-left text-xs font-medium text-blue-600 hover:bg-blue-50 disabled:opacity-50"
              >
                {backfillingDays === step.days ? "채우는 중..." : `+${step.days}일 (${step.from}→${step.to})`}
              </button>
            ))}
          </div>
          <button
            type="button"
            onClick={onAdvanceDay}
            disabled={advancingDay}
            title="오늘을 마감하고 다음 접속 시 새로운 하루로 취급되게 합니다(대화 연속성 테스트용)"
            className="w-full rounded-md border border-dashed border-emerald-300 px-2.5 py-1.5 text-left text-xs font-medium text-emerald-600 hover:bg-emerald-50 disabled:opacity-50"
          >
            {advancingDay ? "넘기는 중..." : "다음날로 넘기기"}
          </button>
          <button
            type="button"
            onClick={onResetAccount}
            disabled={resettingAccount}
            title="이 계정의 근무 기록·연차·승급 이력·프로필을 전부 지우고 온보딩부터 다시 시작합니다"
            className="w-full rounded-md border border-dashed border-violet-400 px-2.5 py-1.5 text-left text-xs font-medium text-violet-600 hover:bg-violet-50 disabled:opacity-50"
          >
            {resettingAccount ? "초기화 중..." : "계정 전체 초기화"}
          </button>
        </>
      )}
    </div>
  );
}

// "오늘의 연락" 목록 맨 아래에 항상 붙는 고함항아리 입구 — 개수가 많아져도 스크롤 맨 아래에서 바로 눌러 들어갈 수 있게
function ShoutJarTodayRow() {
  const { conversations } = useWorkday();
  const ventConversation = conversations.find((c) => c.kind === "vent");
  const to = ventConversation ? `/messenger/${ventConversation.id}` : "/messenger/vent";

  return (
    <Link
      to={to}
      className="flex items-center gap-3 rounded-lg border border-violet-200 bg-violet-50/50 py-3 pl-4 pr-4 transition-colors hover:bg-violet-50"
    >
      <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-violet-100 text-base">
        🫙
      </span>
      <div className="min-w-0 flex-1">
        <p className="truncate text-sm font-medium text-violet-900">고함항아리</p>
        <p className="truncate text-sm text-violet-700/70">스트레스 받을 때 소리질러보세요!</p>
      </div>
    </Link>
  );
}

// 하나의 박스(section) 안에 여러 항목이 같은 간격으로 들어감 — 항목별 박스 아님.
// 값이 일반 텍스트든 (WorkStatusMenu 같은) 인터랙티브 칩이든 높이가 달라도 위쪽 기준으로 가지런히 맞춘다
const ROLE_LABEL_KO: Record<"colleague" | "manager" | "client", string> = {
  colleague: "동료",
  manager: "상사",
  client: "거래처",
};

function StatTile({ label, value, className }: { label: string; value: ReactNode; className?: string }) {
  return (
    <div className={`flex flex-col gap-1.5 ${className ?? ""}`}>
      <p className="text-xs font-medium text-foreground/50">{label}</p>
      <div className="flex min-h-6 items-center text-sm font-semibold text-foreground">{value}</div>
    </div>
  );
}

export function HomePage() {
  const {
    workStatus,
    workday,
    todayItems,
    conversations,
    emailThreads,
    deliverNext,
    finishWorkday,
    refresh,
    highlightedMessageId,
    pendingReviewBanner,
    leaveBalance,
    workContext,
  } = useWorkday();
  const [deliveringNext, setDeliveringNext] = useState(false);
  const [profile, setProfile] = useState<ProfileResponse | null>(null);
  const [confirmFinish, setConfirmFinish] = useState(false);
  const [finishing, setFinishing] = useState(false);
  const [resettingToday, setResettingToday] = useState(false);
  const [backfillingDays, setBackfillingDays] = useState<number | null>(null);
  const [advancingDay, setAdvancingDay] = useState(false);
  const [resettingAccount, setResettingAccount] = useState(false);
  const [promotion, setPromotion] = useState<PromotionStatus | null>(null);
  const [isTrial, setIsTrial] = useState<boolean | null>(null);

  useEffect(() => {
    isAnonymousSession()
      .then(setIsTrial)
      .catch(() => setIsTrial(false));
  }, []);

  useEffect(() => {
    api.getProfile().then(setProfile).catch(() => setProfile(null));
  }, []);

  // 아바타(직급 캐릭터) 선택 등으로 프로필이 바뀌면 홈 화면 프로필 카드도 즉시 갱신
  useEffect(() => {
    const onProfileUpdated = () => api.getProfile().then(setProfile).catch(() => {});
    window.addEventListener("go:profile-updated", onProfileUpdated);
    return () => window.removeEventListener("go:profile-updated", onProfileUpdated);
  }, []);

  const loadPromotion = () => {
    api.getPromotionStatus().then(setPromotion).catch(() => setPromotion(null));
  };
  useEffect(() => {
    loadPromotion();
  }, []);

  const pendingItems = todayItems.filter((item) => item.status === "pending");
  const nextItem = pendingItems[0];
  const allDone = todayItems.length > 0 && pendingItems.length === 0 && workStatus === "working";

  // 하이라이트된 메시지/이메일이 속한 대화·스레드 id — "오늘의 연락" 목록에서 해당 항목을 하이라이트할 때 사용
  const highlightedTargetId = highlightedMessageId
    ? (conversations.find((c) => c.messages.some((m) => m.id === highlightedMessageId))?.id ??
        emailThreads.find((t) => t.emails.some((e) => e.id === highlightedMessageId))?.id ??
        null)
    : null;

  const handleFinish = async () => {
    setConfirmFinish(false);
    setFinishing(true);
    try {
      await finishWorkday();
    } finally {
      setFinishing(false);
    }
  };
  const unreadCount =
    conversations.reduce((sum, conversation) => sum + conversation.unreadCount, 0) +
    emailThreads.reduce((sum, thread) => sum + thread.unreadCount, 0);
  const dateLabel = new Date().toLocaleDateString("ko-KR", {
    timeZone: "Asia/Seoul",
    month: "long",
    day: "numeric",
    weekday: "long",
  });

  const handleResetToday = async () => {
    if (resettingToday) return;
    if (!window.confirm("오늘 workday를 통째로 삭제하고 처음부터(출근 전 상태로) 되돌릴까요? 오늘 기록은 복구할 수 없어요.")) return;
    setResettingToday(true);
    try {
      await api.devResetToday();
      await refresh();
    } finally {
      setResettingToday(false);
    }
  };

  const handleBackfillDays = async (days: number) => {
    if (backfillingDays !== null) return;
    if (!window.confirm(`[QA용] 지난 ${days}일치 더미 근무 기록을 한 번에 채웁니다. (승급 게이트 테스트용)`)) return;
    setBackfillingDays(days);
    try {
      const r = await api.devBackfillDay(days);
      await refresh();
      window.alert(`${r.days ?? 0}일치 채웠습니다.`);
    } finally {
      setBackfillingDays(null);
    }
  };

  const handleResetAccount = async () => {
    if (resettingAccount) return;
    if (
      !window.confirm(
        "[QA용] 이 계정의 근무 기록·연차·승급 이력·프로필을 전부 지우고 온보딩부터 다시 시작합니다. 되돌릴 수 없어요. 계속할까요?",
      )
    )
      return;
    setResettingAccount(true);
    try {
      await api.devResetAccount();
      await refresh();
    } finally {
      setResettingAccount(false);
    }
  };

  const handleDeliverNext = async () => {
    if (deliveringNext) return;
    setDeliveringNext(true);
    try {
      await deliverNext();
    } finally {
      setDeliveringNext(false);
    }
  };

  const handleAdvanceDay = async () => {
    if (advancingDay) return;
    if (!window.confirm("[QA용] 오늘을 마감하고 다음 접속 시 새로운 하루로 시작합니다. (대화 연속성 테스트용)")) return;
    setAdvancingDay(true);
    try {
      await api.devAdvanceToNextDay();
      await refresh();
    } finally {
      setAdvancingDay(false);
    }
  };

  const tourSteps: TourStep[] = [
    // 데스크톱 사이드바/모바일 하단바는 반응형으로 항상 한쪽만 화면에 보이므로, 둘 다 후보로
    // 넣어두면 SectionTourGuide가 실제로 보이는(display:none 아닌) 쪽만 걸러서 써준다
    {
      selector: "#tour-nav-desktop",
      title: "메뉴",
      text: "메신저·이메일·근태·업무일지·인사평가 등 다른 화면은 여기서 이동해요.",
    },
    {
      selector: "#tour-nav-mobile",
      title: "메뉴",
      text: "메신저·이메일·근태·업무일지·인사평가 등 다른 화면은 여기서 이동해요.",
    },
    {
      selector: "#tour-profile",
      title: "프로필 · 근무시간",
      text: "내 사원증과 오늘 일한 시간이 여기 표시돼요. 승급하면 아바타 캐릭터도 바뀌어요.",
    },
    {
      selector: "#tour-stats",
      title: "근무 현황 요약",
      text: "근무 상태, 연차, 읽지 않은 메시지, 다음 연락 예정 시간을 한눈에 볼 수 있어요.",
    },
    {
      selector: "#tour-context",
      title: "오늘의 업무 상황",
      text: "오늘 무슨 상황인지, 동료·상사·거래처에게 각각 뭘 전달해야 하는지 알려줘요.",
    },
    {
      selector: "#tour-contacts",
      title: "오늘의 연락",
      text: "여기서 받은 메시지에 답장하면 하루가 진행되고, 다 처리한 뒤 퇴근하면 리포트가 만들어져요.",
    },
  ];

  return (
    <div className="mx-auto max-w-3xl space-y-6 px-4 py-6 md:px-8 md:py-8">
      <div>
        <h1 className="text-lg font-semibold">Today&apos;s Workday</h1>
        <p className="mt-1 text-sm text-foreground/60">{dateLabel}</p>
      </div>

      {pendingReviewBanner && (
        <Link
          to={pendingReviewBanner.url}
          className="flex w-full items-center justify-between gap-3 rounded-xl border border-blue-300/50 bg-blue-50 px-4 py-3 text-left hover:bg-blue-100/70"
        >
          <div className="min-w-0">
            <p className="text-sm font-semibold text-blue-700">📝 어제 어려웠던 표현, 다시 써볼까요?</p>
            <p className="truncate text-xs text-foreground/60">{pendingReviewBanner.contactName}에게 다시 답장해보세요.</p>
          </div>
          <span className="shrink-0 rounded-full bg-blue-600 px-3 py-1.5 text-xs font-medium text-white">복습하기</span>
        </Link>
      )}

      {allDone && (
        <button
          type="button"
          onClick={() => setConfirmFinish(true)}
          disabled={finishing}
          className="flex w-full animate-pulse items-center justify-between gap-3 rounded-xl border border-accent/40 bg-accent/10 px-4 py-3 text-left ring-2 ring-accent ring-offset-2 hover:bg-accent/15 disabled:animate-none disabled:opacity-50"
        >
          <div className="min-w-0">
            <p className="text-sm font-semibold text-accent">오늘의 연락을 모두 처리했어요</p>
            <p className="truncate text-xs text-foreground/60">퇴근 처리하면 오늘의 업무일지가 생성됩니다.</p>
          </div>
          <span className="shrink-0 rounded-full bg-accent px-3 py-1.5 text-xs font-medium text-white">
            {finishing ? "퇴근 처리 중..." : "퇴근하기"}
          </span>
        </button>
      )}

      {promotion?.eligible && (
        <Link
          to="/evaluation"
          className="flex w-full items-center justify-between gap-3 rounded-xl border border-accent/30 bg-accent/5 px-4 py-3 text-left hover:bg-accent/10"
        >
          <div className="min-w-0">
            <p className="text-sm font-semibold text-accent">🎉 인사평가 대상이 되었어요</p>
            <p className="truncate text-xs text-foreground/60">
              한 달간 수고하셨어요! 간단한 평가 후 {promotion.nextRank}로 승진합니다.
            </p>
          </div>
          <span className="shrink-0 rounded-full bg-accent px-3 py-1.5 text-xs font-medium text-white">평가 받기</span>
        </Link>
      )}

      <div id="tour-profile">
        <ProfileHoursCard
          profile={profile}
          workStatus={workStatus ?? "before-work"}
          startedAt={workday?.started_at}
          endedAt={workday?.ended_at}
        />
      </div>

      <section id="tour-stats" className="rounded-xl border border-border bg-surface p-5">
        {/* 항목 수와 정확히 같은 개수의 1fr 칼럼 grid — 칼럼 폭이 수학적으로 완전히 동일해서
            마지막 칼럼의 오른쪽 끝이 컨테이너 padding과 항상 정확히 맞음(flex-grow 오차 없음) */}
        <div className={`grid grid-cols-1 gap-4 ${leaveBalance ? "sm:grid-cols-5" : "sm:grid-cols-3"}`}>
          <StatTile label="근무 상태" value={<WorkStatusMenu workStatus={workStatus ?? "before-work"} />} />
          {leaveBalance && (
            <>
              <StatTile label="연차" value={`${leaveBalance.total}개`} />
              <StatTile label="적립연차" value={`${leaveBalance.earnedLeave}개`} />
            </>
          )}
          <StatTile label="읽지 않은 메시지" value={`${unreadCount}건`} />
          <StatTile
            label="다음 연락 예정"
            value={nextItem ? formatTime(nextItem.dueAt) : "없음"}
          />
        </div>
      </section>


      {workContext && (
        <section id="tour-context" className="rounded-xl border border-border bg-surface p-5">
          <div className="flex items-start justify-between gap-3">
            <div>
              <h2 className="text-sm font-semibold text-foreground">오늘의 업무 상황</h2>
              <p className="mt-0.5 text-xs text-foreground/40">Today's Work Context</p>
            </div>
            <span className="rounded-full bg-accent/10 px-2.5 py-1 text-[11px] font-medium text-accent">
              {workContext.stageKo}
            </span>
          </div>
          <div className="mt-4">
            <p className="text-sm text-foreground/80">{workContext.goalKo}</p>
            <p className="mt-0.5 text-xs text-foreground/45">{workContext.goalEn}</p>
          </div>
          {!!workContext.roles?.length && (
            <div className="mt-3 space-y-2.5 border-t border-border pt-3">
              {workContext.roles.map((r) => (
                <p key={r.role} className="text-sm text-foreground/80">
                  <span className="font-medium">{ROLE_LABEL_KO[r.role]}</span>
                  {" : "}
                  {r.purposeKo}
                  <span className="text-foreground/40">({r.purposeEn})</span>
                </p>
              ))}
            </div>
          )}
        </section>
      )}

      <section id="tour-contacts" className="space-y-3">
        <div className="flex items-center justify-between border-b border-border pb-2">
          <h2 className="text-sm font-medium text-foreground/70">
            오늘의 연락 ({todayItems.length})
          </h2>
          <div className="flex items-center gap-3">
            <span className="text-xs text-foreground/40">최신순</span>
            {workStatus === "working" && (
              <button
                type="button"
                onClick={() => setConfirmFinish(true)}
                disabled={finishing}
                className="rounded-md border border-accent/40 bg-accent/5 px-2.5 py-1 text-xs font-medium text-accent hover:bg-accent/10 disabled:opacity-50"
              >
                {finishing ? "퇴근 처리 중..." : "퇴근하기"}
              </button>
            )}
          </div>
        </div>
        <div className="space-y-2">
          {todayItems.length === 0 && (
            <p className="rounded-lg border border-dashed border-border px-4 py-6 text-center text-sm text-foreground/40">
              오늘 도착한 연락이 아직 없습니다.
            </p>
          )}
          {todayItems.map((item) => (
            <TodayItemRow key={item.id} item={item} highlighted={item.targetId === highlightedTargetId} />
          ))}
          <ShoutJarTodayRow />
        </div>
      </section>

      {/* isTrial 확인이 비동기라, 확정되기 전에 마운트하면 SectionTourGuide 내부 localStorage
          체크가 (나중에 바뀔) persist=true 기준으로 먼저 굳어버린다 — 확정된 뒤에만 마운트 */}
      {isTrial !== null && <SectionTourGuide steps={tourSteps} persist={!isTrial} />}

      <QaControlPanel
        onDeliverNext={handleDeliverNext}
        deliveringNext={deliveringNext}
        onResetToday={handleResetToday}
        resettingToday={resettingToday}
        onBackfillDays={handleBackfillDays}
        backfillingDays={backfillingDays}
        onAdvanceDay={handleAdvanceDay}
        advancingDay={advancingDay}
        onResetAccount={handleResetAccount}
        resettingAccount={resettingAccount}
      />

      <ConfirmDialog
        open={confirmFinish}
        title="퇴근하시겠어요?"
        description="퇴근하면 오늘 남은 연락은 처리할 수 없고, 지금까지의 답변을 기준으로 업무일지가 생성됩니다."
        confirmLabel="퇴근하기"
        onConfirm={handleFinish}
        onCancel={() => setConfirmFinish(false)}
      />
    </div>
  );
}
