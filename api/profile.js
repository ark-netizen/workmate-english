// GET /api/profile — 온보딩 완료 여부 확인 (없으면 profile: null)
// POST /api/profile — 온보딩 저장
// POST { action: 'promotion.status'|'promotion.start'|'promotion.submit'|'delete-account', ... } — 인사평가/승급/회원탈퇴
import { requireUser } from '../server/auth.js'
import { getProfile, saveProfile } from '../server/profile.js'
import { getPromotionStatus, startEvaluation, submitEvaluation } from '../server/promotion.js'
import { deleteUserAccount } from '../server/admin.js'
import { rescheduleTodayNotifications } from '../server/workday.js'
import { saveKakaoToken, deleteKakaoToken } from '../server/kakao.js'
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
      // 화면의 disabled 상태만 믿으면 직접 API 호출로 출근일수 게이트를 우회할 수 있다.
      // 제출 시점에도 서버에서 자격과 실제 평가 시작 여부를 다시 확인한다.
      const status = await getPromotionStatus(userId)
      if (!status.eligible) {
        res.status(409).json({ error: '아직 인사평가 대상이 아닙니다' })
        return
      }
      if (!status.inProgress) {
        res.status(409).json({ error: '인사평가를 먼저 시작해주세요' })
        return
      }

      const { personaFeedback, qna } = req.body || {}
      const feedback = Array.isArray(personaFeedback) ? personaFeedback : []
      const answers = Array.isArray(qna) ? qna : []
      const feedbackComplete =
        feedback.length >= 3 &&
        feedback.every((item) => Number(item?.satisfaction) >= 1 && Number(item?.satisfaction) <= 5)
      const qnaComplete =
        answers.length >= 3 &&
        answers.every((item) => typeof item?.prompt === 'string' && item.prompt.trim() && typeof item?.answer === 'string' && item.answer.trim())

      if (!feedbackComplete || !qnaComplete) {
        res.status(400).json({ error: '인사평가의 필수 항목을 모두 완료해주세요' })
        return
      }

      res.status(200).json(await submitEvaluation(userId, { personaFeedback: feedback, qna: answers }))
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
    // 카카오 알림 재동의(talk_message 스코프) OAuth가 끝난 뒤, 프론트가 세션에서 받은
    // provider_token/provider_refresh_token을 그대로 넘겨 저장 — 이 시점에 kakao_notify_enabled도 켠다
    if (action === 'kakao.connect') {
      const { accessToken, refreshToken, expiresIn } = req.body || {}
      if (!accessToken || !refreshToken) {
        res.status(400).json({ error: 'accessToken/refreshToken 필요' })
        return
      }
      await saveKakaoToken(userId, { accessToken, refreshToken, expiresIn })
      const profile = await saveProfile(userId, { kakao_notify_enabled: true })
      res.status(200).json({ profile })
      return
    }
    // 카톡 알림 끄기 — 토큰까지 지워서, 나중에 다시 켤 때는 재동의부터 다시 받는다
    if (action === 'kakao.disconnect') {
      await deleteKakaoToken(userId)
      const profile = await saveProfile(userId, { kakao_notify_enabled: false })
      res.status(200).json({ profile })
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