import { useEffect, useState } from "react";
import { useLocation, useNavigate } from "react-router-dom";
import { useBusinessMode } from "@/context/useBusinessMode";
import { useWorkday } from "@/context/useWorkday";
import { endGuestTrial } from "@/lib/session";
import { TRIAL_REPLY_TEXT } from "@/lib/trialReplies";
import { TRIAL_ROLE_LABEL, useTrialTargets, type TrialTarget } from "@/lib/trialTargets";
import { useTrialSequence, type TrialStep } from "@/lib/trialSequence";
import { TrialActionBar } from "./TrialActionBar";

const KAKAO_TEXT_MAX = 190;
const FIELD_WORK_PREVIEW_MS = 2600;
const FIELD_WORK_CLICK_GAP_MS = 320;
const PROGRESS_DOTS = 8;

const REVIEW_ORDER: TrialStep[] = [
  "colleague",
  "colleague-review",
  "manager-hint",
  "manager-reply",
  "manager-review",
  "client",
  "client-review",
  "fieldwork-push",
  "comfort",
  "checkout",
  "report",
  "kakao",
];

function truncateKakaoText(value: string | undefined, max: number) {
  if (!value) return value;
  return value.length > max ? `${value.slice(0, max - 1)}…` : value;
}

function wait(ms: number) {
  return new Promise<void>((resolve) => window.setTimeout(resolve, ms));
}

function roleForStep(step: TrialStep): TrialTarget["role"] | null {
  if (step === "colleague" || step === "colleague-review") return "colleague";
  if (step === "manager-hint" || step === "manager-reply" || step === "manager-review") return "manager";
  if (step === "client" || step === "client-review") return "client";
  return null;
}

function progressForStep(step: TrialStep) {
  switch (step) {
    case "home-tour":
    case "colleague":
      return 0;
    case "colleague-review":
    case "manager-hint":
    case "manager-reply":
      return 1;
    case "manager-review":
    case "client":
      return 2;
    case "client-review":
    case "fieldwork-push":
      return 3;
    case "comfort":
      return 4;
    case "checkout":
      return 5;
    case "report":
      return 7;
    case "kakao":
      return 8;
  }
}

async function showTrialBrowserNotification(title: string, body: string, url: string) {
  if (!("Notification" in window) || !("serviceWorker" in navigator)) return;

  try {
    let permission = Notification.permission;
    if (permission === "default") {
      permission = await Notification.requestPermission();
    }
    if (permission !== "granted") return;

    await navigator.serviceWorker.register("/sw.js");
    const registration = await navigator.serviceWorker.ready;
    await registration.showNotification(title, {
      body,
      icon: "/brand/logo-mark.png",
      tag: "trial-field-work-preview",
      data: { url },
    });
  } catch {
    // 브라우저 정책이나 권한 문제로 시스템 알림이 실패해도 체험 자체는 계속 진행한다.
  }
}

async function clearTrialBrowserNotification() {
  if (!("serviceWorker" in navigator)) return;
  try {
    const registration = await navigator.serviceWorker.getRegistration();
    const notifications = await registration?.getNotifications({ tag: "trial-field-work-preview" });
    notifications?.forEach((notification) => notification.close());
  } catch {
    // 종료 흐름은 알림 정리 실패와 무관하게 계속 진행한다.
  }
}

/**
 * 1분 체험의 실제 진행 상태(step)와 과거 화면을 다시 보는 상태(historyStep)를 분리한다.
 * 이전 버튼으로 과거 화면을 보더라도 실제 진행 상태는 되돌리지 않으므로,
 * 이미 보낸 답장/외근/퇴근 같은 side effect가 다시 실행되지 않는다.
 */
export function TrialGuideBarV2() {
  const { report, conversations, sendReply, finishWorkday, goOnFieldWork, triggerTrialHint } = useWorkday();
  const { businessMode } = useBusinessMode();
  const { targets } = useTrialTargets();
  const { step, setStep } = useTrialSequence();
  const navigate = useNavigate();
  const location = useLocation();
  const isGameMode = businessMode;

  const [finishing, setFinishing] = useState(false);
  const [sending, setSending] = useState(false);
  const [fieldWorkSimulating, setFieldWorkSimulating] = useState(false);
  const [showFieldWorkPreview, setShowFieldWorkPreview] = useState(false);
  const [historyStep, setHistoryStep] = useState<TrialStep | null>(null);

  useEffect(() => {
    setHistoryStep(null);
  }, [step]);

  const displayStep = historyStep ?? step;
  const isHistoryReview = historyStep !== null;

  const colleagueTarget = targets.find((target) => target.role === "colleague");
  const managerTarget = targets.find((target) => target.role === "manager");
  const clientTarget = targets.find((target) => target.role === "client");
  const targetByRole: Partial<Record<TrialTarget["role"], TrialTarget>> = {
    colleague: colleagueTarget,
    manager: managerTarget,
    client: clientTarget,
  };

  const displayRole = roleForStep(displayStep);
  const displayTarget = displayRole ? targetByRole[displayRole] : undefined;
  const onDisplayTargetPage = !!displayTarget && location.pathname === displayTarget.path;
  const onReportPage = location.pathname === "/reports";
  const onHomePage = location.pathname === "/";

  const colleagueConversation = colleagueTarget
    ? conversations.find((conversation) => conversation.id === colleagueTarget.id)
    : undefined;
  const fieldWorkPreviewBody =
    (colleagueConversation?.messages ?? []).find((message) => message.from === "contact")?.body ??
    "Hey, can you take a look by 3? 🙏";
  const ventConversation = conversations.find((conversation) => conversation.kind === "vent");
  const ventPath = ventConversation ? `/messenger/${ventConversation.id}` : null;
  const onVentPage = !!ventPath && location.pathname === ventPath;

  // 현재 보고 있는 단계(displayStep)의 실제 화면으로 이동한다. historyStep일 때도 화면만 이동하고
  // 진행 상태(step)는 그대로 유지해서 이전 화면을 안전하게 다시 볼 수 있다.
  useEffect(() => {
    if (displayStep === "home-tour") return;

    if (displayTarget) {
      if (location.pathname !== displayTarget.path) navigate(displayTarget.path);
      return;
    }

    if (displayStep === "fieldwork-push" && colleagueTarget) {
      if (location.pathname !== colleagueTarget.path) navigate(colleagueTarget.path);
      return;
    }

    if (displayStep === "comfort" && ventPath) {
      if (location.pathname !== ventPath) navigate(ventPath);
      return;
    }

    if (displayStep === "checkout") {
      if (!onHomePage) navigate("/");
      return;
    }

    if (displayStep === "report" || displayStep === "kakao") {
      if (!onReportPage) navigate("/reports");
    }
  }, [
    displayStep,
    displayTarget?.path,
    colleagueTarget?.path,
    ventPath,
    location.pathname,
    navigate,
    onHomePage,
    onReportPage,
  ]);

  const handleEnd = async () => {
    await clearTrialBrowserNotification();
    await endGuestTrial();
    window.location.replace("/intro");
  };

  const sendRoleReply = async (target: TrialTarget, reviewStep: TrialStep) => {
    if (location.pathname !== target.path) {
      navigate(target.path);
      return;
    }
    setSending(true);
    try {
      // 서버가 상대 답장까지 생성하고 refresh한 뒤 resolve되므로, 여기서 reviewStep으로 전환하면
      // 사용자는 방금 온 상대 답장을 현재 화면에서 확인한 뒤 직접 '다음'을 눌러야 다음 사람으로 넘어간다.
      await sendReply(target.id, TRIAL_REPLY_TEXT[target.role] ?? "", target.subject);
      setStep(reviewStep);
    } finally {
      setSending(false);
    }
  };

  const handleHistoryPrevious = () => {
    const currentIndex = REVIEW_ORDER.indexOf(displayStep);
    if (currentIndex <= 0) return;
    setHistoryStep(REVIEW_ORDER[currentIndex - 1]);
  };

  const handleHistoryForward = () => {
    const actualIndex = REVIEW_ORDER.indexOf(step);
    const currentIndex = REVIEW_ORDER.indexOf(displayStep);
    if (actualIndex < 0 || currentIndex < 0 || currentIndex >= actualIndex) {
      setHistoryStep(null);
      return;
    }
    const next = REVIEW_ORDER[currentIndex + 1];
    setHistoryStep(next === step ? null : next);
  };

  const handlePrimaryAction = async () => {
    if (sending || finishing || fieldWorkSimulating) return;

    if (isHistoryReview) {
      handleHistoryForward();
      return;
    }

    if (step === "colleague") {
      if (!colleagueTarget) return;
      await sendRoleReply(colleagueTarget, "colleague-review");
      return;
    }

    if (step === "colleague-review") {
      setStep("manager-hint");
      return;
    }

    if (step === "manager-hint") {
      if (!managerTarget) return;
      if (location.pathname !== managerTarget.path) {
        navigate(managerTarget.path);
        return;
      }
      triggerTrialHint();
      setStep("manager-reply");
      return;
    }

    if (step === "manager-reply") {
      if (!managerTarget) return;
      await sendRoleReply(managerTarget, "manager-review");
      return;
    }

    if (step === "manager-review") {
      setStep("client");
      return;
    }

    if (step === "client") {
      if (!clientTarget) return;
      await sendRoleReply(clientTarget, "client-review");
      return;
    }

    if (step === "client-review") {
      setStep("fieldwork-push");
      return;
    }

    if (step === "fieldwork-push") {
      const targetPath = colleagueTarget?.path ?? "/messenger";
      void showTrialBrowserNotification("Jake · 동료", fieldWorkPreviewBody, targetPath);

      if (colleagueTarget && location.pathname !== colleagueTarget.path) {
        navigate(colleagueTarget.path);
      }
      setFieldWorkSimulating(true);
      setShowFieldWorkPreview(true);
      try {
        await wait(FIELD_WORK_PREVIEW_MS);
        setShowFieldWorkPreview(false);
        await goOnFieldWork();
        await wait(FIELD_WORK_CLICK_GAP_MS);
        await goOnFieldWork();
        setStep("comfort");
      } finally {
        setShowFieldWorkPreview(false);
        setFieldWorkSimulating(false);
      }
      return;
    }

    if (step === "comfort") {
      if (!ventConversation) return;
      if (!onVentPage && ventPath) {
        navigate(ventPath);
        return;
      }
      setStep("checkout");
      navigate("/");
      window.setTimeout(() => window.scrollTo({ top: 0, behavior: "smooth" }), 80);
      return;
    }

    if (step === "checkout") {
      setFinishing(true);
      try {
        await finishWorkday();
        setStep("report");
        navigate("/reports");
      } finally {
        setFinishing(false);
      }
      return;
    }

    if (step === "report") {
      if (!onReportPage) {
        navigate("/reports");
        return;
      }
      if (!report) return;
      setStep("kakao");
    }
  };

  // 최초 화면 구성 설명은 HomePage의 SectionTourGuide가 전담한다.
  if (step === "home-tour") return null;

  const waitingForTarget = !!displayRole && !displayTarget;
  const waitingForComfort = displayStep === "comfort" && !ventConversation;
  const waitingForReport = displayStep === "report" && !report;

  const actualIndex = REVIEW_ORDER.indexOf(step);
  const displayIndex = REVIEW_ORDER.indexOf(displayStep);
  const canPrevious = displayIndex > 0 && actualIndex > 0;

  const primaryLabel = (() => {
    if (isHistoryReview) return "다음";

    if (step === "colleague") {
      if (!colleagueTarget) return "연락 기다리는 중...";
      return sending ? "전송 중..." : onDisplayTargetPage ? "이 내용으로 답장 보내기" : `${TRIAL_ROLE_LABEL.colleague}에게 가기`;
    }
    if (step === "colleague-review") return "다음";
    if (step === "manager-hint") {
      if (!managerTarget) return "다음 연락 기다리는 중...";
      return onDisplayTargetPage ? "한국어 힌트 보기" : `${TRIAL_ROLE_LABEL.manager}에게 가기`;
    }
    if (step === "manager-reply") {
      if (!managerTarget) return "다음 연락 기다리는 중...";
      return sending ? "전송 중..." : onDisplayTargetPage ? "이 내용으로 답장 보내기" : `${TRIAL_ROLE_LABEL.manager}에게 가기`;
    }
    if (step === "manager-review") return "다음";
    if (step === "client") {
      if (!clientTarget) return "다음 연락 기다리는 중...";
      return sending ? "전송 중..." : onDisplayTargetPage ? "이 내용으로 답장 보내기" : `${TRIAL_ROLE_LABEL.client}에게 가기`;
    }
    if (step === "client-review") return "다음";
    if (step === "fieldwork-push") return fieldWorkSimulating ? "웹 알림 확인 중..." : "다음";
    if (step === "comfort") {
      if (!ventConversation) return "위로 메시지 기다리는 중...";
      return onVentPage ? "다음" : "위로 메시지 보기";
    }
    if (step === "checkout") return finishing ? "퇴근 처리 중..." : "다음";
    if (step === "report") {
      if (!report) return "리포트 만드는 중...";
      return onReportPage ? "카카오톡 알림 미리보기" : "리포트 보러가기";
    }
    return null;
  })();

  const messageForStep = (targetStep: TrialStep) => {
    if (targetStep === "colleague") {
      return colleagueTarget ? "동료에게 온 연락에 답장해보세요" : "첫 연락이 도착하는 중이에요...";
    }
    if (targetStep === "colleague-review") {
      return "동료의 답장이 도착했어요. 내용을 확인한 뒤 다음을 눌러 상사의 연락으로 넘어가세요.";
    }
    if (targetStep === "manager-hint") {
      return managerTarget ? "이건 답변을 모르겠다구요? 한국어 힌트를 눌러볼게요!" : "상사의 연락이 도착하는 중이에요...";
    }
    if (targetStep === "manager-reply") return "이걸 토대로 답변을 작성할게요";
    if (targetStep === "manager-review") {
      return "상사의 답장이 도착했어요. 내용을 확인한 뒤 다음을 눌러 거래처 연락으로 넘어가세요.";
    }
    if (targetStep === "client") {
      return clientTarget ? "거래처에게 온 연락에 답장해보세요" : "거래처의 연락이 도착하는 중이에요...";
    }
    if (targetStep === "client-review") {
      return "거래처의 답장이 도착했어요. 마지막 답변까지 확인한 뒤 다음을 눌러 외근 알림 체험으로 넘어가세요.";
    }
    if (targetStep === "fieldwork-push") {
      return "실서비스에서는 ‘지금 외근 중’을 누르면 예정된 연락을 30분 뒤 다시 받을 수 있어요.\n다음을 누르면 우하단 웹 알림과 Edge/브라우저 알림을 먼저 보여드린 뒤, 외근 신호 2회를 한 번에 재현할게요.";
    }
    if (targetStep === "comfort") {
      return ventConversation
        ? "외근 신호가 반복되자 동료가 먼저 말을 걸어왔어요. 이렇게 먼저 온 위로 메시지는 고함항아리에 모여요.\n다음을 누르면 홈에서 실제 퇴근 안내를 확인해볼게요."
        : "반복된 바쁨을 감지했어요. 동료가 먼저 말을 걸어오는 중이에요...";
    }
    if (targetStep === "checkout") {
      return "오늘 할 일을 모두 처리하면 홈에 실제 퇴근 안내가 나타나요.\n강조된 ‘퇴근하기’ 카드를 확인하고 다음을 눌러 퇴근해볼게요.";
    }
    if (targetStep === "report") {
      return report
        ? "오늘 대화를 바탕으로 잘한 표현, 교정 포인트, 꼭 기억할 표현이 업무일지에 정리돼요."
        : "오늘의 업무일지를 만드는 중이에요...";
    }
    return "카카오톡으로 로그인 후 알림 설정에 동의하면 오늘의 업무일지를 카카오톡으로 확인해볼 수 있고, 2일 이상 결석했을 때 리마인드 알림도 받아볼 수 있어요!";
  };

  const message = isHistoryReview
    ? `이전 단계 다시보기 · ${messageForStep(displayStep)}`
    : messageForStep(displayStep);

  const goodCount = report?.goodExpressions?.length ?? 0;
  const correctionCount = report?.improvementPoints?.length ?? 0;
  const memorizeCount = report?.keyPhrases?.length ?? 0;
  const firstGood = report?.goodExpressions?.[0];
  const firstMemorize = report?.keyPhrases?.[0];

  const kakaoPreviewLines = [
    "[부캐영어] 오늘의 업무일지가 도착했어요 📋",
    `잘한 표현 ${goodCount}건 · 교정 ${correctionCount}건 · 꼭 기억할 표현 ${memorizeCount}건`,
    firstGood?.text ? `✅ \"${truncateKakaoText(firstGood.text, 40)}\"` : null,
    firstMemorize?.en
      ? `📌 ${truncateKakaoText(firstMemorize.en, 30)} (${truncateKakaoText(firstMemorize.ko, 20)})`
      : null,
  ].filter((line): line is string => Boolean(line));
  const kakaoPreviewText = truncateKakaoText(kakaoPreviewLines.join("\n"), KAKAO_TEXT_MAX) ?? "";

  return (
    <>
      {showFieldWorkPreview && !isHistoryReview && (
        <div className="fixed bottom-20 right-4 z-50 w-80 max-w-[calc(100vw-2rem)] md:bottom-4">
          <div
            className={`absolute -top-9 right-0 rounded-full px-3 py-1.5 text-[11px] font-bold text-white ${
              isGameMode
                ? "bg-[#2f795d] shadow-[0_0_22px_rgba(47,121,93,0.65)]"
                : "bg-[#1a56ff] shadow-lg"
            }`}
          >
            웹 알림은 여기에서 떠요
          </div>
          <div
            className={`flex items-start gap-3 rounded-lg p-4 text-foreground ${
              isGameMode
                ? "border-2 border-[#2f795d] bg-surface shadow-[0_14px_50px_rgba(47,121,93,0.42),0_0_30px_rgba(47,121,93,0.28)] ring-[6px] ring-[#2f795d]/25"
                : "border-2 border-[#1a56ff] bg-surface shadow-[0_16px_40px_rgba(26,86,255,0.26)] ring-4 ring-[#1a56ff]/20"
            }`}
          >
            <div className="min-w-0 flex-1">
              <p className="text-sm font-medium">Jake</p>
              <p className="mt-0.5 truncate text-xs text-foreground/60">{fieldWorkPreviewBody}</p>
            </div>
            <span className="shrink-0 text-foreground/40" aria-hidden="true">
              ✕
            </span>
          </div>
        </div>
      )}

      {displayStep === "kakao" && report && (
        <div className="relative z-20 mx-3 my-2 overflow-hidden rounded-2xl border border-[#d9cf73] bg-[#fee500] shadow-xl md:fixed md:right-[23rem] md:top-1/2 md:mx-0 md:my-0 md:w-[340px] md:-translate-y-1/2">
          <div className="px-4 py-3">
            <p className="text-xs font-bold text-[#2d2926]">카카오톡 알림 미리보기</p>
            <p className="mt-0.5 text-[10px] text-[#2d2926]/60">실제 ‘나에게 보내기’ text 템플릿 형식</p>
          </div>

          <div className="mx-3 mb-3 rounded-xl bg-white p-4 text-[#242424] shadow-sm">
            <p className="whitespace-pre-line text-[12px] leading-[1.65] text-[#242424]">{kakaoPreviewText}</p>
            <div className="mt-4 border-t border-[#ededed] pt-3 text-center text-[11px] font-medium text-[#555]">
              전체 리포트 보기
            </div>
          </div>

          <p className="px-4 pb-3 text-[10px] leading-relaxed text-[#2d2926]/65">
            체험판에서는 실제 카카오톡으로 발송하지 않고, 실제 발송 payload와 같은 내용만 미리 보여드려요.
          </p>
        </div>
      )}

      <TrialActionBar
        message={message}
        dotsTotal={PROGRESS_DOTS}
        dotsFilled={progressForStep(step)}
        primaryLabel={primaryLabel}
        onPrimary={primaryLabel ? handlePrimaryAction : undefined}
        primaryDisabled={
          !isHistoryReview &&
          (sending ||
            finishing ||
            fieldWorkSimulating ||
            waitingForTarget ||
            waitingForComfort ||
            waitingForReport)
        }
        onPrevious={canPrevious ? handleHistoryPrevious : undefined}
        onEnd={handleEnd}
        endPrimary={step === "kakao" && !isHistoryReview}
        showEnd
      />
    </>
  );
}
