// /api/workday/report/period
// GET  ?range=week|month  — 최근 7일/30일 daily_reports를 종합한 서술형 리포트
// GET  ?view=hours&days=N — 최근 N일(기본 14일) 실제 근무 시간 이력(출퇴근 기반)
// GET  ?view=daily&date=YYYY-MM-DD — 특정 날짜의 일간 리포트(이미 저장된 daily_reports 재사용)
// POST { action: 'backfill' } — [개발용 QA 도구] 실제 며칠 기다리지 않고 지난 하루치를 즉석에서 채움
// (Vercel Hobby 플랜 서버리스 함수 12개 제한 때문에 dev/backfill-day.js를 합침)
import { requireUser } from '../../../server/auth.js'
import { getPeriodReport, getDailyReportForDate, devBackfillPastDay, devBackfillPastDays, getWorkHoursHistory, getAttendanceHistory } from '../../../server/workday.js'
import { withErrors } from '../../../server/http.js'

const SPELLING_ISSUE_PATTERN = /(오타|철자|스펠링|맞춤법|typo|spelling|misspell(?:ed|ing)?)/i
const isSpellingIssue = (value) => SPELLING_ISSUE_PATTERN.test(String(value || ''))
const isTransferPattern = (item) => /\[[^\]]+\]/.test(String(item?.en || ''))

function sanitizeDailyReportView(report) {
  if (!report) return report
  const keyPhrases = report.keyPhrases || []
  const transferPatterns = keyPhrases.filter(isTransferPattern)
  return {
    ...report,
    keyPhrases: transferPatterns.length ? transferPatterns.slice(0, 5) : keyPhrases,
    improvementPoints: (report.improvementPoints || []).filter((item) => !isSpellingIssue(item?.note)),
    corrections: (report.corrections || []).filter((item) => !isSpellingIssue(item?.note)),
    recurring_issues: (report.recurring_issues || []).filter((item) => !isSpellingIssue(item)),
  }
}

export default withErrors(null, async (req, res) => {
  const userId = await requireUser(req)

  if (req.method === 'POST') {
    // { count: N } 이면 N일치 한 번에(승급 30일 게이트 QA용), 없으면 하루치
    const count = Number(req.body?.count) || 1
    const result = count > 1 ? await devBackfillPastDays(userId, count) : await devBackfillPastDay(userId)
    res.status(200).json(result)
    return
  }

  if (req.method === 'GET') {
    if (req.query?.view === 'hours') {
      const daysBack = Math.min(Number(req.query?.days) || 14, 60)
      const result = await getWorkHoursHistory(userId, daysBack)
      res.status(200).json(result)
      return
    }
    if (req.query?.view === 'attendance') {
      const daysBack = Math.min(Number(req.query?.days) || 119, 366)
      const result = await getAttendanceHistory(userId, daysBack)
      res.status(200).json(result)
      return
    }
    if (req.query?.view === 'daily') {
      const date = String(req.query?.date || '')
      if (!/^\d{4}-\d{2}-\d{2}$/.test(date)) {
        res.status(400).json({ error: 'date(YYYY-MM-DD) 필요' })
        return
      }
      const result = await getDailyReportForDate(userId, date)
      if (result?.report) result.report = sanitizeDailyReportView(result.report)
      res.status(200).json(result)
      return
    }
    const range = req.query?.range === 'month' ? 'month' : 'week'
    const result = await getPeriodReport(userId, range)
    res.status(200).json(result)
    return
  }

  res.status(405).json({ error: 'Method Not Allowed' })
})
