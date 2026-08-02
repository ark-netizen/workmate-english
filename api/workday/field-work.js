// POST /api/workday/field-work — 외근: 아직 안 보낸 오늘 연락을 뒤로 미룸
import { requireUser } from '../../server/auth.js'
import { goOnFieldWork } from '../../server/workday.js'
import { withErrors } from '../../server/http.js'

export default withErrors('POST', async (req, res) => {
  const userId = await requireUser(req)
  const result = await goOnFieldWork(userId)
  res.status(200).json(result)
})
