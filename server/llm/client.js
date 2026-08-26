// LLM 호출 클라이언트 (서버 전용 — service_role / API 키는 여기서만)
// 프로바이더: SOLAR(Upstage) 전용.
//
// 필요 env (Vercel 환경변수 / 로컬 .env.local, 절대 커밋 금지):
//   SOLAR_API_KEY = up_...
//   SOLAR_MODEL   = solar-pro2 (기본)

import {
  buildScenarioPrompt,
  buildRoleMessagePrompt,
  buildRoleResponsePrompt,
  buildDailyReportPrompt,
  buildWorkdayMemoryPrompt,
  buildPeriodReportPrompt,
  buildOjtWelcomePrompt,
  buildVentResponsePrompt,
  buildTranslationPrompt,
  buildSpellingFixPrompt,
  buildSupportAnswerPrompt,
  buildEvaluationQuestionsPrompt,
} from './prompts.js'
import {
  ScenarioSchema,
  MessageSchema,
  ResponseSchema,
  DailyReportSchema,
  WorkdayMemorySchema,
  PeriodReportSchema,
  VentMessageSchema,
  TranslationSchema,
  SpellingFixSchema,
  SupportAnswerSchema,
  EvaluationQuestionsSchema,
} from './schemas.js'

const SOLAR_MODEL = process.env.SOLAR_MODEL || 'solar-pro2'

// SOLAR(Upstage) — OpenAI 호환 Chat Completions
async function callSolar({ system, user }) {
  const res = await fetch('https://api.upstage.ai/v1/solar/chat/completions', {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${process.env.SOLAR_API_KEY}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      model: SOLAR_MODEL,
      messages: [
        { role: 'system', content: system },
        { role: 'user', content: user },
      ],
    }),
  })
  if (!res.ok) throw new Error(`SOLAR API 오류 (${res.status}): ${await res.text()}`)
  const data = await res.json()
  return data.choices[0].message.content
}

async function callLLM({ system, user }) {
  return callSolar({ system, user })
}

// 모델이 돌려준 JSON 텍스트를 안전하게 파싱 (코드펜스 제거 + 첫 { … } 추출)
function parseJson(text) {
  let t = text.trim()
  t = t.replace(/^```(?:json)?\s*/i, '').replace(/```\s*$/i, '').trim()
  try {
    return JSON.parse(t)
  } catch (_) {
    const start = t.indexOf('{')
    const end = t.lastIndexOf('}')
    if (start !== -1 && end !== -1) return JSON.parse(t.slice(start, end + 1))
    throw new Error('LLM 응답 JSON 파싱 실패')
  }
}

// 모델이 가끔 JSON 문자열 안에 실제 줄바꿈 대신 "\n" 두 글자를 그대로 이스케이프해서 돌려줄 때가 있음
// (JSON.parse가 "\\n"을 리터럴 백슬래시+n으로 풀어버린 경우) — 화면에 "\n\n" 글자가 그대로 보이는 원인이라
// 파싱 직후 모든 문자열 필드를 재귀적으로 훑어 실제 줄바꿈으로 되돌린다
function fixEscapedNewlines(value) {
  if (typeof value === 'string') return value.replace(/\\n/g, '\n')
  if (Array.isArray(value)) return value.map(fixEscapedNewlines)
  if (value && typeof value === 'object') {
    const out = {}
    for (const [k, v] of Object.entries(value)) out[k] = fixEscapedNewlines(v)
    return out
  }
  return value
}

// 생성 → 파싱 → zod 검증 (한 번 재시도)
async function generate(build, schema, args) {
  const { system, user } = build(args)
  for (let attempt = 0; attempt < 2; attempt++) {
    try {
      return schema.parse(fixEscapedNewlines(parseJson(await callLLM({ system, user }))))
    } catch (err) {
      if (attempt === 1) throw new Error(`LLM 생성/검증 실패: ${err.message}`)
    }
  }
}

// ── 고수준 생성 함수 (기획서 17장 기능 단위) ─────────
export const generateScenario = (args) => generate(buildScenarioPrompt, ScenarioSchema, args)
export const generateRoleMessage = (args) => generate(buildRoleMessagePrompt, MessageSchema, args)
export const generateRoleResponse = (args) => generate(buildRoleResponsePrompt, ResponseSchema, args)
export const generateDailyReport = (args) => generate(buildDailyReportPrompt, DailyReportSchema, args)
export const generatePeriodReport = (args) => generate(buildPeriodReportPrompt, PeriodReportSchema, args)
export const createWorkdayMemory = (args) => generate(buildWorkdayMemoryPrompt, WorkdayMemorySchema, args)
export const generateOjtWelcomeEmail = (args) => generate(buildOjtWelcomePrompt, MessageSchema, args)

// 로그인 없는 1분 체험은 외부 LLM 상태와 무관하게 항상 같은 흐름으로 재현돼야 한다.
// 실사용자는 기존처럼 SOLAR 응답을 사용하고, 체험판의 고함항아리/선제 위로만 고정 문구로 처리한다.
export const generateVentMessage = (args) => {
  if (args?.profile?.is_trial) {
    return Promise.resolve(
      VentMessageSchema.parse(
        args?.isComfortPing
          ? {
              body: 'Hey, you seem really busy today. You okay? Want to take a second to vent? 😮‍💨',
              korean_hint: '오늘 많이 바빠 보이는데 괜찮냐고, 잠깐 털어놓아도 된다는 뜻이에요.',
            }
          : {
              body: 'I hear you. That sounds exhausting. Want to tell me a little more? 😮‍💨',
              korean_hint: '많이 힘들었겠다고 공감하면서, 조금 더 이야기해도 된다는 뜻이에요.',
            },
      ),
    )
  }
  return generate(buildVentResponsePrompt, VentMessageSchema, args)
}

export const generateTranslation = (args) => generate(buildTranslationPrompt, TranslationSchema, args)
export const generateSpellingFix = (args) => generate(buildSpellingFixPrompt, SpellingFixSchema, args)
export const generateSupportAnswer = (args) => generate(buildSupportAnswerPrompt, SupportAnswerSchema, args)
export const generateEvaluationQuestions = (args) => generate(buildEvaluationQuestionsPrompt, EvaluationQuestionsSchema, args)
