import { useEffect, useRef, useState } from "react";
import { useLocation, useNavigate } from "react-router-dom";
import { useWorkday } from "@/context/useWorkday";
import { endGuestTrial } from "@/lib/session";
import { TRIAL_REPLY_TEXT } from "@/lib/trialReplies";
import { TRIAL_ROLE_LABEL, TRIAL_ROLE_ORDER, useTrialTargets } from "@/lib/trialTargets";
import { TrialActionBar } from "./TrialActionBar";

type PostReportStage = "report" | "kakao" | "vent";

// "1분 체험하기" 게스트 전용 — 실제 화면(메신저/이메일/리포트)은 그대로 두고, 화면 우측 중앙에
// 하나의 안내 카드로 진행한다. 업무 3건을 마치면 리포트뿐 아니라 실제 서비스의 카카오톡 리포트 알림과
// 고함항아리까지 로그인 없이 차례로 확인할 수 있게 체험 흐름을 이어준다.
export function TrialGuideBar() {
  const { report, conversations, sendReply, finishWorkday, triggerTrialHint } = useWorkday();
  const { targets, doneCount, allDone, activeTarget } = useTrialTargets();
  const navigate = useNavigate();
  const location = useLocation();
  const [finishing, setFinishing] = useState(false);
  const [sending, setSending] = useState(false);
  const [postReportStage, setPostReportStage] = useState<PostReportStage>("report");
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

  // 3명 다 답장하면 자동으로 퇴근 처리하고 리포트 페이지로 이동
  // finishWorkday()가 내부적으로 이미 refresh()를 호출하므로 여기서 또 부르지 않는다(중복 왕복 지연 제거)
  useEffect(() => {
    if (allDone && !report && !finishing) {
      setFinishing(true);
      finishWorkday()
        .then(() => navigate("/reports"))
        .catch(() => setFinishing(false));
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [allDone, report, finishing]);

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

    // 업무 3건 이후는 리포트 → 카카오톡 리포트 알림 → 고함항아리 순으로 시연한다.
    if (allDone && report) {
      if (postReportStage === "report") {
        if (!onReportPage) {
          navigate("/reports");
          return;
        }
        setPostReportStage("kakao");
        setShowKakaoPreview(true);
        return;
      }

      if (postReportStage === "kakao") {
        setShowKakaoPreview(false);
        setPostReportStage("vent");
        navigate("/messenger/vent");
        return;
      }

      if (!onVentPage) navigate("/messenger/vent");
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

  // 답장 3개 + 리포트 + 카카오톡 알림 + 고함항아리까지 6단계로 고정한다.
  const progressDots = TRIAL_ROLE_ORDER.length + 3;
  const postReportFilled =
    postReportStage === "report" ? 0 : postReportStage === "kakao" ? 1 : 2;
  const filledDots = doneCount + (report ? 1 : 0) + postReportFilled;

  const primaryLabel = allDone
    ? !report
      ? null
      : postReportStage === "report"
        ? onReportPage
          ? "카카오톡 리포트 알림 보기"
          : "리포트 보러가기"
        : postReportStage === "kakao"
          ? "고함항아리 체험하기"
          : onVentPage
            ? null
            : "고함항아리로 가기"
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
      ? "리포트를 만드는 중이에요..."
      : postReportStage === "report"
        ? onReportPage
          ? "오늘의 업무 리포트를 확인해보세요. 실제 서비스에서는 퇴근 후 카카오톡으로도 리포트를 받을 수 있어요."
          : "리포트로 이동하는 중이에요..."
        : postReportStage === "kakao"
          ? "이런 식으로 오늘의 업무일지가 카카오톡으로 도착해요."
          : onVentPage
            ? "마지막으로 고함항아리에서 업무 스트레스도 영어로 편하게 털어놓아 보세요."
            : "고함항아리로 이동해 스트레스를 영어로 털어놓아 볼게요."
    : activeTarget
      ? showHintAsk
        ? "이건 답변을 모르겠다구요? 한국어 힌트를 눌러볼게요!"
        : isManagerStep
          ? "이걸 토대로 답변을 작성할게요"
          : `${TRIAL_ROLE_LABEL[activeTarget.role]}에게 온 연락에 답장해보세요`
      // 다음 대상이 아직 도착 전(시차 발송 중) — 곧 오니 잠깐 기다려달라는 안내
      : "곧 다음 연락이 도착해요...";

  const goodCount = report?.good_expressions?.length ?? 0;
  const correctionCount = report?.corrections?.length ?? 0;
  const memorizeCount = report?.recommended_expressions?.length ?? 0;
  const firstGood = report?.good_expressions?.[0]?.text;
  const firstMemorize = report?.recommended_expressions?.[0];

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
        endPrimary={postReportStage === "vent" && onVentPage}
      />
    </>
  );
}
