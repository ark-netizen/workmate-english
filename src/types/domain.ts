export type WorkStatus = "before-work" | "working" | "off-work" | "leave";

export type ContactRole = "colleague" | "manager" | "client" | "hr";

export type Channel = "messenger" | "email";

export interface Contact {
  id: string;
  name: string;
  role: ContactRole;
  title: string;
  company?: string;
}

// 상대(contact) 메시지에만 실려오는, LLM이 그 메시지와 함께 만든 실제 답장 힌트.
// 스크립트형(체크인/복습 등) 메시지에는 없을 수 있음 — 그럴 땐 화면에서 고정 힌트로 대체한다.
export interface MessageHints {
  koreanHint?: string;
  replyHints?: string[];
  wordHints?: { en: string; ko: string }[];
}

export interface Message extends MessageHints {
  id: string;
  from: "user" | "contact";
  body: string;
  timestamp: string;
}

export type ConversationKind = "scenario" | "vent" | "review" | "checkin" | "ojt";

export interface Conversation {
  id: string;
  contactId: string;
  channel: "messenger";
  kind: ConversationKind;
  unreadCount: number;
  updatedAt: string;
  messages: Message[];
}

export interface Email extends MessageHints {
  id: string;
  from: "user" | "contact";
  subject: string;
  body: string;
  timestamp: string;
}

export interface EmailThread {
  id: string;
  contactId: string;
  channel: "email";
  kind: ConversationKind;
  subject: string;
  unreadCount: number;
  updatedAt: string;
  emails: Email[];
}

export type TodayItemStatus = "pending" | "answered" | "resolved";

export interface TodayItem {
  id: string;
  contactId: string;
  channel: Channel;
  kind: ConversationKind;
  targetId: string;
  title: string;
  status: TodayItemStatus;
  dueAt: string;
}

export interface GoodExpression {
  text: string;
  note: string;
}

export interface Correction {
  before: string;
  after: string;
  note: string;
}

export interface KeyExpression {
  en: string;
  ko: string;
  note: string;
}

export interface DifficultExpression {
  contactName: string;
  role: string;
  hintLevel: "word" | "sentence";
  originalMessage: string;
  yourReply: string;
}

export interface WorkdayReport {
  date: string;
  summary: string;
  goodExpressions: GoodExpression[];
  improvementPoints: Correction[];
  keyPhrases?: KeyExpression[];
  nextPreview: string;
  difficultExpressions?: DifficultExpression[];
}
