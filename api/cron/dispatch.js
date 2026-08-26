// GET /api/cron/dispatch — 예약시간 지난 알림 발송 (Vercel Cron/pg_cron 등에서 주기 호출)
// 보호: Authorization: Bearer <CRON_SECRET>
import { deliverDueNotifications } from '../../server/workday.js'
import { deliverFieldWorkReminders } from '../../server/fieldWork.js'
import { withErrors } from '../../server/http.js'

export default withErrors('GET', async (req, res) => {
  const secret = process.env.CRON_SECRET
  const header = req.headers.authorization || ''
  if (!secret || header !== `Bearer ${secret}`) {
    res.status(401).json({ error: '인증 필요' })
    return
  }

  // 먼저 아직 도착 전인 정상 예약 연락을 발송하고,
  // 그 뒤 이미 도착한 연락에 붙은 "외근 30분 재알림" 스케줄을 별도로 처리한다.
  const scheduled = await deliverDueNotifications()
  const fieldWork = await deliverFieldWorkReminders()
  res.status(200).json({ scheduled, fieldWork })
})
