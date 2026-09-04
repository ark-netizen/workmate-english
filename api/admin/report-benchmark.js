import { admin, unwrap } from '../../server/db.js'
import { getProfile } from '../../server/profile.js'
import { generateDailyReport } from '../../server/llm/client.js'
import { verifyDailyReport } from '../../server/dailyReportVerifier.js'
import { withErrors } from '../../server/http.js'

// One-time production benchmark. Protected by an ephemeral Supabase secret that the
// deployment workflow sets for the benchmark run and immediately unsets afterwards.
// It returns timings/counts only — never transcript/report contents or credentials.
const TARGET_EMAIL_SHA256 = '4877a2a86dd867d857fbb20a800a7b4bc612f57b6ee7bb44206f4994dc859c85'

async function sha256(value) {
  const bytes = new TextEncoder().encode(String(value || '').trim().toLowerCase())
  const digest = await crypto.subtle.digest('SHA-256', bytes)
  return Array.from(new Uint8Array(digest)).map((b) => b.toString(16).padStart(2, '0')).join('')
}

async function findTargetUser(sb) {
  const users = unwrap(await sb.from('app_users').select('id, email, is_trial')) || []
  for (const user of users) {
    if (!user?.email || user.is_trial) continue
    if ((await sha256(user.email)) === TARGET_EMAIL_SHA256) return user
  }
  return null
}

function normalize(value) {
  return String(value || '').trim().toLowerCase()
}

async function loadBenchmarkInput(sb, userId, workdayId, workDate) {
  const [scenario, rawConversations, profile] = await Promise.all([
    sb.from('scenarios').select('*').eq('workday_id', workdayId).single().then(unwrap),
    sb
      .from('conversations')
      .select('*, characters(role, channel), messages(sender, body, seq, hint_level, reply_hints)')
      .eq('workday_id', workdayId)
      .eq('kind', 'scenario')
      .then((r) => unwrap(r) || []),
    getProfile(userId),
  ])

  const conversations = rawConversations
    .filter((c) => c.messages?.some((m) => m.sender === 'user'))
    .map((c) => {
      const sorted = [...(c.messages || [])].sort((a, b) => a.seq - b.seq)
      const messages = sorted.map((m, i) => {
        if (m.sender !== 'user') return m
        const prevCharacterMsg = [...sorted.slice(0, i)].reverse().find((p) => p.sender === 'character')
        const suggestedSentence = prevCharacterMsg?.reply_hints?.[0]
        const isHintCopy = m.hint_level === 'sentence' && !!suggestedSentence && normalize(m.body) === normalize(suggestedSentence)
        return { ...m, isHintCopy }
      })
      return { role: c.characters?.role || '', channel: c.characters?.channel || c.channel || '', messages }
    })

  const previousWorkdays = unwrap(
    await sb
      .from('workdays')
      .select('id')
      .eq('user_id', userId)
      .lt('work_date', workDate)
      .order('work_date', { ascending: false })
      .limit(5),
  ) || []

  let previousIssues = []
  if (previousWorkdays.length) {
    const rows = unwrap(
      await sb.from('daily_reports').select('recurring_issues').in('workday_id', previousWorkdays.map((w) => w.id)),
    ) || []
    previousIssues = rows.flatMap((row) => row.recurring_issues || []).slice(0, 8)
  }

  return { scenario, conversations, profile, previousIssues }
}

export default withErrors('POST', async (req, res) => {
  const expected = Deno.env.get('REPORT_BENCHMARK_TOKEN') || ''
  const supplied = String(req.headers?.['x-benchmark-token'] || '')
  if (!expected || supplied !== expected) {
    res.status(404).json({ error: 'Not Found' })
    return
  }

  const sb = admin()
  const target = await findTargetUser(sb)
  if (!target) {
    res.status(404).json({ error: 'benchmark target not found' })
    return
  }

  const workday = unwrap(
    await sb
      .from('workdays')
      .select('id, work_date, state')
      .eq('user_id', target.id)
      .order('work_date', { ascending: false })
      .limit(1)
      .maybeSingle(),
  )
  if (!workday) {
    res.status(404).json({ error: 'benchmark workday not found' })
    return
  }

  const input = await loadBenchmarkInput(sb, target.id, workday.id, workday.work_date)
  if (!input.conversations.length) {
    res.status(409).json({ error: 'benchmark workday has no user replies' })
    return
  }

  const firstStart = performance.now()
  const draft = await generateDailyReport(input)
  const firstPassMs = Math.round(performance.now() - firstStart)

  const secondStart = performance.now()
  const verified = await verifyDailyReport({ userId: target.id, workdayId: workday.id, draftReport: draft })
  const secondPassMs = Math.round(performance.now() - secondStart)

  res.status(200).json({
    ok: true,
    firstPassMs,
    secondPassMs,
    totalTwoPassMs: firstPassMs + secondPassMs,
    slowdownRatio: Number(((firstPassMs + secondPassMs) / Math.max(firstPassMs, 1)).toFixed(2)),
    addedPercent: Math.round((secondPassMs / Math.max(firstPassMs, 1)) * 100),
    conversationCount: input.conversations.length,
    userMessageCount: input.conversations.reduce((sum, c) => sum + c.messages.filter((m) => m.sender === 'user').length, 0),
    draftCounts: {
      good: draft.good_expressions?.length || 0,
      corrections: draft.corrections?.length || 0,
      recommended: draft.recommended_expressions?.length || 0,
    },
    verifiedCounts: {
      good: verified.good_expressions?.length || 0,
      corrections: verified.corrections?.length || 0,
      recommended: verified.recommended_expressions?.length || 0,
    },
  })
})