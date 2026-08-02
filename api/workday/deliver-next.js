// POST /api/workday/deliver-next — 시연: 다음 예약 연락 즉시 발송
import { requireUser } from '../../server/auth.js'
import { deliverNextForUser } from '../../server/workday.js'
import { withErrors } from '../../server/http.js'

export default withErrors('POST', async (req, res) => {
  const userId = await requireUser(req)
  const result = await deliverNextForUser(userId)
  res.status(200).json(result)
})
