// GET /api/workday/today — 홈/메신저/이메일/리포트 화면용 오늘 스냅샷
// 프로필 없으면 { needsOnboarding: true }만 반환. 있으면 오늘 workday를 (없으면 자동 생성해서) 반환.
import { requireUser } from '../../server/auth.js'
import { getTodaySnapshot } from '../../server/workday.js'
import { withErrors } from '../../server/http.js'

const SPELLING_ISSUE_PATTERN = /(오타|철자|스펠링|맞춤법|typo|spelling|misspell(?:ed|ing)?)/i
const isSpellingIssue = (value) => SPELLING_ISSUE_PATTERN.test(String(value || ''))
const isTransferPattern = (item) => /\[[^\]]+\]/.test(String(item?.en || ''))

function sanitizeReportView(report) {
  if (!report) return report
  const keyPhrases = report.keyPhrases || []
  const transferPatterns = keyPhrases.filter(isTransferPattern)
  return {
    ...report,
    // getTodaySnapshot은 이미 화면용 camelCase로 매핑된 상태다. 새 리포트에 재사용 패턴이 하나라도
    // 있으면 과거 호환용 withCorrectionsLinked가 앞에 끼워 넣은 "교정문 통째 암기"는 숨기고
    // 실제 패턴만 보여준다. 예전 리포트(패턴 필드 없음)는 기존 표시를 유지한다.
    keyPhrases: transferPatterns.length ? transferPatterns.slice(0, 5) : keyPhrases,
    improvementPoints: (report.improvementPoints || []).filter((item) => !isSpellingIssue(item?.note)),
    corrections: (report.corrections || []).filter((item) => !isSpellingIssue(item?.note)),
    recurring_issues: (report.recurring_issues || []).filter((item) => !isSpellingIssue(item)),
  }
}

export default withErrors('GET', async (req, res) => {
  const userId = await requireUser(req)
  const snapshot = await getTodaySnapshot(userId)
  if (snapshot?.report) snapshot.report = sanitizeReportView(snapshot.report)
  res.status(200).json(snapshot)
})
