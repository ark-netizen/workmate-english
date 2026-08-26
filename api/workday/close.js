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

export default withErrors('POST', async (req, res) => {
  const userId = await requireUser(req)
  const { workdayId, reset, advanceDay, resetAccount, testKakaoInactive } = req.body || {}

  // 운영 서비스에 QA용 파괴적 액션이 그대로 열려 있으면 일반 로그인 사용자도 자기 계정 데이터를
  // 초기화/임의 진행할 수 있다. 프론트 /qa 차단과 별개로 서버에서도 full 관리자 권한을 검증한다.
  if (testKakaoInactive || reset || resetAccount || advanceDay) {
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
  // 소유권 확인
  const own = (await admin().from('workdays').select('user_id').eq('id', workdayId).single()).data
  if (!own || own.user_id !== userId) {
    res.status(403).json({ error: '권한 없음' })
    return
  }
  const result = await closeWorkday(workdayId)
  res.status(200).json(result)
  // 리포트 생성이 몇 초 걸리므로, 클라이언트 응답을 먼저 보낸 다음 완료 알림을 보낸다
  // (다른 push들과 같은 순서 원칙 — 응답보다 push가 먼저 뜨는 역전 방지)
  sendPushToUser(userId, {
    title: '오늘 하루 마감 완료',
    body: '퇴근 처리가 끝났어요. 오늘의 리포트를 확인해보세요.',
    url: '/reports',
  }).catch(() => {})
})