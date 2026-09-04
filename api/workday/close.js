// POST /api/workday/close — 퇴근: 리포트 + 익일 요약 생성·저장
// body에 { reset: true }만 있으면 [개발용] 오늘 workday를 통째로 삭제해서 출근부터 다시 테스트
// body에 { advanceDay: true }만 있으면 [개발용 QA] 오늘을 마감하고 다음 접속 시 새로운 하루로 취급되게 함
// body에 { resetAccount: true }만 있으면 [개발용 QA] 이 계정의 진행상황을 전부 지우고 온보딩부터 다시 시작
import { requireUser } from '../../server/auth.js'
import { getAdminRole } from '../../server/admin.js'
import {
  closeWorkday,
  devResetToday,
  devAdvanceToNextDay,
  devSendKakaoInactiveReminder,
  resetAccountProgress,
} from '../../server/workday.js'
import { admin } from '../../server/db.js'
import { withErrors } from '../../server/http.js'
import { sendPushToUser } from '../../server/push.js'

const normalizeSentence = (value) =>
  String(value || '')
    .toLowerCase()
    .replace(/[^a-z0-9가-힣]+/g, ' ')
    .trim()

function dedupeBy(items, makeKey) {
  if (!Array.isArray(items)) return []
  const seen = new Set()
  return items.filter((item) => {
    const key = makeKey(item)
    if (!key || seen.has(key)) return false
    seen.add(key)
    return true
  })
}

// closeWorkday 내부의 previousIssues 조회는 현재 workday의 daily_reports를 읽는다.
// 리포트가 생성되기 전에는 그 행이 없어서 과거 약점이 매일 빈 배열로 들어가던 문제를 막기 위해,
// 최근 근무일들의 recurring_issues를 오늘 행에 임시로 심어 생성 프롬프트가 실제 누적 맥락을 받게 한다.
// closeWorkday가 곧 같은 workday_id로 전체 리포트를 upsert하므로 이 임시 값은 최종 결과로 덮어써진다.
async function seedPreviousReportIssues(userId, workdayId, workDate) {
  const sb = admin()
  const previousWorkdaysResult = await sb
    .from('workdays')
    .select('id')
    .eq('user_id', userId)
    .lt('work_date', workDate)
    .order('work_date', { ascending: false })
    .limit(5)

  if (previousWorkdaysResult.error) throw previousWorkdaysResult.error
  const previousWorkdays = previousWorkdaysResult.data || []
  if (!previousWorkdays.length) return

  const previousReportsResult = await sb
    .from('daily_reports')
    .select('recurring_issues')
    .in('workday_id', previousWorkdays.map((workday) => workday.id))

  if (previousReportsResult.error) throw previousReportsResult.error
  const previousIssues = dedupeBy(
    (previousReportsResult.data || []).flatMap((row) => row.recurring_issues || []),
    (issue) => normalizeSentence(issue),
  ).slice(0, 8)

  if (!previousIssues.length) return

  const seedResult = await sb
    .from('daily_reports')
    .upsert({ workday_id: workdayId, recurring_issues: previousIssues }, { onConflict: 'workday_id' })

  if (seedResult.error) throw seedResult.error
}

// LLM 프롬프트가 지켜야 하는 내용 규칙 중 스키마 검증만으로 잡히지 않는 모순은 저장 직후 한 번 더 정리한다.
// 같은 교정이 중복되거나, 같은 사용자 문장이 "잘한 표현"과 "교정 내용"에 동시에 들어가는 경우를 제거한다.
async function cleanGeneratedDailyReport(workdayId, report) {
  if (!report) return report

  const corrections = dedupeBy(
    report.corrections,
    (item) => `${normalizeSentence(item?.before)}→${normalizeSentence(item?.after)}`,
  )
  const correctionBefore = new Set(corrections.map((item) => normalizeSentence(item?.before)).filter(Boolean))
  const goodExpressions = dedupeBy(
    (report.good_expressions || []).filter((item) => !correctionBefore.has(normalizeSentence(item?.text))),
    (item) => normalizeSentence(item?.text),
  )
  const recommendedExpressions = dedupeBy(
    report.recommended_expressions,
    (item) => normalizeSentence(item?.en),
  )
  const registerFeedback = dedupeBy(report.register_feedback, (item) => String(item?.role || ''))
  const recurringIssues = dedupeBy(report.recurring_issues, (item) => normalizeSentence(item))

  const cleaned = {
    ...report,
    good_expressions: goodExpressions,
    corrections,
    recommended_expressions: recommendedExpressions,
    register_feedback: registerFeedback,
    recurring_issues: recurringIssues,
  }

  const updateResult = await admin()
    .from('daily_reports')
    .update({
      good_expressions: cleaned.good_expressions,
      corrections: cleaned.corrections,
      recommended_expressions: cleaned.recommended_expressions,
      register_feedback: cleaned.register_feedback,
      recurring_issues: cleaned.recurring_issues,
    })
    .eq('workday_id', workdayId)

  // 퇴근 자체는 이미 성공한 뒤이므로 정리 실패 때문에 사용자 퇴근 요청까지 500으로 뒤집지는 않는다.
  if (updateResult.error) console.error('[daily-report] 저장 후 정리 실패:', updateResult.error)

  return cleaned
}

export default withErrors('POST', async (req, res) => {
  const userId = await requireUser(req)
  const { workdayId, reset, advanceDay, resetAccount, testKakaoInactive } = req.body || {}

  // 심사 기간에는 심사자가 본인 계정으로 QA 패널을 체험할 수 있도록 일시적으로 열었지만,
  // 심사가 끝난 운영 상태에서는 파괴적 QA 액션을 full 관리자에게만 허용한다.
  const ALLOW_QA_ACTIONS_FOR_ALL = false
  if (!ALLOW_QA_ACTIONS_FOR_ALL && (testKakaoInactive || reset || resetAccount || advanceDay)) {
    const role = await getAdminRole(userId)
    if (role !== 'full') {
      res.status(403).json({ error: 'QA 관리자 권한이 없습니다' })
      return
    }
  }

  if (testKakaoInactive) {
    const result = await devSendKakaoInactiveReminder(userId)
    res.status(200).json(result)
    return
  }

  if (reset) {
    const result = await devResetToday(userId)
    res.status(200).json(result)
    return
  }

  if (resetAccount) {
    const result = await resetAccountProgress(userId)
    res.status(200).json(result)
    return
  }

  if (advanceDay) {
    const result = await devAdvanceToNextDay(userId)
    res.status(200).json(result)
    return
  }

  if (!workdayId) {
    res.status(400).json({ error: 'workdayId 필요' })
    return
  }
  // 소유권 확인 + 이전 리포트 맥락을 찾을 때 쓸 현재 업무일
  const ownResult = await admin().from('workdays').select('user_id, work_date').eq('id', workdayId).single()
  const own = ownResult.data
  if (!own || own.user_id !== userId) {
    res.status(403).json({ error: '권한 없음' })
    return
  }

  // 이전 리포트가 없어도 첫날 리포트는 정상 생성되어야 하므로, 과거 맥락 준비 실패는 생성 자체를 막지 않는다.
  await seedPreviousReportIssues(userId, workdayId, own.work_date).catch((error) => {
    console.error('[daily-report] 이전 약점 불러오기 실패:', error)
  })

  const result = await closeWorkday(workdayId)
  if (result?.report) result.report = await cleanGeneratedDailyReport(workdayId, result.report)

  res.status(200).json(result)
  // 리포트 생성이 몇 초 걸리므로, 클라이언트 응답을 먼저 보낸 다음 완료 알림을 보낸다
  // (다른 push들과 같은 순서 원칙 — 응답보다 push가 먼저 뜨는 역전 방지)
  sendPushToUser(userId, {
    title: '오늘 하루 마감 완료',
    body: '퇴근 처리가 끝났어요. 오늘의 리포트를 확인해보세요.',
    url: '/reports',
  }).catch(() => {})
})