// POST /api/consent — 개인정보처리방침 동의 기록 (회원가입 시 1회 호출)
import { requireUser } from '../server/auth.js'
import { recordPrivacyConsent } from '../server/profile.js'
import { withErrors } from '../server/http.js'

export default withErrors('POST', async (req, res) => {
  const userId = await requireUser(req)
  await recordPrivacyConsent(userId)
  res.status(200).json({ ok: true })
})
