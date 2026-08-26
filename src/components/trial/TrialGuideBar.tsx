import { useEffect, useRef, useState } from "react";
import { useLocation, useNavigate } from "react-router-dom";
import { useWorkday } from "@/context/useWorkday";
import { endGuestTrial } from "@/lib/session";
import { TRIAL_REPLY_TEXT } from "@/lib/trialReplies";
import { TRIAL_ROLE_LABEL, TRIAL_ROLE_ORDER, useTrialTargets } from "@/lib/trialTargets";
import { TrialActionBar } from "./TrialActionBar";

type FinalTrialStage = "fieldwork" | "comfort" | "report" | "kakao";

const KAKAO_TEXT_MAX = 190;
function truncateKakaoText(value: string | undefined, max: number) {
  if (!value) return value;
  return value.length > max ? `${value.slice(0, max - 1)}…` : value;
}

// "1분 체험하기" 게스트 전용 — 실제 화면을 그대로 쓰되 하나의 안내 카드로 진행한다.
// 업무 3건 이후에는 "외근 중" 반복 → 바쁨 감지 → 동료의 선제 위로 메시지 → 리포트 → 카카오 알림까지
// 실제 서비스의 연결 구조가 보이도록 체험 단계를 이어준다.
export function TrialGuideBar() {
  const { report, conversations, sendReply, finishWorkday, triggerTrialHint } = useWorkday();
  const { targets, doneCount, allDone, activeTarget } = useTrialTargets();
  const navigate = useNavigate();
  const location = useLocation();
  const [finishing, setFinishing] = useState(false);
  const [sending, setSending] = useState(false);
  const [finalStage, setFinalStage] = useState<FinalTrialStage>("fieldwork");
  const [showKakaoPreview, setShowKakaoPreview] = useState(false);
  // 상사(매니저) 단계 한정 — "답변 모르겠으면 한국어 힌트부터" 시나리오의 진행 상태
  const [managerHintStage, setManagerHintStage] = useState<"ask" | "shown">("ask");

  const onActivePage = !!activeTarget && location.pathname === activeTarget.path;
  const onReportPage = location.pathname === "/reports";
  const onHomePage = location.pathname === "/";
  const colleagueTarget = targets.find((target) => target.role === "colleague");
  const ventConversation = conversations.find((conversation) => conversation.kind === "vent");
  const onVentPage = !!ventConversation && location.pathname === `/messenger/${ventConversation.id}`;
  // "상사" 단계에서만 등장하는 "답변 모르겠으면 한국어 힌트부터 눌러보기" 시나리오
  const isManagerStep = activeTarget?.role === "manager" && onActivePage;
  const showHintAsk = isManagerStep && managerHintStage === "ask";

  // 기본 업무 3건이 끝나면 바로 퇴근시키지 않는다.
  // 먼저 동료 대화 화면에서 실제 "지금 외근 중" 버튼을 두 번 눌러 반복된 바쁨 감지 기능을 체험하고,
  // 서버가 선제 위로 메시지를 생성해 고함항아리가 생기면 그 대화로 자동 이동한다.
  useEffect(() => {
    if (!allDone || report) return;

    if (!ventConversation) {
      setFinalStage("fieldwork");
      if (colleagueTarget && location.pathname !== colleagueTarget.path) {
        navigate(colleagueTarget.path);
      }
      return;
    }

    setFinalStage("comfort");
    const ventPath = `/messenger/${ventConversation.id}`;
    if (location.pathname !== ventPath) navigate(ventPath);
  }, [allDone, report, ventConversation?.id, colleagueTarget?.path, location.pathname, navigate]);

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
    if (sending || finishing) return;

    if (allDone) {
      // 반복된 외근 신호로 동료가 먼저 말을 걸어온 뒤, 그 메시지를 실제 화면에서 확인하고 나서 퇴근한다.
      if (!report) {
        if (!ventConversation) {
          if (colleagueTarget) navigate(colleagueTarget.path);
          return;
        }

        setFinishing(true);
        try {
          await finishWorkday();
          setFinalStage("report");
          navigate("/reports");
        } finally {
          setFinishing(false);
        }
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

  // 답장 3개 + 스트레스 감지/선제 위로 + 리포트 + 카카오톡 알림 = 총 6단계.
  const progressDots = TRIAL_ROLE_ORDER.length + 3;
  const filledDots =
    doneCount +
    (ventConversation ? 1 : 0) +
    (report ? 1 : 0) +
    (finalStage === "kakao" ? 1 : 0);

  const primaryLabel = allDone
    ? !report
      ? finalStage === "comfort" && ventConversation
        ? finishing
          ? "리포트 만드는 중..."
          : "퇴근하고 리포트 보기"
        : null
      : finalStage === "report"
        ? onReportPage
          ? "카카오톡 알림 미리보기"
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
      ? finalStage === "fieldwork"
        ? "업무 연락은 모두 처리했어요. 이번엔 바쁨 감지 기능을 볼게요.\n아래 입력창의 ‘지금 외근 중’을 2번 눌러보세요. 반복된 바쁨을 감지하면 동료가 먼저 말을 걸어옵니다."
        : onVentPage
          ? "외근 신호가 반복되자 동료가 먼저 말을 걸어왔어요. 이렇게 먼저 온 위로 메시지는 고함항아리에 모여요."
          : "반복된 바쁨을 감지했어요. 동료의 메시지로 이동하는 중이에요..."
      : finalStage === "report"
        ? onReportPage
          ? "오늘 대화를 바탕으로 잘한 표현, 교정 포인트, 꼭 기억할 표현이 업무일지에 정리돼요."
          : "리포트로 이동하는 중이에요..."
        : "카카오톡으로 로그인 후 알림 설정에 동의하면 오늘의 업무일지를 카카오톡으로 확인해볼 수 있고, 2일 이상 결석했을 때 리마인드 알림도 받아볼 수 있어요!"
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
      {showKakaoPreview && report && (
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
        dotsTotal={progressDots}
        dotsFilled={filledDots}
        primaryLabel={primaryLabel}
        onPrimary={primaryLabel ? handlePrimaryAction : undefined}
        primaryDisabled={sending || finishing}
        onEnd={handleEnd}
        endPrimary={finalStage === "kakao"}
        showEnd={finalStage === "kakao" && showKakaoPreview}
      />
    </>
  );
}
