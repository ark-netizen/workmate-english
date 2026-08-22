// 힌트 난이도(word/sentence) 기반 당일+익일 복습 — server/workday.js의 submitReply/startWorkday에서 호출된다.
// 정책: 한국어 힌트까지만=정상(복습 대상 아님), 단어까지=Tier1("영작해보기" 2회), 문장까지=Tier2("빈칸채우기"→"영작해보기")
import { admin, unwrap } from './db.js'
import { todayAt } from './time.js'

const preview = (t) => (t || '').replace(/\n+/g, ' ').trim().slice(0, 60)
const routeFor = (channel, conversationId) =>
  channel === 'email' ? `/email/${conversationId}` : `/messenger/${conversationId}`

// 정답 문장에서 가장 긴(=핵심 표현일 가능성이 높은) 단어 하나를 빈칸 처리
function blankOutKeyWord(sentence) {
  const words = sentence.split(/\s+/)
  let idx = 0
  let bestLen = 0
  words.forEach((w, i) => {
    const clean = w.replace(/[^a-zA-Z']/g, '')
    if (clean.length > bestLen) {
      bestLen = clean.length
      idx = i
    }
  })
  const clean = words[idx].replace(/[^a-zA-Z']/g, '')
  if (clean) words[idx] = words[idx].replace(clean, '_'.repeat(clean.length))
  return words.join(' ')
}

async function createReviewConversation(sb, { workdayId, character, body }) {
  const scheduledAtIso = new Date().toISOString()
  const convo = unwrap(
    await sb.from('conversations').insert({
      workday_id: workdayId,
      character_id: character.id,
      channel: character.channel,
      kind: 'review',
      status: 'scheduled',
      scheduled_at: scheduledAtIso,
    }).select().single(),
  )
  unwrap(await sb.from('messages').insert({ conversation_id: convo.id, sender: 'character', body, seq: 1 }))
  unwrap(
    await sb.from('notification_schedules').insert({
      workday_id: workdayId,
      conversation_id: convo.id,
      scheduled_at: scheduledAtIso,
      status: 'scheduled',
      title: `${character.name} · 복습`,
      route: routeFor(character.channel, convo.id),
    }),
  )
  return convo
}

// submitReply에서 hint_level이 word/sentence일 때 호출 — 당일 복습을 스케줄링하고 review_items에 기록한다
export async function scheduleSameDayReview({ userId, workday, profile, character, hintLevel, originalMessage, answerSentence }) {
  const sb = admin()

  // 하루 중 여러 건이 어려워도 당일 복습 큐는 최대 1건만
  const already = unwrap(
    await sb.from('review_items').select('id').eq('workday_id', workday.id).not('same_day_conversation_id', 'is', null),
  ) || []

  const format = hintLevel === 'sentence' ? 'fill_blank' : 'write'
  let sameDayConversationId = null
  let sameDayFormat = null

  if (already.length === 0) {
    const now = Date.now()
    const deadline = todayAt(profile.end_time).getTime() - 30 * 60000
    // 오늘 실제 업무 연락(동료/상사/거래처, 체크인 포함)이 아직 남아있으면 복습이 그것보다 먼저 오면 안 되므로,
    // 그중 가장 늦은 예정 시각 이후로 잡는다 — 그래야 "다 오고 나서 복습" 순서가 지켜짐
    const realConvos = unwrap(
      await sb.from('conversations').select('scheduled_at').eq('workday_id', workday.id).in('kind', ['scenario', 'checkin']),
    ) || []
    const latestRealScheduledAt = realConvos.reduce((max, c) => {
      const t = c.scheduled_at ? new Date(c.scheduled_at).getTime() : 0
      return Math.max(max, t)
    }, 0)
    const minGapFromNow = now + 2 * 60 * 60000
    const afterRealContacts = latestRealScheduledAt ? latestRealScheduledAt + 10 * 60000 : 0
    const earliestAllowed = Math.max(minGapFromNow, afterRealContacts)
    let scheduledAt = null
    if (earliestAllowed < deadline) scheduledAt = earliestAllowed
    // now >= deadline이면 당일 생략(scheduledAt은 null, 익일 복습만 진행)

    if (scheduledAt) {
      // 저장 과정에서 실제 줄바꿈이 리터럴 "\n" 2글자로 남아있는 경우가 있어(더블 이스케이프),
      // 화면에 백슬래시-n이 그대로 찍히지 않도록 표시 직전에 실제 줄바꿈으로 정규화한다
      const cleanOriginalMessage = String(originalMessage || '').replace(/\\n/g, '\n')
      const body =
        format === 'fill_blank'
          ? `Quick review — fill in the blank:\n${blankOutKeyWord(answerSentence)}`
          : `Quick review — try replying to this again from scratch:\n"${cleanOriginalMessage}"`
      // 스케줄된 시각은 지금 당장이 아니라 미래이므로, 대화 자체는 미리 만들어두되(메시지도 함께)
      // scheduled_at을 미래로 박아서 기존 "예정 대화 따라잡기" 로직이 그때 자연스럽게 노출하게 한다
      const convo = await createReviewConversation(sb, { workdayId: workday.id, character, body })
      unwrap(await sb.from('conversations').update({ scheduled_at: new Date(scheduledAt).toISOString() }).eq('id', convo.id))
      unwrap(
        await sb.from('notification_schedules').update({ scheduled_at: new Date(scheduledAt).toISOString() }).eq('conversation_id', convo.id),
      )
      sameDayConversationId = convo.id
      sameDayFormat = format
    }
  }

  unwrap(
    await sb.from('review_items').insert({
      user_id: userId,
      workday_id: workday.id,
      contact_role: character.role,
      contact_name: character.name,
      hint_level: hintLevel,
      original_message: originalMessage,
      answer_sentence: answerSentence,
      same_day_format: sameDayFormat,
      same_day_conversation_id: sameDayConversationId,
    }),
  )
}

// startWorkday(비체험, 새 시나리오 생성 시)에서 호출 — 아직 익일 복습이 안 붙은 것 중 가장 오래된 1건을 오늘로 배정
export async function scheduleNextDayReview({ userId, workday }) {
  const sb = admin()
  const pending = unwrap(
    await sb
      .from('review_items')
      .select('*')
      .eq('user_id', userId)
      .is('next_day_conversation_id', null)
      .order('created_at', { ascending: true })
      .limit(1),
  ) || []
  const item = pending[0]
  if (!item) return

  const scenario = unwrap(await sb.from('scenarios').select('id').eq('workday_id', workday.id).maybeSingle())
  if (!scenario) return
  const character = unwrap(
    await sb.from('characters').select('*').eq('scenario_id', scenario.id).eq('role', item.contact_role).maybeSingle(),
  )
  // 오늘 시나리오에 같은 역할 캐릭터가 없으면(드묾) 스킵 — 다음 기회에 재시도
  if (!character) return

  const cleanOriginalMessage = String(item.original_message || '').replace(/\\n/g, '\n')
  const body = `Quick review from yesterday — try replying to this again:\n"${cleanOriginalMessage}"`
  const convo = await createReviewConversation(sb, { workdayId: workday.id, character, body })
  unwrap(await sb.from('review_items').update({ next_day_conversation_id: convo.id }).eq('id', item.id))
}

// submitReply에서 convo.kind === 'review'일 때 호출 — 정답 여부와 무관하게 제출하면 완료 처리
export async function submitReviewAnswer(convo, userText) {
  const sb = admin()
  const history = unwrap(await sb.from('messages').select('*').eq('conversation_id', convo.id).order('seq')) || []
  const nextSeq = (history[history.length - 1]?.seq || 0) + 1
  unwrap(
    await sb.from('messages').insert({ conversation_id: convo.id, sender: 'user', body: userText, seq: nextSeq }),
  )
  unwrap(await sb.from('conversations').update({ status: 'done' }).eq('id', convo.id))

  const bySameDay = unwrap(
    await sb.from('review_items').select('id').eq('same_day_conversation_id', convo.id).maybeSingle(),
  )
  if (bySameDay) {
    unwrap(await sb.from('review_items').update({ same_day_done_at: new Date().toISOString() }).eq('id', bySameDay.id))
  } else {
    const byNextDay = unwrap(
      await sb.from('review_items').select('id').eq('next_day_conversation_id', convo.id).maybeSingle(),
    )
    if (byNextDay) {
      unwrap(await sb.from('review_items').update({ next_day_done_at: new Date().toISOString() }).eq('id', byNextDay.id))
    }
  }

  return { reviewDone: true, conversationId: convo.id }
}

// 홈 화면 배너용 — 아직 next_day 복습이 오늘자로 배정 안 된 것이 있는지(대기 중) 여부만 알려줌.
// 실제 대화 생성은 scheduleNextDayReview가 startWorkday 시점에 처리한다.
export async function getPendingReviewBanner(userId, workday) {
  const sb = admin()
  const item = unwrap(
    await sb.from('review_items').select('*').eq('user_id', userId).not('next_day_conversation_id', 'is', null).is('next_day_done_at', null).order('created_at', { ascending: false }).limit(1).maybeSingle(),
  )
  if (!item || !item.next_day_conversation_id) return null
  const convo = unwrap(
    await sb.from('conversations').select('id, workday_id, channel, characters(name)').eq('id', item.next_day_conversation_id).maybeSingle(),
  )
  if (!convo || convo.workday_id !== workday.id) return null
  return {
    conversationId: convo.id,
    // item.contact_name은 만들어질 때의 스냅샷이라, 그 사이 이름을 바꾸면 옛날 이름이 그대로 남아있음 —
    // 실제 대화 상대의 현재 이름을 그때그때 조인해서 써야 배너가 항상 최신 이름을 보여줌
    contactName: convo.characters?.name || item.contact_name,
    url: routeFor(convo.channel, convo.id),
  }
}
