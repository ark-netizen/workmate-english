// 일일 리포트 2차 교차검증 — 1차 SOLAR 리포트를 원문 대화와 다시 대조해 최종본으로 다듬는다.
// 목적: 문법적으로 맞는 표현을 취향 차이로 교정하거나, 축약형/비축약형을 우열로 평가하거나,
// 실제 업무 맥락과 무관한 암기 표현을 추천하는 문제를 최종 저장 전에 한 번 더 걸러낸다.
import { admin, unwrap } from './db.js'
import { getProfile } from './profile.js'
import { DailyReportSchema } from './llm/schemas.js'

const SOLAR_MODEL = process.env.SOLAR_MODEL || 'solar-pro2'

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
    .replace(/\bI'd\b/gi, 'I would')
    .replace(/\bwe're\b/gi, 'we are')
    .replace(/\bwe'll\b/gi, 'we will')
    .replace(/\bwe've\b/gi, 'we have')
    .replace(/\bwe'd\b/gi, 'we would')
    .replace(/\byou're\b/gi, 'you are')
    .replace(/\byou'll\b/gi, 'you will')
    .replace(/\byou've\b/gi, 'you have')
    .replace(/\byou'd\b/gi, 'you would')
    .replace(/\bthey're\b/gi, 'they are')
    .replace(/\bthey'll\b/gi, 'they will')
    .replace(/\bthey've\b/gi, 'they have')
    .replace(/\bthey'd\b/gi, 'they would')
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
      previousReports.flatMap((item) => item.recurring_issues || []),
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

function sanitizeVerifiedReport(report, conversations) {
  const userText = new Set(
    conversations.flatMap((conversation) =>
      conversation.messages
        .filter((message) => message.sender === 'user')
        .map((message) => normalize(message.body)),
    ),
  )
  const characterText = new Set(
    conversations.flatMap((conversation) =>
      conversation.messages
        .filter((message) => message.sender !== 'user')
        .map((message) => normalize(message.body)),
    ),
  )
  const hintCopiedText = new Set(
    conversations.flatMap((conversation) =>
      conversation.messages
        .filter((message) => message.sender === 'user' && message.isHintCopy)
        .map((message) => normalize(message.body)),
    ),
  )

  const corrections = dedupeBy(
    (report.corrections || []).filter((item) => {
      const before = normalize(item?.before)
      if (!before || !userText.has(before) || hintCopiedText.has(before)) return false
      if (differsOnlyByContraction(item?.before, item?.after)) return false
      return true
    }),
    (item) => `${normalize(item?.before)}→${normalize(item?.after)}`,
  )
  const correctedBefore = new Set(corrections.map((item) => normalize(item.before)))

  const goodExpressions = dedupeBy(
    (report.good_expressions || []).filter((item) => {
      const text = normalize(item?.text)
      return text && userText.has(text) && !correctedBefore.has(text)
    }),
    (item) => normalize(item?.text),
  )

  const registerFeedback = dedupeBy(
    (report.register_feedback || []).filter((item) => {
      return userText.has(normalize(item?.user_quote)) && characterText.has(normalize(item?.their_quote))
    }),
    (item) => String(item?.role || ''),
  )

  return {
    ...report,
    good_expressions: goodExpressions,
    corrections,
    register_feedback: registerFeedback,
    recurring_issues: dedupeBy(report.recurring_issues, (item) => normalize(item)),
    recommended_expressions: dedupeBy(report.recommended_expressions, (item) => normalize(item?.en)),
  }
}

export async function verifyDailyReport({ userId, workdayId, draftReport }) {
  if (!draftReport) return draftReport

  const { profile, scenario, conversations, previousIssues } = await loadSourceMaterial(userId, workdayId)
  if (!profile || profile.is_trial || !conversations.length) return draftReport

  const transcript = buildTranscript(conversations)
  const system = `You are the SECOND-PASS senior editor for a Korean business-English learning service.
A first model already produced a daily report. Treat that draft as UNTRUSTED. Your job is to compare every claim against the original transcript and return a corrected FINAL report in the exact same JSON shape.

Your priority is accuracy and learning value, not preserving the first draft.

NON-NEGOTIABLE RULES:
1. TRANSCRIPT IS THE ONLY SOURCE OF TRUTH. Never invent a user sentence, counterpart sentence, deadline, request, fact, or intent. Quotes in good_expressions/corrections/register_feedback must be exact transcript quotes from the correct speaker.
2. DO NOT GRADE SPELLING/TYPOS/CAPITALIZATION. The app has a separate spelling-fix step before sending. Daily-report corrections must focus on grammar, word choice, prepositions/articles, genuinely unnatural phrasing, and communication quality that still matters after spelling cleanup.
3. CONTRACTIONS ARE NOT A LEARNING ISSUE. "I'll" and "I will", "I'm" and "I am", "I've" and "I have", "don't" and "do not", etc. are both valid. Never correct one into the other, never praise one over the other, never claim the expanded form is inherently more professional, and never create register feedback or recurring issues about contraction vs. non-contraction. Do not recommend memorizing an expanded/contracted version merely because the draft used the other.
4. NO STYLE-PREFERENCE CORRECTIONS. If the user's sentence is grammatical, natural, and appropriate enough for the relationship, keep it as good_expressions even if another wording is also possible. Corrections are for real defects, not teacher taste.
5. MINIMAL, MEANING-PRESERVING FIXES. correction.before must be the exact user sentence. correction.after must change the fewest words needed and preserve the same facts/intent. note must explain the actual diff in Korean.
6. COVERAGE. Every self-written user sentence in the transcript should appear exactly once in either good_expressions or corrections. A line marked [COPIED_SENTENCE_HINT] was supplied by the app: never put it in corrections. It may appear in good_expressions only if useful, and the note must say it was a provided hint rather than praising it as the user's own composition.
7. REGISTER FEEDBACK. Include one entry for each relationship the user actually replied to. their_quote and user_quote must be exact transcript quotes. Evaluate concrete wording and pragmatic fit, but do not manufacture etiquette rules. Contraction choice by itself is never evidence of good/bad register.
8. RECOMMENDED EXPRESSIONS MUST BE CONTEXTUAL. Return 3-5 expressions the learner could realistically reuse in the SAME kind of situation seen today. Prefer corrected sentences from corrections when useful, then expressions directly grounded in today's requests/replies. Reject generic filler, unrelated business phrases, invented commitments, or phrases whose tone does not fit the relevant relationship. Korean meaning must match the English exactly. note must state when/how to use it.
9. RECURRING ISSUES MUST ACTUALLY RECUR. Only call something recurring if (a) it appears at least twice in today's self-written replies, or (b) it clearly matches one of the supplied previous recurring issues. A one-off mistake is not a recurring issue.
10. SUMMARY/NEXT CONTEXT MUST BE FACTUAL. Keep workday_summary and next_day_context grounded in what actually happened. Do not infer completion, promises, or next steps that were never stated.
11. INTERNAL CONSISTENCY. The same sentence cannot be both good and corrected. A register note cannot call something an error unless corrections contains the same sentence and its fix. Recommended expressions must not contradict corrections or the event context.
12. Write all explanations/notes/summaries in Korean. Keep quoted/user-facing English expressions in English.

If the first draft is weak, rewrite it substantially. You are not merely approving/rejecting entries; you are producing the final high-quality report.`

  const user = `Today's event:
${JSON.stringify({ title: scenario?.title || '', summary: scenario?.summary || '', goal: scenario?.goal || '' }, null, 2)}

Learner profile:
${JSON.stringify({ job_role: profile.job_role || '', industry: profile.industry || '', english_level: profile.english_level || '' }, null, 2)}

Previous recurring issues (only these may support cross-day recurrence):
${JSON.stringify(previousIssues, null, 2)}

ORIGINAL TRANSCRIPT:
${transcript}

FIRST-PASS DRAFT TO AUDIT:
${JSON.stringify(draftReport, null, 2)}

Return ONLY valid JSON with this exact shape:
{
  "workday_summary": string,
  "good_expressions": [{ "text": string, "note": string }],
  "corrections": [{ "before": string, "after": string, "after_ko": string, "note": string }],
  "register_feedback": [{ "role": "colleague"|"manager"|"client", "their_quote": string, "their_quote_ko": string, "user_quote": string, "note": string }],
  "recurring_issues": string[],
  "recommended_expressions": [{ "en": string, "ko": string, "note": string }],
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
