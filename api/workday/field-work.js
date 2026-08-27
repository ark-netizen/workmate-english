// POST /api/workday/field-work — 외근: 현재 연락 재알림 + 아직 안 온 연락 30분 연기
import { requireUser } from '../../server/auth.js'
import { admin, unwrap } from '../../server/db.js'
import { goOnFieldWorkV2 } from '../../server/fieldWork.js'
import { withErrors } from '../../server/http.js'
import { sendPushToUser } from '../../server/push.js'
import { todayDateKST } from '../../server/time.js'

const CLOSED_STATES = new Set(['OFF_DUTY', 'DONE', 'ON_LEAVE', 'HALF_DAY'])

// QA 전용: 실제 30분을 기다리지 않고, 이 사용자에게 이미 예약돼 있는 외근 재알림 중
// 가장 이른 1건만 즉시 Web Push로 보낸다. 정상 스케줄러/외근 로직 자체는 건드리지 않는다.
// awaiting 대화에 연결된 scheduled notification만 고르므로 아직 최초 발송 전인 일반 연락은 대상이 아니다.
async function forceNextFieldWorkReminder(userId) {
  const sb = admin()
  const workday = unwrap(
    await sb
      .from('workdays')
      .select('id, state')
      .eq('user_id', userId)
      .eq('work_date', todayDateKST())
      .maybeSingle(),
  )
  if (!workday) return { sent: false, reason: 'no-workday' }
  if (CLOSED_STATES.has(workday.state)) return { sent: false, reason: 'workday-closed' }

  const awaiting = unwrap(
    await sb
      .from('conversations')
      .select('id')
      .eq('workday_id', workday.id)
      .eq('status', 'awaiting'),
  ) || []
  const conversationIds = awaiting.map((c) => c.id)
  if (!conversationIds.length) return { sent: false, reason: 'no-awaiting-conversation' }

  const reminders = unwrap(
    await sb
      .from('notification_schedules')
      .select('id, conversation_id, title, preview, route, scheduled_at')
      .eq('status', 'scheduled')
      .in('conversation_id', conversationIds)
      .order('scheduled_at', { ascending: true }),
  ) || []

  const reminder = reminders[0]
  if (!reminder) return { sent: false, reason: 'no-field-work-reminder' }

  const push = await sendPushToUser(userId, {
    title: reminder.title || '업무 연락 다시 알림',
    body: reminder.preview || '아까 미뤄둔 업무 연락을 다시 확인해보세요.',
    url: reminder.route || '/',
  })

  // 구독 자체가 없거나 실제 브라우저로 한 건도 전달되지 않았다면 스케줄을 sent로 소비하지 않는다.
  // 그대로 두면 정상 30분 스케줄러가 이후 다시 시도할 수 있다.
  if (!push?.sent) {
    return {
      sent: false,
      reason: push?.total ? 'push-delivery-failed' : 'no-push-subscription',
      remaining: reminders.length,
    }
  }

  unwrap(
    await sb
      .from('notification_schedules')
      .update({ status: 'sent', sent_at: new Date().toISOString() })
      .eq('id', reminder.id),
  )

  return {
    sent: true,
    conversationId: reminder.conversation_id,
    originallyScheduledAt: reminder.scheduled_at,
    remaining: Math.max(0, reminders.length - 1),
  }
}

export default withErrors('POST', async (req, res) => {
  const userId = await requireUser(req)
  const body = req.body || {}

  if (body.qaDeliverReminder) {
    const result = await forceNextFieldWorkReminder(userId)
    res.status(200).json(result)
    return
  }

  const conversationId = body.conversationId || null
  const result = await goOnFieldWorkV2(userId, 30, 'app', conversationId)
  res.status(200).json(result)
})
