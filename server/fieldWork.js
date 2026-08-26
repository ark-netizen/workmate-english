// 외근/재알림 전용 로직.
// 기존 workday.js의 "미래 연락 전체 +30분" 동작은 유지하되,
// 사용자가 실제로 보고 있던 현재 연락도 30분 뒤 웹 푸시로 다시 알려준다.
import { admin, unwrap } from './db.js'
import { todayDateKST } from './time.js'
import { sendPushToUser } from './push.js'

const DEFAULT_DELAY_MIN = 30
const CLOSED_STATES = new Set(['OFF_DUTY', 'DONE', 'ON_LEAVE', 'HALF_DAY'])

const routeFor = (channel, conversationId) =>
  channel === 'email' ? `/email/${conversationId}` : `/messenger/${conversationId}`

function roleLabel(role) {
  return role === 'colleague' ? '동료' : role === 'manager' ? '상사' : role === 'hr' ? '인사팀' : '거래처'
}

function preview(text) {
  return String(text || '').replace(/\n+/g, ' ').trim().slice(0, 60)
}

async function currentConversation(sb, workdayId, conversationId) {
  if (conversationId) {
    return unwrap(
      await sb
        .from('conversations')
        .select('id, status, channel, subject, character_id, read_at, scheduled_at')
        .eq('id', conversationId)
        .eq('workday_id', workdayId)
        .maybeSingle(),
    )
  }

  // 앱 안의 "지금 외근 중" 버튼은 예전부터 conversationId 없이 호출해왔다.
  // 현재 열어 본 대화는 markRead()가 read_at을 갱신하므로 가장 최근에 읽은 awaiting 대화를
  // 현재 연락으로 간주한다. 푸시 액션은 아래 API에서 conversationId를 명시적으로 넘긴다.
  return unwrap(
    await sb
      .from('conversations')
      .select('id, status, channel, subject, character_id, read_at, scheduled_at')
      .eq('workday_id', workdayId)
      .eq('status', 'awaiting')
      .order('read_at', { ascending: false, nullsFirst: false })
      .order('scheduled_at', { ascending: false })
      .limit(1)
      .maybeSingle(),
  )
}

async function buildReminderPayload(sb, convo) {
  const [character, originalSchedule, lastCharacterMessage] = await Promise.all([
    sb.from('characters').select('name, role').eq('id', convo.character_id).maybeSingle().then((r) => unwrap(r)),
    sb
      .from('notification_schedules')
      .select('title, preview, route')
      .eq('conversation_id', convo.id)
      .eq('status', 'sent')
      .order('sent_at', { ascending: false })
      .limit(1)
      .maybeSingle()
      .then((r) => unwrap(r)),
    sb
      .from('messages')
      .select('body')
      .eq('conversation_id', convo.id)
      .eq('sender', 'character')
      .order('seq', { ascending: false })
      .limit(1)
      .maybeSingle()
      .then((r) => unwrap(r)),
  ])

  const fallbackTitle =
    convo.channel === 'email'
      ? `새 이메일 — ${convo.subject || character?.name || '거래처'}`
      : `${character?.name || '새 연락'} · ${roleLabel(character?.role)}`

  return {
    title: originalSchedule?.title || fallbackTitle,
    preview: originalSchedule?.preview || preview(lastCharacterMessage?.body),
    route: originalSchedule?.route || routeFor(convo.channel, convo.id),
  }
}

export async function goOnFieldWorkV2(
  userId,
  delayMinutes = DEFAULT_DELAY_MIN,
  source = 'app',
  conversationId = null,
) {
  const sb = admin()
  const workDate = todayDateKST()
  const workday = unwrap(
    await sb
      .from('workdays')
      .select('id, state')
      .eq('user_id', userId)
      .eq('work_date', workDate)
      .maybeSingle(),
  )
  if (!workday) return { skipped: true, reason: 'no-workday' }
  if (CLOSED_STATES.has(workday.state)) return { skipped: true, reason: 'workday-closed' }

  const delayMs = Math.max(1, Number(delayMinutes) || DEFAULT_DELAY_MIN) * 60_000
  const now = Date.now()
  const reminderAt = new Date(now + delayMs).toISOString()
  const convo = await currentConversation(sb, workday.id, conversationId)

  let reminderScheduled = false
  let reminderConversationId = null

  // 이미 도착해서 답장을 기다리는 바로 그 연락을 30분 뒤 다시 알림.
  // 같은 연락에서 외근 버튼을 여러 번 눌러도 알림을 여러 개 쌓지 않고 마지막 클릭 기준으로 미룬다.
  if (convo?.status === 'awaiting') {
    const payload = await buildReminderPayload(sb, convo)
    const existingReminder = unwrap(
      await sb
        .from('notification_schedules')
        .select('id')
        .eq('conversation_id', convo.id)
        .eq('status', 'scheduled')
        .order('scheduled_at', { ascending: false })
        .limit(1)
        .maybeSingle(),
    )

    if (existingReminder) {
      unwrap(
        await sb
          .from('notification_schedules')
          .update({
            scheduled_at: reminderAt,
            title: payload.title,
            preview: payload.preview,
            route: payload.route,
          })
          .eq('id', existingReminder.id),
      )
    } else {
      unwrap(
        await sb.from('notification_schedules').insert({
          workday_id: workday.id,
          conversation_id: convo.id,
          scheduled_at: reminderAt,
          status: 'scheduled',
          title: payload.title,
          preview: payload.preview,
          route: payload.route,
          sent_at: null,
        }),
      )
    }
    reminderScheduled = true
    reminderConversationId = convo.id
  }

  // 외근 중에는 아직 오지 않은 미래 연락도 기존 정책대로 30분씩 뒤로 미룬다.
  const pending = unwrap(
    await sb
      .from('conversations')
      .select('id, scheduled_at')
      .eq('workday_id', workday.id)
      .eq('status', 'scheduled'),
  ) || []

  const rescheduled = []
  for (const pendingConvo of pending) {
    const baseMs = Math.max(now, new Date(pendingConvo.scheduled_at || now).getTime())
    const newScheduledAt = new Date(baseMs + delayMs).toISOString()
    unwrap(await sb.from('conversations').update({ scheduled_at: newScheduledAt }).eq('id', pendingConvo.id))
    unwrap(
      await sb
        .from('notification_schedules')
        .update({ scheduled_at: newScheduledAt })
        .eq('conversation_id', pendingConvo.id)
        .eq('status', 'scheduled'),
    )
    rescheduled.push({ conversationId: pendingConvo.id, newScheduledAt })
  }

  // 미룰 연락 유무와 별개로 외근 클릭 자체는 스트레스/바쁨 신호로 기록한다.
  try {
    await sb.from('field_work_events').insert({ user_id: userId, workday_id: workday.id, source })
  } catch (_) {}

  return {
    fieldWork: true,
    delayMinutes: Math.round(delayMs / 60_000),
    reminderScheduled,
    reminderAt: reminderScheduled ? reminderAt : null,
    reminderConversationId,
    rescheduled,
    reason: !reminderScheduled && !rescheduled.length ? 'nothing-pending' : undefined,
  }
}

// 기존 deliverDueNotifications는 "아직 발송 전인 conversation(status=scheduled)"만 처리한다.
// 외근 재알림은 이미 도착한 conversation(status=awaiting)에 연결된 별도 schedule이므로 여기서 처리한다.
export async function deliverFieldWorkReminders() {
  const sb = admin()
  const due = unwrap(
    await sb
      .from('notification_schedules')
      .select('id, conversation_id, title, preview, route')
      .eq('status', 'scheduled')
      .lte('scheduled_at', new Date().toISOString()),
  ) || []

  let delivered = 0
  let skipped = 0

  for (const schedule of due) {
    if (!schedule.conversation_id) continue
    const convo = unwrap(
      await sb
        .from('conversations')
        .select('id, status, workday_id')
        .eq('id', schedule.conversation_id)
        .maybeSingle(),
    )
    if (!convo) {
      await sb.from('notification_schedules').update({ status: 'skipped' }).eq('id', schedule.id)
      skipped += 1
      continue
    }

    // 정상 최초 연락은 workday.js의 기존 dispatcher가 담당한다.
    if (convo.status === 'scheduled') continue

    // 사용자가 이미 답장해서 완료됐다면 재알림하지 않는다.
    if (convo.status !== 'awaiting') {
      await sb.from('notification_schedules').update({ status: 'skipped' }).eq('id', schedule.id)
      skipped += 1
      continue
    }

    const workday = unwrap(
      await sb.from('workdays').select('user_id, state').eq('id', convo.workday_id).maybeSingle(),
    )
    if (!workday || CLOSED_STATES.has(workday.state)) {
      await sb.from('notification_schedules').update({ status: 'skipped' }).eq('id', schedule.id)
      skipped += 1
      continue
    }

    try {
      await sendPushToUser(workday.user_id, {
        title: schedule.title || '업무 연락 다시 알림',
        body: schedule.preview || '아까 미뤄둔 업무 연락을 다시 확인해보세요.',
        url: schedule.route || '/',
      })
      await sb
        .from('notification_schedules')
        .update({ status: 'sent', sent_at: new Date().toISOString() })
        .eq('id', schedule.id)
      delivered += 1
    } catch (_) {
      await sb.from('notification_schedules').update({ status: 'failed' }).eq('id', schedule.id)
    }
  }

  return { delivered, skipped, checked: due.length }
}
