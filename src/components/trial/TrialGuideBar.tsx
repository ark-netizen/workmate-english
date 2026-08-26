import { useEffect, useRef, useState } from "react";
import { useLocation, useNavigate } from "react-router-dom";
import { useWorkday } from "@/context/useWorkday";
import { endGuestTrial } from "@/lib/session";
import { TRIAL_REPLY_TEXT } from "@/lib/trialReplies";
import { TRIAL_ROLE_LABEL, TRIAL_ROLE_ORDER, useTrialTargets } from "@/lib/trialTargets";
import { TrialActionBar } from "./TrialActionBar";

type FinalTrialStage = "vent" | "report" | "kakao";

// "1분 체험하기" 게스트 전용 — 실제 화면(메신저/이메일/리포트)은 그대로 두고 하나의 안내 카드로 진행한다.
// 업무 3건을 마친 뒤에는 근무 중에만 가능한 고함항아리를 먼저 체험하고, 그 다음 퇴근 리포트와
// 카카오톡 리포트 알림 미리보기까지 이어서 로그인 없이 핵심 기능을 한 번에 보여준다.
export function TrialGuideBar() {
  const { report, conversations, sendReply, finishWorkday, triggerTrialHint } = useWorkday();
  const { targets, doneCount, allDone, activeTarget } = useTrialTargets();
  const navigate = useNavigate();
  const location = useLocation();
  const [finishing, setFinishing] = useState(false);
  const [sending, setSending] = useState(false);
  const [finalStage, setFinalStage] = useState<FinalTrialStage>("vent");
  const [showKakaoPreview, setShowKakaoPreview] = useState(false);
  // 상사(매니저) 단계 한정 — "답변 모르겠으면 한국어 힌트부터" 시나리오의 진행 상태
  const [managerHintStage, setManagerHintStage] = useState<"ask" | "shown">("ask");

  const onActivePage = !!activeTarget && location.pathname === activeTarget.path;
  const onReportPage = location.pathname === "/reports";
  const onHomePage = location.pathname === "/";
  const ventConversation = conversations.find((conversation) => conversation.kind === "vent");
  const onVentPage =
    location.pathname === "/messenger/vent" ||
    (!!ventConversation && location.pathname === `/messenger/${ventConversation.id}`);
  // "상사" 단계에서만 등장하는 "답변 모르겠으면 한국어 힌트부터 눌러보기" 시나리오
  const isManagerStep = activeTarget?.role === "manager" && onActivePage;
  const showHintAsk = isManagerStep && managerHintStage === "ask";

  // 기본 업무 3건을 다 끝냈으면 퇴근 전에 고함항아리를 먼저 보여준다.
  // 고함항아리에 실제로 한 번 메시지를 보내서 vent 대화가 생성된 뒤에만 퇴근 처리한다.
  useEffect(() => {
    if (!allDone || report || finishing) return;

    if (!ventConversation) {
      setFinalStage("vent");
      if (location.pathname !== "/messenger/vent") navigate("/messenger/vent");
      return;
    }

    setFinishing(true);
    finishWorkday()
      .then(() => {
        setFinalStage("report");
        navigate("/reports");
      })
      .catch(() => setFinishing(false));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [allDone, report, finishing, ventConversation?.id]);

  // "○○에게 가기" 버튼을 눌러야만 다음 대화로 이동하는 게 번거롭다는 피드백 — 새 대상이
  // 나타나면(직전 대상과 다르면) 자동으로 그 대화로 이동한다. 한 번 자동 이동한 대상으로는
  // 다시 강제로 데려가지 않아서, 사용자가 스스로 다른 화면을 둘러보는 것까지 막지는 않는다.
  const autoNavigatedIdRef = useRef<string | null>(null);
  useEffect(() => {
    if (!activeTarget) return;
    if (autoNavigatedIdRef.current === activeTarget.id) return;
    autoNavigatedIdRef.current = activeTarget.id;
    if (location.pathname !== activeTarget.path) {
      navigate(activeTarget.path);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [activeTarget?.id]);

  const handleEnd = async () => {
    await endGuestTrial();
    window.location.href = "/";
  };

  const handlePrimaryAction = async () => {
    if (sending) return;

    if (allDone) {
      // 고함항아리를 아직 안 보냈다면 해당 화면으로 이동만 한다. 실제 전송은 화면의 "말 걸기" 버튼으로 체험한다.
      if (!report) {
        if (!onVentPage) navigate("/messenger/vent");
        return;
      }

      // 리포트 확인 뒤 실제 서비스에서 받는 카카오톡 리포트 알림 형태를 보여준다.
      if (finalStage === "report") {
        if (!onReportPage) {
          navigate("/reports");
          return;
        }
        setFinalStage("kakao");
        setShowKakaoPreview(true);
      }
      return;
    }

    if (!activeTarget) return;
    // "상사" 단계 — 아직 힌트를 안 보여줬으면, 이번 클릭은 전송이 아니라 단어 힌트를 대신 펼쳐 보여주는 동작
    if (showHintAsk) {
      triggerTrialHint();
      setManagerHintStage("shown");
      return;
    }
    if (!onActivePage) {
      navigate(activeTarget.path);
      return;
    }
    setSending(true);
    try {
      await sendReply(activeTarget.id, TRIAL_REPLY_TEXT[activeTarget.role] ?? "", activeTarget.subject);
    } finally {
      setSending(false);
    }
  };

  // 홈 화면은 SectionTourGuide 쪽 "새 메시지" 단계가 대신 안내하므로 여기서는 표시하지 않는다
  if (onHomePage || targets.length === 0) return null;

  // 답장 3개 + 고함항아리 + 리포트 + 카카오톡 알림 = 총 6단계.
  const progressDots = TRIAL_ROLE_ORDER.length + 3;
  const filledDots =
    doneCount +
    (ventConversation ? 1 : 0) +
    (report ? 1 : 0) +
    (finalStage === "kakao" ? 1 : 0);

  const primaryLabel = allDone
    ? !report
      ? ventConversation
        ? null
        : onVentPage
          ? null
          : "고함항아리로 가기"
      : finalStage === "report"
        ? onReportPage
          ? "카카오톡 리포트 알림 보기"
          : "리포트 보러가기"
        : null
    : !activeTarget
      ? null
      : sending
        ? "전송 중..."
        : showHintAsk
          ? "한국어 힌트 보기"
          : onActivePage
            ? "이 내용으로 답장 보내기"
            : `${TRIAL_ROLE_LABEL[activeTarget.role]}에게 가기`;

  const message = allDone
    ? !report
      ? ventConversation
        ? "고함항아리까지 확인했어요. 이제 퇴근 리포트를 만드는 중이에요..."
        : onVentPage
          ? "업무 스트레스도 영어로 털어놓을 수 있어요. 미리 입력된 문장을 그대로 보내보세요."
          : "마지막 업무를 마쳤어요. 퇴근 전에 고함항아리도 체험해볼게요."
      : finalStage === "report"
        ? onReportPage
          ? "오늘의 업무 리포트를 확인해보세요. 실제 서비스에서는 퇴근 후 카카오톡으로도 리포트를 받을 수 있어요."
          : "리포트로 이동하는 중이에요..."
        : "이런 식으로 오늘의 업무일지가 카카오톡으로 도착해요."
    : activeTarget
      ? showHintAsk
        ? "이건 답변을 모르겠다구요? 한국어 힌트를 눌러볼게요!"
        : isManagerStep
          ? "이걸 토대로 답변을 작성할게요"
          : `${TRIAL_ROLE_LABEL[activeTarget.role]}에게 온 연락에 답장해보세요`
      // 다음 대상이 아직 도착 전(시차 발송 중) — 곧 오니 잠깐 기다려달라는 안내
      : "곧 다음 연락이 도착해요...";

  const goodCount = report?.goodExpressions?.length ?? 0;
  const correctionCount = report?.improvementPoints?.length ?? 0;
  const memorizeCount = report?.keyPhrases?.length ?? 0;
  const firstGood = report?.goodExpressions?.[0]?.text;
  const firstMemorize = report?.keyPhrases?.[0];

  return (
    <>
      {showKakaoPreview && report && (
        <div className="relative z-20 mx-3 my-2 overflow-hidden rounded-2xl border border-[#ded36b] bg-[#fee500] shadow-xl md:fixed md:right-[23rem] md:top-1/2 md:mx-0 md:my-0 md:w-[340px] md:-translate-y-1/2">
          <div className="flex items-center justify-between px-4 py-3">
            <div>
              <p className="text-xs font-bold text-[#2d2926]">카카오톡 알림 미리보기</p>
              <p className="mt-0.5 text-[10px] text-[#2d2926]/60">퇴근 후 리포트 알림</p>
            </div>
            <span className="rounded-full bg-[#2d2926] px-2 py-1 text-[10px] font-bold text-white">부캐영어</span>
          </div>
          <div className="mx-3 mb-3 rounded-xl bg-white p-4 text-[#242424] shadow-sm">
            <p className="text-sm font-bold">오늘의 업무일지가 도착했어요 📋</p>
            <p className="mt-2 text-xs leading-relaxed text-[#555]">
              잘한 표현 {goodCount}건 · 교정 {correctionCount}건 · 꼭 기억할 표현 {memorizeCount}건
            </p>
            {firstGood && <p className="mt-3 text-xs font-medium leading-relaxed">✅ “{firstGood}”</p>}
            {firstMemorize?.en && (
              <p className="mt-2 text-xs leading-relaxed text-[#444]">
                📌 {firstMemorize.en}
                {firstMemorize.ko ? ` (${firstMemorize.ko})` : ""}
              </p>
            )}
            <div className="mt-4 rounded-lg bg-[#f5f5f5] px-3 py-2 text-center text-[11px] font-medium text-[#555]">
              업무일지 보러가기
            </div>
          </div>
          <p className="px-4 pb-3 text-[10px] leading-relaxed text-[#2d2926]/65">
            체험판에서는 실제 카카오톡으로 발송하지 않고 수신 화면만 미리 보여드려요.
          </p>
        </div>
      )}

      <TrialActionBar
        message={message}
        dotsTotal={progressDots}
        dotsFilled={filledDots}
        primaryLabel={primaryLabel}
        onPrimary={primaryLabel ? handlePrimaryAction : undefined}
        primaryDisabled={sending}
        onEnd={handleEnd}
        endPrimary={finalStage === "kakao"}
      />
    </>
  );
}
