import { useEffect, useState } from "react";
import { useLocation, useNavigate } from "react-router-dom";
import { useWorkday } from "@/context/useWorkday";
import { endGuestTrial } from "@/lib/session";
import { TRIAL_REPLY_TEXT } from "@/lib/trialReplies";
import { TRIAL_ROLE_LABEL, TRIAL_ROLE_ORDER, useTrialTargets } from "@/lib/trialTargets";
import { TrialActionBar } from "./TrialActionBar";

// "1분 체험하기" 게스트 전용 — 실제 화면(메신저/이메일/리포트)은 그대로 두고, 화면 우측 중앙에
// 딱 하나의 카드만 계속 눌러서 진행할 수 있게 안내하는 오버레이. 페이지 이동과 답장 전송을 전부
// 이 카드 하나가 맡는다. 홈 화면은 SectionTourGuide가 같은 카드 자리에서 자체적으로 안내하므로
// 여기서는 렌더링하지 않는다(안내 카드가 두 개 겹쳐 보이는 것을 방지).
export function TrialGuideBar() {
  const { report, sendReply, finishWorkday, triggerTrialHint } = useWorkday();
  const { targets, doneCount, allDone, activeTarget } = useTrialTargets();
  const navigate = useNavigate();
  const location = useLocation();
  const [finishing, setFinishing] = useState(false);
  const [sending, setSending] = useState(false);
  // 상사(매니저) 단계 한정 — "답변 모르겠으면 한국어 힌트부터" 시나리오의 진행 상태
  const [managerHintStage, setManagerHintStage] = useState<"ask" | "shown">("ask");

  const onActivePage = !!activeTarget && location.pathname === activeTarget.path;
  const onReportPage = location.pathname === "/reports";
  const onHomePage = location.pathname === "/";
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

  const handleEnd = async () => {
    await endGuestTrial();
    window.location.href = "/";
  };

  const handlePrimaryAction = async () => {
    if (!activeTarget || sending) return;
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

  // 동료·상사·거래처가 시차를 두고 도착해서 targets.length가 처음엔 1, 2로 작게 잡힌다 —
  // 점 개수가 그때그때 늘었다 줄었다 하면 이상해 보이니 항상 고정된 전체 인원 기준으로 그린다
  const progressDots = TRIAL_ROLE_ORDER.length + 1; // 답장 3개 + 리포트
  const filledDots = doneCount + (report ? 1 : 0);

  const primaryLabel = !activeTarget
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
      : onReportPage
        ? "리포트를 확인하고 오늘의 영어내용을 정리하고 근무시간을 확인해요!"
        : "리포트로 이동하는 중..."
    : activeTarget
      ? showHintAsk
        ? "이건 답변을 모르겠다구요? 한국어 힌트를 눌러볼게요!"
        : isManagerStep
          ? "이걸 토대로 답변을 작성할게요"
          : `${TRIAL_ROLE_LABEL[activeTarget.role]}에게 온 연락에 답장해보세요`
      // 다음 대상이 아직 도착 전(시차 발송 중) — 곧 오니 잠깐 기다려달라는 안내
      : "곧 다음 연락이 도착해요...";

  return (
    <TrialActionBar
      message={message}
      dotsTotal={progressDots}
      dotsFilled={filledDots}
      primaryLabel={primaryLabel}
      onPrimary={handlePrimaryAction}
      primaryDisabled={sending}
      onEnd={handleEnd}
      endPrimary={onReportPage}
    />
  );
}
