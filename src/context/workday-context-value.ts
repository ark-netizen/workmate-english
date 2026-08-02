import { createContext } from "react";
import type { Contact, Conversation, EmailThread, TodayItem, WorkdayReport, WorkStatus } from "@/types/domain";
import type { FieldWorkResponse, LeaveKind, LeaveResponse, TodayResponse, Workday } from "@/types/api";

export interface ArrivalBanner {
  id: string;
  title: string;
  body: string;
  to: string;
}

export interface WorkdayContextValue {
  loading: boolean;
  error: string | null;
  needsOnboarding: boolean;
  workStatus: WorkStatus | null;
  workday: Workday | null;
  contacts: Contact[];
  conversations: Conversation[];
  emailThreads: EmailThread[];
  todayItems: TodayItem[];
  report: WorkdayReport | null;
  survey: TodayResponse["survey"];
  isTrial: boolean;
  leaveBalance: TodayResponse["leaveBalance"];
  pendingReviewBanner: TodayResponse["pendingReviewBanner"];
  workContext: TodayResponse["workContext"];
  banner: ArrivalBanner | null;
  dismissBanner: () => void;
  fieldWorkActiveUntil: number | null;
  /** 현재 전송 중인 conversationId/threadId — 발신 트리거 주체(본인 화면 vs 체험판 안내 바)와 무관하게 공유 */
  sendingIds: Set<string>;
  /** 알림센터 배너와 별개로, 방금 도착해 화면에서 잠깐 하이라이트해야 할 메시지/이메일 id */
  highlightedMessageId: string | null;
  /** 하이라이트된 메시지를 실제로 화면에서 봤을 때(해당 대화/스레드 진입 시) 호출해 하이라이트를 끈다 */
  clearHighlightedMessage: () => void;
  /** 특정 메시지/이메일 id를 직접 하이라이트 대상으로 지정 — 체험판 안내 바가 "메시지가 왔어요" 연출을 직접 제어할 때 사용 */
  highlightMessage: (id: string) => void;
  /** 체험판 안내 바가 단어 힌트를 대신 펼쳐 보여주는 연출 신호 — 값이 바뀔 때마다 ReplyHints가 반응 */
  trialHintSignal: number;
  triggerTrialHint: () => void;
  /** conversationId/threadId별 낙관적으로 보여줄 내 답장 — sendReply가 트리거 주체와 무관하게 채우고 지운다 */
  pendingReplies: Map<string, { id: string; body: string; timestamp: string }>;
  getContactById: (id: string) => Contact | undefined;
  getConversationById: (id: string) => Conversation | undefined;
  getEmailThreadById: (id: string) => EmailThread | undefined;
  refresh: () => Promise<void>;
  sendReply: (
    conversationId: string,
    text: string,
    subject?: string,
    hintLevel?: "word" | "sentence" | null,
    hintSentence?: string,
  ) => Promise<void>;
  /** "마음 편하게 말 걸기" — conversationId 없이 동료에게 먼저 말을 건넴, 생성/재사용된 대화 id를 돌려줌 */
  sendVent: (text: string) => Promise<{ conversationId: string }>;
  markRead: (conversationId: string) => Promise<void>;
  finishWorkday: () => Promise<void>;
  goOnFieldWork: () => Promise<FieldWorkResponse>;
  takeLeave: (kind: LeaveKind) => Promise<LeaveResponse>;
  /** 개발용: 다음 예약 연락을 예정 시각과 상관없이 즉시 발송 */
  deliverNext: () => Promise<unknown>;
}

export const WorkdayContext = createContext<WorkdayContextValue | null>(null);
