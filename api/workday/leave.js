// POST /api/workday/leave — 반차/연차/출근취소 (body: { kind: 'annual'|'half_day'|'cancel' })
import { requireUser } from '../../server/auth.js'
import { takeLeave } from '../../server/workday.js'
import { withErrors } from '../../server/http.js'

export default withErrors('POST', async (req, res) => {
  const userId = await requireUser(req)
  const { kind } = req.body || {}
  if (!['annual', 'half_day', 'cancel'].includes(kind)) {
    res.status(400).json({ error: 'kind은 annual | half_day | cancel 중 하나여야 함' })
    return
  }
  const result = await takeLeave(userId, kind)
  res.status(200).json(result)
})
