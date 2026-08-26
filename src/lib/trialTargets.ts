import { useEffect, useMemo } from "react";
import { useWorkday } from "@/context/useWorkday";
import { useTrialSequence } from "@/lib/trialSequence";

export type TrialRole = "colleague" | "manager" | "client";
export const TRIAL_ROLE_ORDER: TrialRole[] = ["colleague", "manager", "client"];
export const TRIAL_ROLE_LABEL: Record<TrialRole, string> = { colleague: "동료", manager: "상사", client: "거래처" };

export interface TrialTarget {
  role: TrialRole;
  kind: "messenger" | "email";
  id: string;
  path: string;
  subject?: string;
  done: boolean;
  /** 홈 화면 "오늘의 연락" 목록에서 이 대상의 항목을 하이라이트할 때 쓰는, 가장 최근 메시지/이메일 id */
  messageId?: string;
}

// 실제 대화/메일 데이터는 체험 단계 자체를 결정하지 않는다.
// trialStep이 유일한 진행 상태이고, 여기서는 각 단계가 사용할 실제 target만 찾아준다.
// 예외적으로 HOME_TOUR가 끝난 뒤 첫 연락이 실제로 배달된 순간만 감지해서 colleague 단계로 넘긴다.
export function useTrialTargets() {
  const { contacts, conversations, emailThreads } = useWorkday();
  const { step, setStep } = useTrialSequence();

  const actualTargets = useMemo<TrialTarget[]>(() => {
    return TRIAL_ROLE_ORDER.map((role): TrialTarget | null => {
      const contact = contacts.find((c) => c.role === role);
      if (!contact) return null;
      // 고함항아리(vent)도 동료 contactId를 그대로 쓰기 때문에 최근순 배열에서 vent가 먼저 잡히면
      // 이미 끝낸 동료 업무를 "미답변"으로 오인한다. 체험의 3개 기본 업무는 scenario만 대상으로 고정한다.
      const convo = conversations.find((c) => c.contactId === contact.id && c.kind === "scenario");
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
      const thread = emailThreads.find((t) => t.contactId === contact.id && t.kind === "scenario");
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
    }).filter((t): t is TrialTarget => t !== null);
  }, [contacts, conversations, emailThreads]);

  // 최초 홈 투어가 닫히면 HomePage가 첫 연락을 deliverNext()한다.
  // 그 데이터가 실제로 도착한 순간만 HOME_TOUR → COLLEAGUE로 전환한다.
  // 이후 단계는 모두 TrialGuideBar의 명시적 다음 액션으로만 바뀐다.
  useEffect(() => {
    if (step === "home-tour" && actualTargets.length > 0) {
      setStep("colleague");
    }
  }, [step, actualTargets.length, setStep]);

  // HOME_TOUR 동안에는 예약/선행 데이터가 있어도 홈 투어가 흔들리지 않도록 target을 노출하지 않는다.
  const targets = step === "home-tour" ? [] : actualTargets;
  const doneCount = targets.filter((t) => t.done).length;
  const allDone = targets.length === TRIAL_ROLE_ORDER.length && doneCount === TRIAL_ROLE_ORDER.length;
  const activeTarget = targets.find((t) => !t.done) ?? null;

  return { targets, doneCount, allDone, activeTarget };
}
