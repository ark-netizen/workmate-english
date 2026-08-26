// POST /api/workday/deliver-next — 체험판 자동진행 / 관리자 시연용: 다음 예약 연락 즉시 발송
import { requireUser } from '../../server/auth.js'
import { admin } from '../../server/db.js'
import { deliverNextForUser } from '../../server/workday.js'
import { withErrors } from '../../server/http.js'

export default withErrors('POST', async (req, res) => {
  const userId = await requireUser(req)

  // 체험판에서는 답장 직후 다음 연락을 바로 이어주는 정상 동선으로 사용한다.
  // 실계정에서는 운영/QA 기능이므로 full 관리자만 허용한다.
  const access = (await admin().from('app_users').select('is_trial, admin_role').eq('id', userId).maybeSingle()).data
  if (!access?.is_trial && access?.admin_role !== 'full') {
    res.status(403).json({ error: 'QA 관리자 권한이 필요합니다' })
    return
  }

  const { role, kind } = req.body || {}
  const result = await deliverNextForUser(userId, { role, kind })
  res.status(200).json(result)
})
