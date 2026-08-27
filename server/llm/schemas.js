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
  // 세 관계(동료/상사/거래처)가 오늘 똑같이 요청하는 "그 하나의 요청"과 마감.
  // 이 서비스의 핵심은 같은 요청을 세 가지 격식으로 답해보는 것인데, 예전에는 이 요청이 어디에도
  // 필드로 남지 않고 각 캐릭터의 goal 문장 안에만 암묵적으로 있었다. 그래서 역할 메시지를 생성할
  // 때(발송 시점, 시나리오를 DB에서 다시 읽어옴) 같은 요청으로 되돌릴 근거가 없었고, 실제로
  // 거래처만 "자료를 줄 테니 승인해달라"로 방향이 뒤집히고 마감도 달라지는 사고가 났다.
  shared_request_en: z.string().default(''),
  shared_request_ko: z.string().default(''),
  shared_deadline: z.string().default(''),
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
  // after_ko는 고친 문장의 한국어 뜻 — "필수 암기 사항"에 교정문을 넣을 때 뜻을 같이 보여주기 위해
  // 필요하다. 이게 없으면 교정 사유를 그대로 재탕하게 되고, 사용자는 교정 항목에서 이미 읽은 설명을
  // 암기 항목에서 또 읽게 된다.
  corrections: z
    .array(z.object({ before: z.string(), after: z.string(), after_ko: z.string().default(''), note: z.string() }))
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
