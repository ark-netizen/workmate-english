// GET /api/workday/today — 홈/메신저/이메일/리포트 화면용 오늘 스냅샷
// 프로필 없으면 { needsOnboarding: true }만 반환. 있으면 오늘 workday를 (없으면 자동 생성해서) 반환.
import { requireUser } from '../../server/auth.js'
import { getTodaySnapshot } from '../../server/workday.js'
import { withErrors } from '../../server/http.js'

const SPELLING_ISSUE_PATTERN = /(오타|철자|스펠링|맞춤법|typo|spelling|misspell(?:ed|ing)?)/i
const isSpellingIssue = (value) => SPELLING_ISSUE_PATTERN.test(String(value || ''))

function hideSpellingIssues(report) {
  if (!report) return report
  return {
    ...report,
    corrections: (report.corrections || []).filter((item) => !isSpellingIssue(item?.note)),
    recurring_issues: (report.recurring_issues || []).filter((item) => !isSpellingIssue(item)),
  }
}

export default withErrors('GET', async (req, res) => {
  const userId = await requireUser(req)
  const snapshot = await getTodaySnapshot(userId)
  if (snapshot?.report) snapshot.report = hideSpellingIssues(snapshot.report)
  res.status(200).json(snapshot)
})