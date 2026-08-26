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

function truncateKakaoText(value: string | undefined, max: number) {
  if (!value) return value;
  return value.length > max ? `${value.slice(0, max - 1)}…` : value;
}

function wait(ms: number) {
  return new Promise<void>((resolve) => window.setTimeout(resolve, ms));
}

function roleForStep(step: TrialStep): TrialTarget["role"] | null {
  if (step === "colleague") return "colleague";
  if (step === "manager-hint" || step === "manager-reply") return "manager";
  if (step === "client") return "client";
  return null;
}

function progressForStep(step: TrialStep) {
  switch (step) {
    case "home-tour":
      return 0;
    case "colleague":
      return 0;
    case "manager-hint":
    case "manager-reply":
      return 1;
    case "client":
      return 2;
    case "fieldwork-push":
      return 3;
    case "comfort":
      return 4;
    case "checkout":
      return 5;
    case "report":
      return 6;
    case "kakao":
      return 8;
  }
}

// 체험판에서는 서버 푸시 구독을 별도로 저장하지 않는다. 대신 사용자가 외근 시연의 "다음"을 누른
// 바로 그 사용자 액션에서 브라우저 알림 권한을 요청하고, 기존 서비스워커로 실제 Edge/브라우저
// 시스템 알림을 띄워 실서비스 알림 위치와 함께 체험할 수 있게 한다.
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
    // 알림 권한/브라우저 정책 문제로 실패해도 1분 체험 흐름 자체는 계속 진행한다.
  }
}

// 1분 체험의 진행 순서는 오직 trialStep 하나로 결정한다.
// conversations/report 같은 실제 데이터는 "해당 단계의 화면 대상이 준비됐는지"만 확인하고,
// 데이터를 보고 현재 단계를 역추론하지 않는다. 그래서 홈 재진입/비동기 배달 때문에 단계가 겹치거나
// 처음으로 되돌아가는 회귀가 생기지 않는다.
export function TrialGuideBar() {
  const { report, conversations, sendReply, finishWorkday, goOnFieldWork, triggerTrialHint } = useWorkday();
  const { businessMode } = useBusinessMode();
  const { targets } = useTrialTargets();
  const { step, setStep } = useTrialSequence();
  const navigate = useNavigate();
  const location = useLocation();
  // 이 프로젝트 관례상 businessMode=true가 실제 게임모드다.
  const isGameMode = businessMode;
  const [finishing, setFinishing] = useState(false);
  const [sending, setSending] = useState(false);
  const [ending, setEnding] = useState(false);
  const [fieldWorkSimulating, setFieldWorkSimulating] = useState(false);
  const [showFieldWorkPreview, setShowFieldWorkPreview] = useState(false);

  const colleagueTarget = targets.find((target) => target.role === "colleague");
  const managerTarget = targets.find((target) => target.role === "manager");
  const clientTarget = targets.find((target) => target.role === "client");
  const targetByRole: Partial<Record<TrialTarget["role"], TrialTarget>> = {
    colleague: colleagueTarget,
    manager: managerTarget,
    client: clientTarget,
  };
  const stepRole = roleForStep(step);
  const stepTarget = stepRole ? targetByRole[stepRole] : undefined;
  const onStepTargetPage = !!stepTarget && location.pathname === stepTarget.path;
  const onReportPage = location.pathname === "/reports";
  const onHomePage = location.pathname === "/";

  const colleagueConversation = colleagueTarget
    ? conversations.find((conversation) => conversation.id === colleagueTarget.id)
    : undefined;
  // 30분 뒤 다시 뜨는 알림은 사용자가 이미 답한 최신 메시지가 아니라 처음 받았던 업무 요청을 재현한다.
  const fieldWorkPreviewBody =
    (colleagueConversation?.messages ?? []).find((message) => message.from === "contact")?.body ??
    "Hey, can you take a look by 3? 🙏";
  const ventConversation = conversations.find((conversation) => conversation.kind === "vent");
  const ventPath = ventConversation ? `/messenger/${ventConversation.id}` : null;
  const onVentPage = !!ventPath && location.pathname === ventPath;

  // 시퀀스가 바뀌면 그 단계가 요구하는 실제 화면으로만 이동한다.
  // 대상 데이터가 아직 도착하지 않았으면 단계는 그대로 두고 기다렸다가, 데이터가 생긴 순간 이동한다.
  useEffect(() => {
    if (step === "home-tour") return;

    if (stepTarget) {
      if (location.pathname !== stepTarget.path) navigate(stepTarget.path);
      return;
    }

    if (step === "fieldwork-push" && colleagueTarget) {
      if (location.pathname !== colleagueTarget.path) navigate(colleagueTarget.path);
      return;
    }

    if (step === "comfort" && ventPath) {
      if (location.pathname !== ventPath) navigate(ventPath);
      return;
    }

    if (step === "checkout") {
      if (!onHomePage) navigate("/");
      return;
    }

    if (step === "report" || step === "kakao") {
      if (!onReportPage) navigate("/reports");
    }
  }, [
    step,
    stepTarget?.path,
    colleagueTarget?.path,
    ventPath,
    location.pathname,
    navigate,
    onHomePage,
    onReportPage,
  ]);

  const handleEnd = async () => {
    if (ending) return;
    setEnding(true);
    setShowFieldWorkPreview(false);

    // 체험 중 띄운 시스템 알림이 체험 종료 뒤까지 남아 있으면 실제 서비스 알림처럼 오해될 수 있으므로
    // trial 전용 tag의 알림만 닫고, 익명 세션/시퀀스를 정리한 뒤 인트로로 history를 교체한다.
    try {
      if ("serviceWorker" in navigator) {
        const registration = await navigator.serviceWorker.getRegistration();
        if (registration) {
          const notifications = await registration.getNotifications({ tag: "trial-field-work-preview" });
          notifications.forEach((notification) => notification.close());
        }
      }
    } catch {
      // 알림 정리에 실패해도 체험 종료 자체는 계속 진행한다.
    }

    try {
      await endGuestTrial();
    } finally {
      window.location.replace("/intro");
    }
  };

  const sendRoleReply = async (target: TrialTarget, nextStep: TrialStep) => {
    if (location.pathname !== target.path) {
      navigate(target.path);
      return;
    }
    setSending(true);
    try {
      await sendReply(target.id, TRIAL_REPLY_TEXT[target.role] ?? "", target.subject);
      setStep(nextStep);
    } finally {
      setSending(false);
    }
  };

  const handlePrimaryAction = async () => {
    if (sending || finishing || ending || fieldWorkSimulating) return;

    if (step === "colleague") {
      if (!colleagueTarget) return;
      await sendRoleReply(colleagueTarget, "manager-hint");
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
      await sendRoleReply(managerTarget, "client");
      return;
    }

    if (step === "client") {
      if (!clientTarget) return;
      await sendRoleReply(clientTarget, "fieldwork-push");
      return;
    }

    if (step === "fieldwork-push") {
      const targetPath = colleagueTarget?.path ?? "/messenger";
      // requestPermission이 브라우저의 사용자 액션으로 인정되도록 첫 await 전에 호출한다.
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

  // 최초 홈 투어는 HomePage의 SectionTourGuide가 전담한다.
  if (step === "home-tour") return null;

  const waitingForTarget = !!stepRole && !stepTarget;
  const waitingForComfort = step === "comfort" && !ventConversation;
  const waitingForReport = step === "report" && !report;

  const primaryLabel = (() => {
    if (step === "colleague") {
      if (!colleagueTarget) return "연락 기다리는 중...";
      return sending ? "전송 중..." : onStepTargetPage ? "이 내용으로 답장 보내기" : `${TRIAL_ROLE_LABEL.colleague}에게 가기`;
    }
    if (step === "manager-hint") {
      if (!managerTarget) return "다음 연락 기다리는 중...";
      return onStepTargetPage ? "한국어 힌트 보기" : `${TRIAL_ROLE_LABEL.manager}에게 가기`;
    }
    if (step === "manager-reply") {
      if (!managerTarget) return "다음 연락 기다리는 중...";
      return sending ? "전송 중..." : onStepTargetPage ? "이 내용으로 답장 보내기" : `${TRIAL_ROLE_LABEL.manager}에게 가기`;
    }
    if (step === "client") {
      if (!clientTarget) return "다음 연락 기다리는 중...";
      return sending ? "전송 중..." : onStepTargetPage ? "이 내용으로 답장 보내기" : `${TRIAL_ROLE_LABEL.client}에게 가기`;
    }
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

  const message = (() => {
    if (step === "colleague") {
      return colleagueTarget ? "동료에게 온 연락에 답장해보세요" : "첫 연락이 도착하는 중이에요...";
    }
    if (step === "manager-hint") {
      return managerTarget ? "이건 답변을 모르겠다구요? 한국어 힌트를 눌러볼게요!" : "상사의 연락이 도착하는 중이에요...";
    }
    if (step === "manager-reply") return "이걸 토대로 답변을 작성할게요";
    if (step === "client") {
      return clientTarget ? "거래처에게 온 연락에 답장해보세요" : "거래처의 연락이 도착하는 중이에요...";
    }
    if (step === "fieldwork-push") {
      return "실서비스에서는 ‘지금 외근 중’을 누르면 예정된 연락을 30분 뒤 다시 받을 수 있어요.\n다음을 누르면 우하단 웹 알림과 Edge/브라우저 알림을 먼저 보여드린 뒤, 외근 신호 2회를 한 번에 재현할게요.";
    }
    if (step === "comfort") {
      return ventConversation
        ? "외근 신호가 반복되자 동료가 먼저 말을 걸어왔어요. 이렇게 먼저 온 위로 메시지는 고함항아리에 모여요.\n다음을 누르면 홈에서 실제 퇴근 안내를 확인해볼게요."
        : "반복된 바쁨을 감지했어요. 동료가 먼저 말을 걸어오는 중이에요...";
    }
    if (step === "checkout") {
      return "오늘 할 일을 모두 처리하면 홈에 실제 퇴근 안내가 나타나요.\n강조된 ‘퇴근하기’ 카드를 확인하고 다음을 눌러 퇴근해볼게요.";
    }
    if (step === "report") {
      return report
        ? "오늘 대화를 바탕으로 잘한 표현, 교정 포인트, 꼭 기억할 표현이 업무일지에 정리돼요."
        : "오늘의 업무일지를 만드는 중이에요...";
    }
    return "카카오톡으로 로그인 후 알림 설정에 동의하면 오늘의 업무일지를 카카오톡으로 확인해볼 수 있고, 2일 이상 결석했을 때 리마인드 알림도 받아볼 수 있어요!";
  })();

  const goodCount = report?.goodExpressions?.length ?? 0;
  const correctionCount = report?.improvementPoints?.length ?? 0;
  const memorizeCount = report?.keyPhrases?.length ?? 0;
  const firstGood = report?.goodExpressions?.[0];
  const firstMemorize = report?.keyPhrases?.[0];

  // 서버의 buildKakaoReportText()와 같은 순서/길이 제한으로 구성한다.
  // 실제 카카오 발송은 text 템플릿 한 덩어리 + 링크 버튼 하나이며, 별도 강조 카드 UI는 없다.
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
      {showFieldWorkPreview && (
        <div className="fixed bottom-20 right-4 z-50 w-80 max-w-[calc(100vw-2rem)] md:bottom-4">
          <div
            className={`absolute -top-9 right-0 px-3 py-1.5 text-[11px] font-bold ${
              isGameMode
                ? "rounded-full bg-[#2f795d] text-white shadow-[0_0_0_3px_rgba(47,121,93,0.22),0_0_20px_rgba(47,121,93,0.44)]"
                : "rounded-full bg-[#1a56ff] text-white shadow-lg"
            }`}
          >
            웹 알림은 여기에서 떠요
          </div>
          <div
            className={`flex items-start gap-3 rounded-lg p-4 text-foreground ${
              isGameMode
                ? "border-2 border-[#2f795d] bg-surface shadow-[0_16px_40px_rgba(47,121,93,0.26),0_0_30px_rgba(47,121,93,0.34)] ring-4 ring-[#2f795d]/30"
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

      {step === "kakao" && report && (
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
          sending ||
          finishing ||
          ending ||
          fieldWorkSimulating ||
          waitingForTarget ||
          waitingForComfort ||
          waitingForReport
        }
        onEnd={handleEnd}
        endPrimary={step === "kakao"}
        showEnd
      />
    </>
  );
}