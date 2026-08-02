// GET /api/cron/dispatch — 예약시간 지난 알림 발송 (Vercel Cron 등에서 주기 호출)
// 보호: Authorization: Bearer <CRON_SECRET>
import { deliverDueNotifications } from '../../server/workday.js'
import { withErrors } from '../../server/http.js'

export default withErrors('GET', async (req, res) => {
  const secret = process.env.CRON_SECRET
  const header = req.headers.authorization || ''
  if (!secret || header !== `Bearer ${secret}`) {
    res.status(401).json({ error: '인증 필요' })
    return
  }
  const result = await deliverDueNotifications()
  res.status(200).json(result)
})
