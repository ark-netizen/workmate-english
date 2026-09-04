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

// 후속 회신은 모델이 자연스러움을 만들다가 새 프로젝트/새 부탁을 즉흥적으로 꺼내는 게 가장 위험하다.
// 기존 prompt가 character.register를 system 영역에 넣으므로, 그 자리에 당일 사건/역할 범위를 함께 고정해
// 동료·상사·거래처가 각자 자기 대화와 같은 사건 밖으로 튀지 않게 한다.
function withRoleContinuityGuard(args) {
  const scenario = args?.scenario || {}
  const character = args?.character || {}
  const continuity = [
    'STRICT CONTINUITY GUARD:',
    `Stay on TODAY'S SAME work event only${scenario.title ? `: "${scenario.title}"` : ''}.`,
    scenario.summary ? `Event facts: ${scenario.summary}` : '',
    character.goal ? `Your role-specific goal: ${character.goal}` : '',
    character.known_info ? `Facts you already know: ${character.known_info}` : '',
    character.unknown_info ? `Facts you do not yet know: ${character.unknown_info}` : '',
    'Do NOT introduce a different project, deliverable, deadline, client, meeting, or unrelated task unless the USER explicitly changes the subject.',
    'Do NOT contradict project names, dates, quantities, deadlines, or commitments already present in the event or this conversation history.',
    'Do NOT claim knowledge of another role\'s private conversation. React only as this character to the shared event facts and this thread.',
    'If the user answered the ask, acknowledge it and close naturally; do not invent a new ask just to continue talking.',
  ].filter(Boolean).join('\n')

  return {
    ...args,
    character: {
      ...character,
      register: [character.register, continuity].filter(Boolean).join('\n'),
    },
  }
}

// 리포트의 "필수 암기"는 특정 문장을 통째로 외우게 하지 않고, 다음 업무에도 바꿔 쓸 수 있는
// 문장 틀로 만든다. 실제 답장 힌트도 함께 주면 사용자가 답을 망쳤거나 힌트를 보지 않았던 날에도
// 그날 상황에서 원래 쓸 수 있었던 모범답안을 학습 재료로 삼을 수 있다.
function collectModelReplyHints(conversations) {
  const rows = []
  for (const conversation of conversations || []) {
    for (const message of conversation?.messages || []) {
      if (message?.sender === 'user' || !Array.isArray(message?.reply_hints)) continue
      for (const hint of message.reply_hints) {
        const text = String(hint || '').trim()
        if (text) rows.push(`${conversation.role}: ${text}`)
      }
    }
  }
  return [...new Set(rows)].slice(0, 12)
}

function buildDailyReportWithTransferPatterns(args) {
  const built = buildDailyReportPrompt(args)
  const hints = collectModelReplyHints(args?.conversations)
  const extraSources = hints.length
    ? `\n\nMODEL REPLY HINTS FROM TODAY (learning-source only; these are NOT user quotes and must never be attributed to the user):\n${hints.map((item) => `- ${item}`).join('\n')}`
    : ''

  const transferRule = `\n\nTRANSFER-PATTERN OVERRIDE FOR recommended_expressions (this rule takes priority over any earlier wording about that field):
- Return 3-5 items every normal workday. This section is not limited to sentences the learner successfully wrote: when their own reply is weak, use today's model reply hints and the ideal way to answer today's request as learning material.
- recommended_expressions[].en MUST be a REUSABLE SENTENCE PATTERN with replaceable square-bracket slots, not a one-off sentence to memorize verbatim. Example: "I'll [verb] [deliverable] by [time]." or "Could you please confirm [detail]?".
- recommended_expressions[].ko MUST translate the PATTERN, keeping the replaceable parts visibly replaceable in Korean too.
- recommended_expressions[].note MUST contain two things in concise Korean: (1) one concrete "오늘 예문: ..." that fits today's actual situation/model answer, and (2) when to reuse this pattern. The concrete example may contain today's nouns/deadline, but the en field itself must stay reusable.
- Source priority: a verified correction.after that teaches a reusable structure > today's model reply hint > a useful structure from today's counterpart/request that can be adapted into the learner's reply. Never invent an unrelated textbook phrase merely to fill the list.
- Prefer patterns the learner can actually use in an OUTGOING reply tomorrow: committing to a deadline, giving status, confirming details, listing priorities, asking for clarification, acknowledging a request, etc.
- Do not create separate patterns whose only difference is contraction vs. non-contraction (I'll/I will, I'm/I am, etc.).
- Make the 3-5 patterns meaningfully different from each other and useful for transfer to a similar-but-not-identical task tomorrow.`

  return {
    ...built,
    system: `${built.system}${transferRule}`,
    user: `${built.user}${extraSources}`,
  }
}

// 전날 리포트에서 확정된 패턴을 다음날 실제 업무 상황 안에서 다시 꺼내 쓰게 한다.
// "같은 문장 받아쓰기"가 아니라 명사/마감/대상을 바꾼 전이 연습이어야 하므로 시나리오 단계에서
// 요청 자체를 그렇게 설계하고, 정답 문장을 먼저 노출하지 않는다.
function buildScenarioWithPatternTransfer(args) {
  const built = buildScenarioPrompt(args)
  const patterns = Array.isArray(args?.previousMemory?.practice_patterns)
    ? args.previousMemory.practice_patterns.filter((item) => item?.pattern).slice(0, 5)
    : []
  if (!patterns.length) return built

  const transferRule = `\n\nNEXT-DAY TRANSFER PRACTICE (important):
Yesterday's verified report saved reusable sentence patterns for active recall today. Design TODAY'S one shared work request so the learner gets a natural chance to use 1-2 of those patterns in their reply.
- Do NOT repeat yesterday's exact sentence or exact nouns/numbers. Change the deliverable, detail, quantity, deadline, or stage so the learner must transfer the structure to new content.
- Prefer a pattern that fits a normal reply to the shared request. If one saved pattern does not fit the continuing business event naturally, choose another saved pattern instead of distorting the scenario.
- Do NOT reveal or quote the target pattern in the incoming request itself. The learner should have to recall it. A reply hint may still help later if they choose to open hints.
- Keep all existing continuity and same-request-across-three-relationships rules. Learning practice must stay invisible inside a believable workday, not turn into a quiz.`

  return {
    ...built,
    system: `${built.system}${transferRule}`,
    user: `${built.user}\n\nYesterday's reusable patterns available for transfer practice:\n${JSON.stringify(patterns, null, 2)}`,
  }
}

// 사용자 메시지는 LLM 호출보다 먼저 DB에 저장된다. 그래서 Solar가 순간적으로 실패했을 때 예외를 그대로
// 던지면 "내 답장은 저장됐는데 상대는 답을 안 하고 대화 상태만 replied"로 굳을 수 있다.
// 후속 회신에 한해서는 역할별 짧은 안전 응답으로 닫아 대화/리포트 데이터가 끊기지 않게 한다.
function fallbackRoleResponse(args) {
  const character = args?.character || {}
  const role = character.role
  const name = character.name || (role === 'client' ? 'Business Partner' : 'Teammate')

  if (role === 'client' || character.channel === 'email') {
    const userName = args?.profile?.display_name
    const greeting = userName ? `Dear ${userName},` : 'Hello,'
    return ResponseSchema.parse({
      reaction_type: 'close',
      subject: args?.scenario?.title ? `Re: ${args.scenario.title}` : 'Re: Update',
      body: `${greeting}\n\nThank you for the update. We appreciate your confirmation and will proceed based on the information provided.\n\nBest regards,\n${name}`,
      needs_followup: false,
      korean_summary: '',
      korean_reply_points: [],
      reply_hints: [],
      word_hints: [],
    })
  }

  const body =
    role === 'manager'
      ? "Thanks for confirming. I'll proceed based on that. We can follow up tomorrow if anything else comes up."
      : "Got it, thanks! I'll keep an eye on it. We can pick it up tomorrow if anything else comes up."

  return ResponseSchema.parse({
    reaction_type: 'close',
    body,
    needs_followup: false,
    korean_summary: '',
    korean_reply_points: [],
    reply_hints: [],
    word_hints: [],
  })
}

// ── 고수준 생성 함수 (기획서 17장 기능 단위) ─────────
export const generateScenario = (args) => generate(buildScenarioWithPatternTransfer, ScenarioSchema, args)
export const generateRoleMessage = (args) => generate(buildRoleMessagePrompt, MessageSchema, args)
export const generateRoleResponse = async (args) => {
  try {
    return await generate(buildRoleResponsePrompt, ResponseSchema, withRoleContinuityGuard(args))
  } catch (err) {
    console.error('[llm] role response fallback:', err?.message || err)
    return fallbackRoleResponse(args)
  }
}
export const generateDailyReport = (args) => generate(buildDailyReportWithTransferPatterns, DailyReportSchema, args)
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
