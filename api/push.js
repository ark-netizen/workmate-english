// POST /api/push — 푸시 구독 저장 + 알림 액션 버튼(외근중 등) 처리를 한 함수로 통합
// (Vercel Hobby 플랜 서버리스 함수 12개 제한 때문에 push/subscribe.js + push/action.js를 합침)
import { requireUser } from '../server/auth.js'
import { saveSubscription, deleteSubscription, getUserIdByEndpoint } from '../server/push.js'
import { goOnFieldWorkV2 } from '../server/fieldWork.js'
import { withErrors } from '../server/http.js'

const FIELD_WORK_PUSH_DELAY_MIN = 30

export default withErrors('POST', async (req, res) => {
  const body = req.body || {}

  // 알림 액션 버튼 호출 — 앱이 안 열려있어 로그인 토큰이 없으므로 구독 endpoint로 사용자 식별
  if (body.action) {
    const { endpoint, action, conversationId } = body
    if (!endpoint) {
      res.status(400).json({ error: 'endpoint 필요' })
      return
    }
    const userId = await getUserIdByEndpoint(endpoint)
    if (!userId) {
      res.status(404).json({ error: '구독 정보를 찾을 수 없습니다' })
      return
    }
    if (action === 'field-work') {
      // 푸시에서 누른 "그 연락"을 정확히 30분 뒤 다시 알려준다.
      const result = await goOnFieldWorkV2(userId, FIELD_WORK_PUSH_DELAY_MIN, 'push', conversationId || null)
      res.status(200).json(result)
      return
    }
    res.status(400).json({ error: `알 수 없는 action: ${action}` })
    return
  }

  // 구독 해제 — 설정에서 "알림 완전히 끄기"를 눌렀을 때. 로그인 상태에서 프론트가 호출
  if (body.unsubscribe) {
    const userId = await requireUser(req)
    const { endpoint } = body
    if (!endpoint) {
      res.status(400).json({ error: 'endpoint 필요' })
      return
    }
    await deleteSubscription(userId, endpoint)
    res.status(200).json({ ok: true })
    return
  }

  // 일반 구독 저장 — 로그인 상태에서 프론트가 호출
  const userId = await requireUser(req)
  const { subscription } = body
  if (!subscription?.endpoint || !subscription?.keys) {
    res.status(400).json({ error: 'subscription 필요' })
    return
  }
  await saveSubscription(userId, subscription, req.headers['user-agent'])
  res.status(200).json({ ok: true })
})
