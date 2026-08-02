import { useEffect, useMemo, useState } from "react";
import { useLocation, useNavigate } from "react-router-dom";
import { useWorkday } from "@/context/useWorkday";
import { endGuestTrial } from "@/lib/session";
import { TRIAL_REPLY_TEXT } from "@/lib/trialReplies";
import { TrialActionBar } from "./TrialActionBar";

type Role = "colleague" | "manager" | "client";
const ROLE_ORDER: Role[] = ["colleague", "manager", "client"];
const ROLE_LABEL: Record<Role, string> = { colleague: "동료", manager: "상사", client: "거래처" };

interface Target {
  role: Role;
  kind: "messenger" | "email";
  id: string;
  path: string;
  subject?: string;
  done: boolean;
  /** 홈 화면 "오늘의 연락" 목록에서 이 대상의 항목을 하이라이트할 때 쓰는, 가장 최근 메시지/이메일 id */
  messageId?: string;
}

// "1분 체험하기" 게스트 전용 — 실제 화면(홈/메신저/이메일/리포트)은 그대로 두고, 화면 하단에 딱 하나의
// 버튼만 계속 눌러서 진행할 수 있게 안내하는 오버레이 바. 페이지 이동과 답장 전송을 전부 이 버튼 하나가 맡는다.
export function TrialGuideBar() {
  const {
    contacts,
    conversations,
    emailThreads,
    report,
    sendReply,
    finishWorkday,
    triggerTrialHint,
    highlightMessage,
  } = useWorkday();
  const navigate = useNavigate();
  const location = useLocation();
  const [finishing, setFinishing] = useState(false);
  const [sending, setSending] = useState(false);
  // 상사(매니저) 단계 한정 — "답변 모르겠으면 한국어 힌트부터" 시나리오의 진행 상태
  const [managerHintStage, setManagerHintStage] = useState<"ask" | "shown">("ask");
  // 홈 화면 첫 진입 — "왼쪽 메뉴 둘러보세요" → (잠시 후) "메시지가 왔어요!" 순서로 보여주는 2단계 연출
  const [homeStage, setHomeStage] = useState<"browse" | "arrived">("browse");

  const targets = useMemo<Target[]>(() => {
    return ROLE_ORDER.map((role): Target | null => {
      const contact = contacts.find((c) => c.role === role);
      if (!contact) return null;
      const convo = conversations.find((c) => c.contactId === contact.id);
      if (convo) {
        return {
          role,
          kind: "messenger",
          id: convo.id,
          path: `/messenger/${convo.id}`,
          done: convo.messages.some((m) => m.from === "user"),
          messageId: convo.messages[convo.messages.length - 1]?.id,
        };
      }
      const thread = emailThreads.find((t) => t.contactId === contact.id);
      if (thread) {
        return {
          role,
          kind: "email",
          id: thread.id,
          path: `/email/${thread.id}`,
          subject: thread.subject,
          done: thread.emails.some((m) => m.from === "user"),
          messageId: thread.emails[thread.emails.length - 1]?.id,
        };
      }
      return null;
    }).filter((t): t is Target => t !== null);
  }, [contacts, conversations, emailThreads]);

  const doneCount = targets.filter((t) => t.done).length;
  const allDone = targets.length > 0 && doneCount === targets.length;
  const activeTarget = targets.find((t) => !t.done) ?? null;
  const onActivePage = !!activeTarget && location.pathname === activeTarget.path;
  const onReportPage = location.pathname === "/reports";
  const onHomePage = location.pathname === "/";
  const inHomeBrowseStage = onHomePage && doneCount === 0 && homeStage === "browse";
  const inHomeArrivedStage = onHomePage && doneCount === 0 && homeStage === "arrived";
  // "상사" 단계에서만 등장하는 "답변 모르겠으면 한국어 힌트부터 눌러보기" 시나리오
  const isManagerStep = activeTarget?.role === "manager" && onActivePage;
  const showHintAsk = isManagerStep && managerHintStage === "ask";

  // 홈 화면에 처음 도착하면, 알림 배너와 동시에 정신없이 안내하지 않도록 잠깐 "둘러보세요"만 보여주고
  // 그 다음에 "메시지가 왔어요!"로 넘어가면서 오늘의 연락 목록 항목을 하이라이트한다
  useEffect(() => {
    if (!inHomeBrowseStage) return;
    const timer = setTimeout(() => {
      setHomeStage("arrived");
      if (activeTarget?.messageId) highlightMessage(activeTarget.messageId);
    }, 2500);
    return () => clearTimeout(timer);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [inHomeBrowseStage]);

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

  if (targets.length === 0) return null;

  const progressDots = targets.length + 1; // 답장 3개 + 리포트
  const filledDots = doneCount + (report ? 1 : 0);

  const activeContactName = activeTarget ? contacts.find((c) => c.role === activeTarget.role)?.name : undefined;

  const primaryLabel = !activeTarget
    ? null
    : inHomeBrowseStage
      ? null
      : sending
        ? "전송 중..."
        : showHintAsk
          ? "한국어 힌트 보기"
          : onActivePage
            ? "이 내용으로 답장 보내기"
            : `${ROLE_LABEL[activeTarget.role]}에게 가기`;

  // 홈 화면에서는 "둘러보세요" → "메시지가 왔어요!" 순서로, "상사" 단계(3단계 중 중간)에서는
  // 실제 서비스의 핵심 기능인 힌트 보기를 직접 눌러 보여주는 미니 시나리오로 안내한다
  // "만드는 중"은 finishing 플래그가 아니라 report 도착 여부로 판단 — finishing은 성공 시 다시 꺼지지
  // 않아서, 플래그 기준으로 하면 리포트가 이미 화면에 떠 있어도 계속 "만드는 중"이라고 나오는 문제가 있었음
  const message = allDone
    ? !report
      ? "리포트를 만드는 중이에요..."
      : onReportPage
        ? "리포트를 확인하고 오늘의 영어내용을 정리하고 근무시간을 확인해요!"
        : "리포트로 이동하는 중..."
    : activeTarget
      ? inHomeBrowseStage
        ? "왼쪽 메뉴도 자유롭게 둘러보세요"
        : showHintAsk
          ? "이건 답변을 모르겠다구요? 한국어 힌트를 눌러볼게요!"
          : isManagerStep
            ? "이걸 토대로 답변을 작성할게요"
            : inHomeArrivedStage
              ? `${activeContactName ?? ROLE_LABEL[activeTarget.role]}님에게 새 메시지가 왔어요!`
              : `${ROLE_LABEL[activeTarget.role]}에게 온 연락에 답장해보세요`
      : "";

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
