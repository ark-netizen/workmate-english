// 일일 리포트 2차 교차검증 — 1차 SOLAR 리포트를 원문 대화와 다시 대조해 최종본으로 다듬는다.
// 목적: 취향성 교정/축약형 지적/맥락 없는 암기 표현을 제거하고, 다음날 다시 쓸 수 있는 패턴만 남긴다.
import { admin, unwrap } from './db.js'
import { getProfile } from './profile.js'
import { DailyReportSchema } from './llm/schemas.js'

const SOLAR_MODEL = process.env.SOLAR_MODEL || 'solar-pro2'
const NON_LEARNING_ISSUE_PATTERN = /(오타|철자|스펠링|맞춤법|축약|줄임말|typo|spelling|contraction)/i

function parseJson(text) {
  let t = String(text || '').trim()
  t = t.replace(/^```(?:json)?\s*/i, '').replace(/```\s*$/i, '').trim()
  try {
    return JSON.parse(t)
  } catch (_) {
    const start = t.indexOf('{')
    const end = t.lastIndexOf('}')
    if (start !== -1 && end !== -1) return JSON.parse(t.slice(start, end + 1))
    throw new Error('리포트 교차검증 JSON 파싱 실패')
  }
}

function fixEscapedNewlines(value) {
  if (typeof value === 'string') return value.replace(/\\n/g, '\n')
  if (Array.isArray(value)) return value.map(fixEscapedNewlines)
  if (value && typeof value === 'object') {
    const out = {}
    for (const [key, child] of Object.entries(value)) out[key] = fixEscapedNewlines(child)
    return out
  }
  return value
}

async function callVerifier(system, user) {
  const response = await fetch('https://api.upstage.ai/v1/solar/chat/completions', {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${process.env.SOLAR_API_KEY}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      model: SOLAR_MODEL,
      temperature: 0.1,
      messages: [
        { role: 'system', content: system },
        { role: 'user', content: user },
      ],
    }),
  })
  if (!response.ok) throw new Error(`SOLAR 리포트 교차검증 오류 (${response.status}): ${await response.text()}`)
  const data = await response.json()
  return data.choices?.[0]?.message?.content || ''
}

const normalize = (value) =>
  String(value || '')
    .toLowerCase()
    .replace(/[’]/g, "'")
    .replace(/[^a-z0-9가-힣]+/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()

function expandContractions(value) {
  return String(value || '')
    .replace(/[’]/g, "'")
    .replace(/\bI'm\b/gi, 'I am')
    .replace(/\bI'll\b/gi, 'I will')
    .replace(/\bI've\b/gi, 'I have')
    .replace(/\bwe're\b/gi, 'we are')
    .replace(/\bwe'll\b/gi, 'we will')
    .replace(/\bwe've\b/gi, 'we have')
    .replace(/\byou're\b/gi, 'you are')
    .replace(/\byou'll\b/gi, 'you will')
    .replace(/\byou've\b/gi, 'you have')
    .replace(/\bthey're\b/gi, 'they are')
    .replace(/\bthey'll\b/gi, 'they will')
    .replace(/\bthey've\b/gi, 'they have')
    .replace(/\bhe's\b/gi, 'he is')
    .replace(/\bshe's\b/gi, 'she is')
    .replace(/\bit's\b/gi, 'it is')
    .replace(/\bthat's\b/gi, 'that is')
    .replace(/\bthere's\b/gi, 'there is')
    .replace(/\bdon't\b/gi, 'do not')
    .replace(/\bdoesn't\b/gi, 'does not')
    .replace(/\bdidn't\b/gi, 'did not')
    .replace(/\bcan't\b/gi, 'cannot')
    .replace(/\bcouldn't\b/gi, 'could not')
    .replace(/\bwon't\b/gi, 'will not')
    .replace(/\bwouldn't\b/gi, 'would not')
    .replace(/\bshouldn't\b/gi, 'should not')
    .replace(/\bisn't\b/gi, 'is not')
    .replace(/\baren't\b/gi, 'are not')
    .replace(/\bwasn't\b/gi, 'was not')
    .replace(/\bweren't\b/gi, 'were not')
    .replace(/\bhasn't\b/gi, 'has not')
    .replace(/\bhaven't\b/gi, 'have not')
    .replace(/\bhadn't\b/gi, 'had not')
}

function differsOnlyByContraction(before, after) {
  if (!before || !after) return false
  return normalize(expandContractions(before)) === normalize(expandContractions(after))
}

function isClearlyUnevaluable(value) {
  const raw = String(value || '').trim()
  if (!raw) return true
  if (/^[^a-z가-힣0-9]+$/i.test(raw)) return true
  const letters = raw.replace(/[^a-z]/gi, '')
  if (letters.length >= 3 && /^([a-z])\1+$/i.test(letters)) return true
  if (/^(?:asdf|qwer|zxcv|fdsa|hjkl)+$/i.test(letters)) return true
  return false
}

function dedupeBy(items, makeKey) {
  if (!Array.isArray(items)) return []
  const seen = new Set()
  return items.filter((item) => {
    const key = makeKey(item)
    if (!key || seen.has(key)) return false
    seen.add(key)
    return true
  })
}

async function loadSourceMaterial(userId, workdayId) {
  const sb = admin()
  const [profile, workday, scenario, rawConversations] = await Promise.all([
    getProfile(userId),
    sb.from('workdays').select('id, user_id, work_date').eq('id', workdayId).single().then(unwrap),
    sb.from('scenarios').select('*').eq('workday_id', workdayId).single().then(unwrap),
    sb
      .from('conversations')
      .select('id, channel, kind, characters(role, channel), messages(sender, body, seq, hint_level, reply_hints)')
      .eq('workday_id', workdayId)
      .eq('kind', 'scenario')
      .then((r) => unwrap(r) || []),
  ])

  if (!workday || workday.user_id !== userId) throw new Error('리포트 교차검증 권한 없음')

  const conversations = rawConversations
    .filter((conversation) => conversation.messages?.some((message) => message.sender === 'user'))
    .map((conversation) => {
      const sorted = [...(conversation.messages || [])].sort((a, b) => a.seq - b.seq)
      const messages = sorted.map((message, index) => {
        if (message.sender !== 'user') return message
        const previousCharacterMessage = [...sorted.slice(0, index)].reverse().find((item) => item.sender === 'character')
        const suggestedSentence = previousCharacterMessage?.reply_hints?.[0]
        const isHintCopy =
          message.hint_level === 'sentence' &&
          !!suggestedSentence &&
          normalize(message.body) === normalize(suggestedSentence)
        return { ...message, isHintCopy }
      })
      return {
        role: conversation.characters?.role || '',
        channel: conversation.characters?.channel || conversation.channel || '',
        messages,
      }
    })

  const previousWorkdays = unwrap(
    await sb
      .from('workdays')
      .select('id')
      .eq('user_id', userId)
      .lt('work_date', workday.work_date)
      .order('work_date', { ascending: false })
      .limit(5),
  ) || []

  let previousIssues = []
  if (previousWorkdays.length) {
    const previousReports = unwrap(
      await sb.from('daily_reports').select('recurring_issues').in('workday_id', previousWorkdays.map((item) => item.id)),
    ) || []
    previousIssues = dedupeBy(
      previousReports
        .flatMap((item) => item.recurring_issues || [])
        .filter((item) => !NON_LEARNING_ISSUE_PATTERN.test(String(item || ''))),
      (item) => normalize(item),
    ).slice(0, 8)
  }

  return { profile, scenario, conversations, previousIssues }
}

function buildTranscript(conversations) {
  return conversations
    .map((conversation) => {
      const lines = conversation.messages.map((message) => {
        const speaker = message.sender === 'user' ? 'User' : conversation.role
        const marker = message.sender === 'user' && message.isHintCopy ? ' [COPIED_SENTENCE_HINT]' : ''
        return `${speaker}: ${message.body}${marker}`
      })
      return `# ${conversation.role} (${conversation.channel})\n${lines.join('\n')}`
    })
    .join('\n\n')
}

function buildModelReplyHints(conversations) {
  const rows = []
  for (const conversation of conversations) {
    for (const message of conversation.messages || []) {
      if (message.sender === 'user' || !Array.isArray(message.reply_hints)) continue
      for (const hint of message.reply_hints) {
        const text = String(hint || '').trim()
        if (text) rows.push(`${conversation.role}: ${text}`)
      }
    }
  }
  return [...new Set(rows)].slice(0, 12)
}

function sanitizeVerifiedReport(report, conversations) {
  const userBodies = conversations.flatMap((conversation) =>
    conversation.messages.filter((message) => message.sender === 'user').map((message) => message.body),
  )
  const characterBodies = conversations.flatMap((conversation) =>
    conversation.messages.filter((message) => message.sender !== 'user').map((message) => message.body),
  )
  const userCorpus = normalize(userBodies.join(' § '))
  const characterCorpus = normalize(characterBodies.join(' § '))
  const hintCopiedText = new Set(
    conversations.flatMap((conversation) =>
      conversation.messages
        .filter((message) => message.sender === 'user' && message.isHintCopy)
        .map((message) => normalize(message.body)),
    ),
  )
  const isGroundedInUser = (value) => {
    const key = normalize(value)
    return !!key && userCorpus.includes(key)
  }
  const isGroundedInCharacter = (value) => {
    const key = normalize(value)
    return !!key && characterCorpus.includes(key)
  }

  const corrections = dedupeBy(
    (report.corrections || []).filter((item) => {
      const before = normalize(item?.before)
      if (!before || !isGroundedInUser(item?.before) || hintCopiedText.has(before)) return false
      if (isClearlyUnevaluable(item?.before)) return false
      if (differsOnlyByContraction(item?.before, item?.after)) return false
      return true
    }),
    (item) => `${normalize(item?.before)}→${normalize(item?.after)}`,
  )
  const correctedBefore = new Set(corrections.map((item) => normalize(item.before)))

  const goodExpressions = dedupeBy(
    (report.good_expressions || []).filter((item) => {
      const text = normalize(item?.text)
      return text && !isClearlyUnevaluable(item?.text) && isGroundedInUser(item?.text) && !correctedBefore.has(text)
    }),
    (item) => normalize(item?.text),
  )

  const registerFeedback = dedupeBy(
    (report.register_feedback || []).filter((item) => {
      return isGroundedInUser(item?.user_quote) && isGroundedInCharacter(item?.their_quote)
    }),
    (item) => String(item?.role || ''),
  )

  const recommendedExpressions = dedupeBy(
    (report.recommended_expressions || []).filter((item) => item?.en && item?.ko && item?.note),
    (item) => normalize(item?.en),
  ).slice(0, 5)

  const hasEvaluableLanguage = userBodies.some((body) => !isClearlyUnevaluable(body))

  return {
    ...report,
    good_expressions: goodExpressions,
    corrections,
    register_feedback: registerFeedback,
    recurring_issues: hasEvaluableLanguage
      ? dedupeBy(
          (report.recurring_issues || []).filter((item) => !NON_LEARNING_ISSUE_PATTERN.test(String(item || ''))),
          (item) => normalize(item),
        )
      : [],
    recommended_expressions: recommendedExpressions,
  }
}

export async function verifyDailyReport({ userId, workdayId, draftReport }) {
  if (!draftReport) return draftReport

  const { profile, scenario, conversations, previousIssues } = await loadSourceMaterial(userId, workdayId)
  if (!profile || profile.is_trial || !conversations.length) return draftReport

  const transcript = buildTranscript(conversations)
  const modelReplyHints = buildModelReplyHints(conversations)
  const system = `You are the SECOND-PASS senior editor for a Korean business-English learning service.
A first model already produced a daily report. Treat that draft as UNTRUSTED. Compare every claim against the original transcript and return a corrected FINAL report in the exact same JSON shape.

Your priority is accuracy and learning value, not preserving the first draft.

NON-NEGOTIABLE RULES:
1. TRANSCRIPT IS THE ONLY SOURCE OF TRUTH for what actually happened. Never invent a user sentence, counterpart sentence, deadline, request, fact, or intent. Quotes in good_expressions/corrections/register_feedback must be exact transcript quotes from the correct speaker. MODEL REPLY HINTS are a separate learning source only and must never be described as something the user said.
2. DO NOT GRADE SPELLING/TYPOS/CAPITALIZATION. The app has a separate spelling-fix step before sending. Daily-report corrections must focus on grammar, word choice, prepositions/articles, genuinely unnatural phrasing, and communication quality that still matters after spelling cleanup.
3. CONTRACTIONS ARE NOT A LEARNING ISSUE. "I'll" and "I will", "I'm" and "I am", "I've" and "I have", "don't" and "do not", etc. are both valid. Never correct one into the other, praise one over the other, or create register/recurring feedback about contraction choice.
4. NO STYLE-PREFERENCE CORRECTIONS. If the user's sentence is grammatical, natural, and appropriate enough for the relationship, keep it as good_expressions even if another wording is possible.
5. MINIMAL, MEANING-PRESERVING FIXES. correction.before must be the exact user sentence. correction.after must change the fewest words needed and preserve the same facts/intent. If the input has NO recoverable semantic content (e.g. "ffff", "???", keyboard mash), there is no meaning to preserve: DO NOT invent a model answer and call it a correction. Such input is unevaluable language, not a grammar error.
6. COVERAGE applies only to evaluable self-written English. Every evaluable self-written user sentence should appear exactly once in good_expressions or corrections. A line marked [COPIED_SENTENCE_HINT] was supplied by the app and never belongs in corrections. Gibberish/non-semantic input is an explicit exception and belongs in neither list.
7. REGISTER FEEDBACK. Include one entry for each relationship the user actually replied to. their_quote and user_quote must be exact transcript quotes. If a reply is meaningless/too empty to evaluate, say that communication content was insufficient; do NOT derive imaginary grammar errors from it.
8. RECOMMENDED EXPRESSIONS ARE NEXT-DAY TRANSFER PATTERNS. Return 3-5 items every normal workday, even if the learner's own replies were poor, because MODEL REPLY HINTS and today's ideal reply still provide learning material.
   - en MUST be a reusable sentence TEMPLATE with square-bracket slots, e.g. "I'll [verb] [deliverable] by [time]." It must NOT be merely one fixed sentence with today's nouns.
   - ko MUST translate that reusable template, keeping the replaceable parts visibly replaceable.
   - note MUST contain a concrete "오늘 예문: ..." grounded in today's corrected answer/model reply hint/context, followed by a concise Korean explanation of when to reuse the pattern.
   - Source priority: verified correction.after > MODEL REPLY HINTS > a structure directly useful for answering today's request. Never add an unrelated generic textbook phrase just to reach 3-5.
   - Prefer OUTGOING reply patterns the learner can actually recall tomorrow: deadline commitments, status updates, confirmations, priority lists, clarification requests, acknowledgements.
   - Make the patterns meaningfully different. Never create two whose only difference is contraction vs. non-contraction.
9. RECURRING ISSUES MUST ACTUALLY RECUR. Only call something recurring if (a) it appears at least twice in today's evaluable self-written replies, or (b) it clearly matches one supplied previous recurring issue. Never infer capitalization/punctuation/grammar patterns from gibberish.
10. SUMMARY/NEXT CONTEXT MUST BE FACTUAL. Keep workday_summary and next_day_context grounded in what actually happened. Do not infer completion, promises, or next steps that were never stated.
11. INTERNAL CONSISTENCY. The same sentence cannot be both good and corrected. A register note cannot call something an error unless corrections contains the same sentence and its fix. Recommended patterns must not contradict corrections or the event context.
12. Write all explanations/notes/summaries in Korean. Keep quoted/user-facing English expressions in English.

If the first draft is weak, rewrite it substantially. You are producing the final high-quality report, not merely approving entries.`

  const user = `Today's event:
${JSON.stringify({ title: scenario?.title || '', summary: scenario?.summary || '', goal: scenario?.goal || '' }, null, 2)}

Learner profile:
${JSON.stringify({ job_role: profile.job_role || '', industry: profile.industry || '', english_level: profile.english_level || '' }, null, 2)}

Previous recurring issues (only these may support cross-day recurrence):
${JSON.stringify(previousIssues, null, 2)}

ORIGINAL TRANSCRIPT:
${transcript}

MODEL REPLY HINTS FROM TODAY (learning-source only; never attribute these to the user):
${modelReplyHints.length ? modelReplyHints.map((item) => `- ${item}`).join('\n') : '- none available'}

FIRST-PASS DRAFT TO AUDIT:
${JSON.stringify(draftReport, null, 2)}

Return ONLY valid JSON with this exact shape:
{
  "workday_summary": string,
  "good_expressions": [{ "text": string, "note": string }],
  "corrections": [{ "before": string, "after": string, "after_ko": string, "note": string }],
  "register_feedback": [{ "role": "colleague"|"manager"|"client", "their_quote": string, "their_quote_ko": string, "user_quote": string, "note": string }],
  "recurring_issues": string[],
  "recommended_expressions": [{ "en": string (reusable template with [slots]), "ko": string (Korean template), "note": string (must include today's concrete example + usage) }],
  "next_day_context": string
}`

  try {
    const verified = DailyReportSchema.parse(fixEscapedNewlines(parseJson(await callVerifier(system, user))))
    return sanitizeVerifiedReport(verified, conversations)
  } catch (error) {
    // 2차 검증 실패가 퇴근 자체를 막으면 안 된다. 실패 시 1차 리포트를 유지하고 서버 로그만 남긴다.
    console.error('[daily-report] 2차 교차검증 실패, 1차 리포트 유지:', error?.message || error)
    return draftReport
  }
}
