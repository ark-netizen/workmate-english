import { useMemo } from "react";
import { useWorkday } from "@/context/useWorkday";

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

// "1분 체험하기" 진행 상태(동료→상사→거래처 순서로 아직 답장 안 한 대상 찾기) — TrialGuideBar와
// HomePage(SectionTourGuide의 "새 메시지" 단계)가 같은 기준으로 다음 대상을 알아야 해서 공유 훅으로 분리
export function useTrialTargets() {
  const { contacts, conversations, emailThreads } = useWorkday();

  const targets = useMemo<TrialTarget[]>(() => {
    return TRIAL_ROLE_ORDER.map((role): TrialTarget | null => {
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
    }).filter((t): t is TrialTarget => t !== null);
  }, [contacts, conversations, emailThreads]);

  const doneCount = targets.filter((t) => t.done).length;
  const allDone = targets.length > 0 && doneCount === targets.length;
  const activeTarget = targets.find((t) => !t.done) ?? null;

  return { targets, doneCount, allDone, activeTarget };
}
