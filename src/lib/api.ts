import { getAccessToken } from "./authToken";
import { supabase, supabaseReady } from "./supabaseClient.js";
import type {
  AdminDashboardResponse,
  EnglishLevel,
  FieldWorkResponse,
  LeaveKind,
  LeaveResponse,
  PeriodRange,
  PeriodReportResponse,
  ProfileResponse,
  PublicReview,
  Survey,
  TodayResponse,
} from "@/types/api";
import type { WorkdayReport } from "@/types/domain";

const API_BASE_URL = import.meta.env.VITE_API_BASE_URL ?? "";

export class ApiError extends Error {
  status: number;

  constructor(status: number, message: string) {
    super(message);
    this.status = status;
  }
}

// 요청 인증 토큰은 항상 Supabase "라이브 세션"에서 직접 가져온다.
// localStorage 미러(go_access_token)는 이전에 로그인했던 다른 계정의 토큰이 남아 있을 수 있어,
// 그걸 그대로 보내면 다른 사람의 프로필/데이터가 노출된다(계정 간 분리 실패). 미러는 인증에 쓰지 않는다.
async function resolveAccessToken(): Promise<string | null> {
  if (supabaseReady && supabase) {
    const { data } = await supabase.auth.getSession();
    return data.session?.access_token ?? null;
  }
  // Supabase 미설정 환경(로컬 프록시 등)에서만 URL/localStorage 토큰 폴백
  return getAccessToken();
}

async function apiFetch<T>(path: string, options: RequestInit = {}): Promise<T> {
  const token = await resolveAccessToken();

  const res = await fetch(`${API_BASE_URL}${path}`, {
    ...options,
    headers: {
      "Content-Type": "application/json",
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
      ...options.headers,
    },
  });

  if (!res.ok) {
    const body = await res.text().catch(() => "");
    throw new ApiError(res.status, body || res.statusText);
  }

  if (res.status === 204) {
    return undefined as T;
  }

  return (await res.json()) as T;
}

export function getTodayWorkday() {
  return apiFetch<TodayResponse>("/api/workday/today");
}

export function deliverNext(filter?: { role?: "colleague" | "manager" | "client"; kind?: "review" }) {
  return apiFetch<unknown>("/api/workday/deliver-next", {
    method: "POST",
    body: JSON.stringify(filter ?? {}),
  });
}

export function postReply(
  conversationId: string,
  text: string,
  subject?: string,
  hintLevel?: "word" | "sentence" | null,
  hintSentence?: string,
) {
  return apiFetch<unknown>("/api/reply", {
    method: "POST",
    body: JSON.stringify({ conversationId, text, subject, hintLevel, hintSentence }),
  });
}

export function markConversationRead(conversationId: string) {
  return apiFetch<unknown>("/api/reply", {
    method: "POST",
    body: JSON.stringify({ conversationId, markRead: true }),
  });
}

// "마음 편하게 말 걸기" — conversationId 없이 동료에게 먼저 캐주얼하게 말을 건넴
export function sendVent(text: string) {
  return apiFetch<{ conversationId: string; body: string; korean_hint: string }>("/api/reply", {
    method: "POST",
    body: JSON.stringify({ vent: true, text }),
  });
}

// 받은 메시지/이메일 "번역" 버튼 — 한국어 번역 1개(상대 role을 같이 보내 톤을 맞춤)
export function translateText(text: string, role?: string) {
  return apiFetch<{ translation: string }>("/api/reply", {
    method: "POST",
    body: JSON.stringify({ translate: true, text, role }),
  });
}

// 답장 입력창 "오타 교정" 버튼 — 철자만 고침(문법은 그대로 둠, 리포트 교정용으로 남겨둬야 함)
export function fixSpelling(text: string) {
  return apiFetch<{ corrected: string; changed: boolean }>("/api/reply", {
    method: "POST",
    body: JSON.stringify({ fixSpelling: true, text }),
  });
}

// CS 챗봇(우측 하단) — FAQ 자동 응답 / 문의 남기기
export function askSupportBot(text: string) {
  return apiFetch<{ answer: string }>("/api/reply", {
    method: "POST",
    body: JSON.stringify({ support: "ask", text }),
  });
}

export function submitSupportInquiry(text: string) {
  return apiFetch<{ submitted: boolean }>("/api/reply", {
    method: "POST",
    body: JSON.stringify({ support: "inquiry", text }),
  });
}

// 설문조사 응답 제출(별점 + 후기 + 추가 질문 답변) — source로 배너/챗봇 3단계 중 어디서 남긴 건지 구분
export function submitSurveyResponse(
  surveyId: string,
  rating: number,
  review: string,
  source: import("@/types/api").SurveySource = "banner",
  answers: string[] = [],
) {
  return apiFetch<{ submitted: boolean }>("/api/reply", {
    method: "POST",
    body: JSON.stringify({ surveyResponse: true, surveyId, rating, review, source, answers }),
  });
}

// 소개 페이지 하단 "실제 후기" 롤링 노출용 공개 후기 목록
export function getPublicReviews() {
  return apiFetch<{ reviews: PublicReview[] }>("/api/reply", {
    method: "POST",
    body: JSON.stringify({ getPublicReviews: true }),
  });
}

// [관리자] CS 문의 처리 완료 표시
export function adminResolveInquiry(inquiryId: string) {
  return apiFetch<{ resolved: boolean }>("/api/admin/dashboard", {
    method: "POST",
    body: JSON.stringify({ action: "resolve_inquiry", inquiryId }),
  });
}

// [관리자] 설문 내용 저장(초안) / 반영(응답 수집 시작) / 후기 공개 여부 전환
export function adminSaveSurvey(payload: { title: string; description: string; questions: import("@/types/api").SurveyQuestion[] }) {
  return apiFetch<{ survey: Survey }>("/api/admin/dashboard", {
    method: "POST",
    body: JSON.stringify({ action: "survey_save", ...payload }),
  });
}

export function adminPublishSurvey(published: boolean) {
  return apiFetch<{ survey: Survey }>("/api/admin/dashboard", {
    method: "POST",
    body: JSON.stringify({ action: "survey_publish", published }),
  });
}

export function adminSetReviewsPublic(reviewsPublic: boolean) {
  return apiFetch<{ survey: Survey }>("/api/admin/dashboard", {
    method: "POST",
    body: JSON.stringify({ action: "survey_reviews_public", reviewsPublic }),
  });
}

// [관리자] 특정 응답을 소개 페이지 "실제 후기"에 노출할지 개별 선택
// 노출(featured: true) 시에는 반드시 편집 팝업에서 확정한 publicReview(마스킹된 문구)/publicDisplayName(비식별 표기)를 같이 보낸다
export function adminSetResponsePublicDisplay(
  responseId: string,
  payload: { featured: boolean; publicReview?: string; publicDisplayName?: string },
) {
  return apiFetch<unknown>("/api/admin/dashboard", {
    method: "POST",
    body: JSON.stringify({ action: "toggle_response_featured", responseId, ...payload }),
  });
}

export function closeWorkday(workdayId: string) {
  return apiFetch<unknown>("/api/workday/close", {
    method: "POST",
    body: JSON.stringify({ workdayId }),
  });
}

// [개발용 QA 도구] 오늘 workday를 통째로 삭제해서 출근부터 다시 테스트할 수 있게 함
export function devResetToday() {
  return apiFetch<{ reset?: boolean; skipped?: boolean; reason?: string }>("/api/workday/close", {
    method: "POST",
    body: JSON.stringify({ reset: true }),
  });
}

export function devAdvanceToNextDay() {
  return apiFetch<{ advanced?: boolean; movedTo?: string; skipped?: boolean; reason?: string }>("/api/workday/close", {
    method: "POST",
    body: JSON.stringify({ advanceDay: true }),
  });
}

// [개발용 QA 도구] 이 계정의 진행상황(근무 기록·연차·승급 이력·프로필)을 전부 지우고 온보딩부터 다시 시작
export function devResetAccount() {
  return apiFetch<{ reset?: boolean }>("/api/workday/close", {
    method: "POST",
    body: JSON.stringify({ resetAccount: true }),
  });
}

export function goOnFieldWork() {
  return apiFetch<FieldWorkResponse>("/api/workday/field-work", { method: "POST" });
}

export function getAdminDashboard() {
  return apiFetch<AdminDashboardResponse>("/api/admin/dashboard");
}

export function deleteAdminUser(userId: string) {
  return apiFetch<{ deleted: boolean }>(`/api/admin/dashboard?userId=${encodeURIComponent(userId)}`, {
    method: "DELETE",
  });
}

export function getPeriodReport(range: PeriodRange) {
  return apiFetch<PeriodReportResponse>(`/api/workday/report/period?range=${range}`);
}

// 특정 날짜(YYYY-MM-DD)의 일간 리포트 — 이미 저장된 daily_reports를 그대로 조회
export function getDailyReportForDate(date: string) {
  return apiFetch<{ available: boolean; report?: WorkdayReport }>(
    `/api/workday/report/period?view=daily&date=${encodeURIComponent(date)}`,
  );
}

// [개발용 QA 도구] 지난 근무일을 즉석에서 채움. count>1이면 N일치 한 번에(승급 30일 게이트 QA용).
export function devBackfillDay(count = 1) {
  return apiFetch<{ backfilled?: boolean | number; days?: number; workDate?: string; lastDate?: string; skipped?: boolean; reason?: string }>(
    "/api/workday/report/period",
    { method: "POST", body: JSON.stringify({ count }) },
  );
}

// ── 인사평가/승급 ──────────────────────────────────
export interface PromotionStatus {
  eligible: boolean;
  currentRank?: string;
  nextRank?: string;
  workdayCount?: number;
  requiredDays?: number;
  atTop?: boolean;
  inProgress?: boolean;
  reason?: string;
  topPercent?: number | null;
  totalUsers?: number | null;
}
export interface PromotionQuestion {
  id: string;
  prompt: string;
  korean_hint?: string;
}
// 인사평가 피드백 대상(동료/상사/거래처)
export interface PromotionPersona {
  role: "colleague" | "manager" | "client";
  label: string;
  name: string;
}
// 대화 상대별 만족도 + 개선 제안
export interface PersonaFeedback {
  role: string;
  name: string;
  satisfaction: number;
  suggestion: string;
}
export function getPromotionStatus() {
  return apiFetch<PromotionStatus>("/api/profile", {
    method: "POST",
    body: JSON.stringify({ action: "promotion.status" }),
  });
}
export function startPromotion() {
  return apiFetch<PromotionStatus & { personas?: PromotionPersona[]; questions?: PromotionQuestion[] }>("/api/profile", {
    method: "POST",
    body: JSON.stringify({ action: "promotion.start" }),
  });
}
export function submitPromotion(payload: {
  personaFeedback: PersonaFeedback[];
  qna: { prompt: string; answer: string }[];
}) {
  return apiFetch<{ promoted: boolean; fromRank?: string; toRank?: string; atTop?: boolean; reason?: string }>(
    "/api/profile",
    { method: "POST", body: JSON.stringify({ action: "promotion.submit", ...payload }) },
  );
}

// 최근 N일 실제 근무 시간 이력(출퇴근 시각 기반)
export function getWorkHoursHistory(daysBack = 14) {
  return apiFetch<{ days: { date: string; status: import("@/types/attendance").AttendanceStatus; minutes: number }[] }>(
    `/api/workday/report/period?view=hours&days=${daysBack}`,
  );
}

// 출석 캘린더 — 최근 N일 실제 근태 이력(workdays·field_work_events 기반)
export function getAttendanceHistory(daysBack = 119) {
  return apiFetch<{ days: import("@/types/attendance").AttendanceDay[] }>(
    `/api/workday/report/period?view=attendance&days=${daysBack}`,
  );
}

export function postConsent() {
  return apiFetch<unknown>("/api/consent", { method: "POST" });
}

export function postLeave(kind: LeaveKind) {
  return apiFetch<LeaveResponse>("/api/workday/leave", {
    method: "POST",
    body: JSON.stringify({ kind }),
  });
}

// 서버는 { profile: {...} | null } 형태로 응답 — 프론트에는 알맹이만 넘긴다
export async function getProfile(): Promise<ProfileResponse> {
  const res = await apiFetch<{ profile: ProfileResponse | null }>("/api/profile");
  return res.profile ?? {};
}

export async function postProfile(
  payload: Partial<ProfileResponse> & { english_level?: EnglishLevel; persona_reset_roles?: string[] },
): Promise<ProfileResponse> {
  const res = await apiFetch<{ profile: ProfileResponse }>("/api/profile", {
    method: "POST",
    body: JSON.stringify(payload),
  });
  return res.profile;
}

// 회원 탈퇴 — 계정과 모든 데이터(근무 기록·리포트·설정 등)를 서버에서 영구 삭제
export function deleteMyAccount() {
  return apiFetch<{ deleted: boolean }>("/api/profile", {
    method: "POST",
    body: JSON.stringify({ action: "delete-account" }),
  });
}

// 카카오 talk_message 재동의 OAuth가 끝난 뒤, 세션에서 받은 provider token을 서버에 저장
export function connectKakaoNotify(payload: { accessToken: string; refreshToken: string; expiresIn?: number }) {
  return apiFetch<{ profile: ProfileResponse }>("/api/profile", {
    method: "POST",
    body: JSON.stringify({ action: "kakao.connect", ...payload }),
  });
}

export function disconnectKakaoNotify() {
  return apiFetch<{ profile: ProfileResponse }>("/api/profile", {
    method: "POST",
    body: JSON.stringify({ action: "kakao.disconnect" }),
  });
}

export function subscribePushOnServer(subscription: PushSubscriptionJSON) {
  return apiFetch<unknown>("/api/push", {
    method: "POST",
    body: JSON.stringify({ subscription }),
  });
}

// 알림 완전히 끄기 — 서버 push_tokens에서 이 기기의 구독을 실제로 삭제(브라우저 권한 차단과 별개)
export function unsubscribePushOnServer(endpoint: string) {
  return apiFetch<unknown>("/api/push", {
    method: "POST",
    body: JSON.stringify({ unsubscribe: true, endpoint }),
  });
}
