import type {
  Contact,
  Conversation,
  EmailThread,
  TodayItem,
  WorkdayReport,
  WorkStatus,
} from "./domain";

export interface Workday {
  id: string;
  state: string;
  started_at: string;
  ended_at: string | null;
}

export interface SurveyQuestion {
  text: string;
  placeholder: string;
}

export interface WorkContextRole {
  role: "colleague" | "manager" | "client";
  name: string;
  purposeKo: string;
  purposeEn: string;
}

export interface WorkContext {
  titleKo: string;
  titleEn: string;
  summaryKo: string;
  summaryEn: string;
  goalKo: string;
  goalEn: string;
  stageKo: string;
  stageEn: string;
  topicStatus: "active" | "completed" | "switched";
  roles?: WorkContextRole[];
}

export interface TodayResponse {
  needsOnboarding: boolean;
  workStatus?: WorkStatus;
  workday?: Workday;
  contacts?: Contact[];
  conversations?: Conversation[];
  emailThreads?: EmailThread[];
  todayItems?: TodayItem[];
  report?: WorkdayReport | null;
  isTrial?: boolean;
  leaveBalance?: { rankLeave: number; earnedLeave: number; total: number } | null;
  pendingReviewBanner?: { conversationId: string; contactName: string; url: string } | null;
  workContext?: WorkContext | null;
  survey?: {
    id: string;
    title: string;
    description: string | null;
    questions: SurveyQuestion[];
    alreadyRespondedViaBanner: boolean;
    isRealAccount: boolean;
    isFirstVisit: boolean;
  } | null;
}

export interface FieldWorkResponse {
  fieldWork?: boolean;
  delayMinutes?: number;
  rescheduled?: unknown[];
  skipped?: boolean;
  reason?: string;
}

export type PeriodRange = "week" | "month";

export interface PeriodReportResponse {
  available: boolean;
  range: PeriodRange;
  rangeLabel: string;
  daysCount?: number;
  headline?: string;
  narrative?: string;
  strengths?: string[];
  recurring_issues?: string[];
  recommended_focus?: string[];
}

export type LeaveKind = "annual" | "half_day" | "cancel";

export interface LeaveResponse {
  leave?: boolean;
  kind?: LeaveKind;
  state?: string;
  cancelled?: boolean;
  skipped?: boolean;
  reason?: string;
}

export type EnglishLevel = "beginner" | "intermediate" | "advanced";

export type AdminRole = "full" | "readonly";

export interface AdminUserRow {
  id: string;
  email: string | null;
  display_name: string | null;
  is_trial: boolean;
  created_at: string;
  english_level: EnglishLevel | null;
  industry: string | null;
  job_role: string | null;
  attendanceByState: Record<string, number>;
  leave: { annual: number; halfDay: number; cancel: number };
  fieldWorkCount: number;
  stressPingCount: number;
  messages: { total: number; awaiting: number; replied: number; done: number };
  promotion?: PromotionInfo;
}

export interface PromotionPersonaFeedback {
  role: string;
  name: string;
  satisfaction: number;
  suggestion: string;
}

export interface PromotionQna {
  prompt: string;
  answer: string;
}

export interface PromotionEvaluation {
  fromRank: string;
  toRank: string;
  satisfaction: number | null;
  personaFeedback: PromotionPersonaFeedback[];
  qna: PromotionQna[];
  createdAt: string;
}

export interface PromotionInfo {
  currentRank: string;
  promotionCount: number;
  workdaysSincePromo: number;
  requiredDays: number;
  eligible: boolean;
  atTop: boolean;
  inProgress: boolean;
  rankLeaveBalance: number;
  earnedLeaveBalance: number;
  evaluations?: PromotionEvaluation[];
}

export interface SupportInquiry {
  id: string;
  user_id: string;
  message: string;
  status: "open" | "resolved";
  created_at: string;
  email: string | null;
  display_name: string | null;
}

export interface Survey {
  id: string;
  title: string;
  description: string | null;
  questions: SurveyQuestion[];
  published: boolean;
  published_at: string | null;
  reviews_public: boolean;
  updated_at: string;
}

export type SurveySource = "banner" | "chat_preset" | "chat_freeform" | "chat_inquiry";

export interface SurveyResponseRow {
  id: string;
  user_id: string;
  rating: number;
  review: string | null;
  answers: string[];
  featured: boolean;
  public_review: string | null;
  public_display_name: string | null;
  source: SurveySource;
  occurrence: number;
  created_at: string;
  email: string | null;
  display_name: string | null;
}

export interface PublicReview {
  rating: number;
  review: string;
  displayName: string;
  createdAt: string;
}

export interface AdminDashboardResponse {
  users: AdminUserRow[];
  generatedAt: string;
  role: AdminRole;
  supportInquiries: SupportInquiry[];
  survey: Survey | null;
  responses: SurveyResponseRow[];
}

export interface ProfileResponse {
  display_name?: string;
  email?: string | null;
  privacy_consented?: boolean;
  is_trial?: boolean;
  industry?: string;
  job_role?: string;
  main_tasks?: string;
  contacts?: string;
  english_level?: EnglishLevel;
  job_rank?: string;
  avatar_rank?: string | null;
  colleague_name?: string;
  colleague_personality?: string;
  manager_name?: string;
  manager_personality?: string;
  client_name?: string;
  client_personality?: string;
  start_time?: string;
  end_time?: string;
  daily_count?: number;
  colleague_notify_time?: string | null;
  manager_notify_time?: string | null;
  client_notify_time?: string | null;
}
