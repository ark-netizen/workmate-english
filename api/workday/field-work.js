// POST /api/workday/field-work — 외근: 현재 연락 재알림 + 아직 안 온 연락 30분 연기
import { requireUser } from '../../server/auth.js'
import { goOnFieldWorkV2 } from '../../server/fieldWork.js'
import { withErrors } from '../../server/http.js'

export default withErrors('POST', async (req, res) => {
  const userId = await requireUser(req)
  const conversationId = req.body?.conversationId || null
  const result = await goOnFieldWorkV2(userId, 30, 'app', conversationId)
  res.status(200).json(result)
})
