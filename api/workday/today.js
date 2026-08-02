// GET /api/workday/today — 홈/메신저/이메일/리포트 화면용 오늘 스냅샷
// 프로필 없으면 { needsOnboarding: true }만 반환. 있으면 오늘 workday를 (없으면 자동 생성해서) 반환.
import { requireUser } from '../../server/auth.js'
import { getTodaySnapshot } from '../../server/workday.js'
import { withErrors } from '../../server/http.js'

export default withErrors('GET', async (req, res) => {
  const userId = await requireUser(req)
  const snapshot = await getTodaySnapshot(userId)
  res.status(200).json(snapshot)
})
