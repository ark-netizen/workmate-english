// GET /api/profile — 온보딩 완료 여부 확인 (없으면 profile: null)
// POST /api/profile — 온보딩 저장
// POST { action: 'promotion.status'|'promotion.start'|'promotion.submit'|'delete-account', ... } — 인사평가/승급/회원탈퇴
import { requireUser } from '../server/auth.js'
import { getProfile, saveProfile } from '../server/profile.js'
import { getPromotionStatus, startEvaluation, submitEvaluation } from '../server/promotion.js'
import { deleteUserAccount } from '../server/admin.js'
import { rescheduleTodayNotifications } from '../server/workday.js'
import { withErrors } from '../server/http.js'

export default withErrors(null, async (req, res) => {
  const userId = await requireUser(req)
  if (req.method === 'GET') {
    const profile = await getProfile(userId)
    res.status(200).json({ profile })
    return
  }
  if (req.method === 'POST') {
    const action = req.body?.action
    if (action === 'promotion.status') {
      res.status(200).json(await getPromotionStatus(userId))
      return
    }
    if (action === 'promotion.start') {
      res.status(200).json(await startEvaluation(userId))
      return
    }
    if (action === 'promotion.submit') {
      const { personaFeedback, qna } = req.body || {}
      res.status(200).json(await submitEvaluation(userId, { personaFeedback, qna }))
      return
    }
    // 회원 탈퇴 — 본인 계정만 삭제 가능(관리자용 deleteUserAccount를 자기 자신 id로 재사용).
    // app_users를 지우면 user_profiles/workdays(및 그 아래 scenarios/conversations/messages/daily_reports 등)/
    // leave_records/field_work_events/promotions/rewards/push_tokens/support_inquiries/survey_responses가
    // 전부 on delete cascade로 함께 삭제된다(db/schema.sql 참고).
    if (action === 'delete-account') {
      const result = await deleteUserAccount(userId)
      res.status(200).json(result)
      return
    }
    // 액션 없으면 온보딩 저장
    const profile = await saveProfile(userId, req.body || {})
    // 출퇴근시간을 바꿨으면, 오늘 이미 잡혀있는(아직 발송 전) 연락들의 시각도 새 시간 기준으로 재계산
    if (req.body?.start_time !== undefined || req.body?.end_time !== undefined) {
      await rescheduleTodayNotifications(userId).catch(() => {})
    }
    res.status(200).json({ profile })
    return
  }
  res.status(405).json({ error: 'Method Not Allowed' })
})
