// LLM 출력 스키마 검증 (zod) — 파싱 실패/누락 필드를 서버에서 걸러낸다.
import { z } from 'zod'

const WordHintSchema = z.object({ en: z.string(), ko: z.string() })

export const ScenarioSchema = z.object({
  title_en: z.string(),
  title_ko: z.string(),
  summary_en: z.string(),
  summary_ko: z.string(),
  goal_en: z.string(),
  goal_ko: z.string(),
  stage_en: z.string(),
  stage_ko: z.string(),
  topic_status: z.enum(['active', 'completed', 'switched']).default('active'),
  practice_areas: z.array(z.string()).default([]),
  characters: z
    .array(
      z.object({
        role: z.enum(['colleague', 'manager', 'client']),
        channel: z.enum(['messenger', 'email']),
        name: z.string(),
        title: z.string().optional().default(''),
        register: z.string().optional().default(''),
        goal: z.string().optional().default(''),
        known_info: z.string().optional().default(''),
        unknown_info: z.string().optional().default(''),
        purpose_en: z.string().optional().default(''),
        purpose_ko: z.string().optional().default(''),
      }),
    )
    .length(3),
  // 하루 알림 횟수가 3회를 초과할 때만 요청하는 추가 체크인(같은 사건의 다음 업무 단계) — 없으면 빈 배열
  extra_checkins: z
    .array(
      z.object({
        role: z.enum(['colleague', 'manager', 'client']),
        body_en: z.string(),
        korean_hint: z.string().default(''),
        reply_hints: z.array(z.string()).default([]),
        word_hints: z.array(WordHintSchema).default([]),
      }),
    )
    .optional()
    .default([]),
})

export const MessageSchema = z.object({
  subject: z.string().optional(),
  body: z.string(),
  // korean_hint를 자유 텍스트 하나로 두면 LLM이 종종 "답장에 포함할 내용" 부분을 통째로
  // 빼먹고 요약 한 줄만 준다 — 두 필드로 나눠서 스키마 차원에서 강제한다
  korean_summary: z.string().default(''),
  korean_reply_points: z.array(z.string()).default([]),
  reply_hints: z.array(z.string()).default([]),
  word_hints: z.array(WordHintSchema).default([]),
})

export const ResponseSchema = z.object({
  reaction_type: z.string(),
  subject: z.string().optional(),
  body: z.string(),
  needs_followup: z.boolean().default(false),
  korean_summary: z.string().default(''),
  korean_reply_points: z.array(z.string()).default([]),
  reply_hints: z.array(z.string()).default([]),
  word_hints: z.array(WordHintSchema).default([]),
})

export const DailyReportSchema = z.object({
  workday_summary: z.string(),
  good_expressions: z.array(z.object({ text: z.string(), note: z.string() })).default([]),
  corrections: z
    .array(z.object({ before: z.string(), after: z.string(), note: z.string() }))
    .default([]),
  register_feedback: z
    .array(
      z.object({
        role: z.enum(['colleague', 'manager', 'client']),
        their_quote: z.string(),
        their_quote_ko: z.string(),
        user_quote: z.string(),
        note: z.string(),
      }),
    )
    .default([]),
  recurring_issues: z.array(z.string()).default([]),
  recommended_expressions: z
    .array(z.object({ en: z.string(), ko: z.string(), note: z.string().default('') }))
    .default([]),
  next_day_context: z.string().default(''),
})

export const PeriodReportSchema = z.object({
  headline: z.string(),
  narrative: z.string(),
  strengths: z.array(z.string()).default([]),
  recurring_issues: z.array(z.string()).default([]),
  recommended_focus: z.array(z.string()).default([]),
})

// 벤팅(마음 편하게 말 걸기) 채팅 — 채점/교정 없는 캐주얼 대화이므로 힌트 없이 본문만
export const VentMessageSchema = z.object({
  body: z.string(),
  korean_hint: z.string().default(''),
})

// 받은 메시지/이메일 "번역" 버튼 — 자연스러운 한국어 번역 1개만
export const TranslationSchema = z.object({
  translation: z.string(),
})

// 답장 입력창 "오타 교정" 버튼 — 철자만 고침(문법은 건드리지 않음)
export const SpellingFixSchema = z.object({
  corrected: z.string(),
  changed: z.boolean().default(false),
})

// CS 챗봇(우측 하단) FAQ 자동 응답
export const SupportAnswerSchema = z.object({
  answer: z.string(),
})

// 인사평가 역량평가 문제 3개 — 유저 수준/약점에 맞춘 비즈니스 영어 작문 과제
export const EvaluationQuestionsSchema = z.object({
  questions: z
    .array(
      z.object({
        prompt: z.string(),
        korean_hint: z.string().default(''),
      }),
    )
    .min(1),
})

export const WorkdayMemorySchema = z.object({
  events: z.string().default(''),
  promises: z.string().default(''),
  unfinished: z.string().default(''),
  agreed_terms: z.string().default(''),
  relationship: z.string().default(''),
  frequent_errors: z.array(z.string()).default([]),
  next_events: z.string().default(''),
})
