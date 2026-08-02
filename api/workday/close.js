// POST /api/workday/close — 퇴근: 리포트 + 익일 요약 생성·저장
// body에 { reset: true }만 있으면 [개발용] 오늘 workday를 통째로 삭제해서 출근부터 다시 테스트
// body에 { advanceDay: true }만 있으면 [개발용 QA] 오늘을 마감하고 다음 접속 시 새로운 하루로 취급되게 함
// body에 { resetAccount: true }만 있으면 [개발용 QA] 이 계정의 진행상황을 전부 지우고 온보딩부터 다시 시작
import { requireUser } from '../../server/auth.js'
import { closeWorkday, devResetToday, devAdvanceToNextDay, resetAccountProgress } from '../../server/workday.js'
import { admin } from '../../server/db.js'
import { withErrors } from '../../server/http.js'

export default withErrors('POST', async (req, res) => {
  const userId = await requireUser(req)
  const { workdayId, reset, advanceDay, resetAccount } = req.body || {}

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
  // 소유권 확인
  const own = (await admin().from('workdays').select('user_id').eq('id', workdayId).single()).data
  if (!own || own.user_id !== userId) {
    res.status(403).json({ error: '권한 없음' })
    return
  }
  const result = await closeWorkday(workdayId)
  res.status(200).json(result)
})
