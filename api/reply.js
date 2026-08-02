// POST /api/reply — 사용자 영어 답변 → 후속 반응 생성 + 푸시
// body에 { conversationId, markRead: true }만 있으면 답변 대신 읽음 처리만 함(대화 열 때 호출)
// body에 { vent: true, text }만 있으면 conversationId 없이 "마음 편하게 말 걸기" 채널로 발송
// body에 { translate: true, text }만 있으면 받은 메시지/이메일을 한국어로 번역
// body에 { support: 'ask'|'inquiry', text }만 있으면 CS 챗봇 질문/문의 접수
// body에 { surveyResponse: true, surveyId, rating, review }만 있으면 설문 응답(별점+후기) 제출
// body에 { getPublicReviews: true }만 있으면 소개 페이지용 공개 후기 목록 조회
import { requireUser } from '../server/auth.js'
import { submitReply, markConversationRead, sendVentMessage } from '../server/workday.js'
import { generateTranslation } from '../server/llm/client.js'
import { askSupportBot, submitSupportInquiry, submitSurveyResponse, getPublicReviews } from '../server/support.js'
import { admin } from '../server/db.js'
import { withErrors } from '../server/http.js'
import { sendPushToUser } from '../server/push.js'

export default withErrors('POST', async (req, res) => {
  const { conversationId, text, markRead, vent, translate, role, support, surveyResponse, getPublicReviews: wantsPublicReviews, hintLevel, hintSentence } = req.body || {}

  // 소개(랜딩) 페이지의 공개 후기는 로그인 전 방문자도 봐야 하므로, 다른 액션과 달리 인증 없이 처리
  if (wantsPublicReviews) {
    const reviews = await getPublicReviews()
    res.status(200).json({ reviews })
    return
  }

  const userId = await requireUser(req)

  if (translate) {
    if (!text?.trim()) {
      res.status(400).json({ error: 'text 필요' })
      return
    }
    const result = await generateTranslation({ text: text.trim(), role })
    res.status(200).json(result)
    return
  }

  if (support === 'ask') {
    if (!text?.trim()) {
      res.status(400).json({ error: 'text 필요' })
      return
    }
    const result = await askSupportBot(text.trim())
    res.status(200).json(result)
    return
  }

  if (support === 'inquiry') {
    if (!text?.trim()) {
      res.status(400).json({ error: 'text 필요' })
      return
    }
    const result = await submitSupportInquiry(userId, text.trim())
    res.status(200).json(result)
    return
  }

  if (surveyResponse) {
    const { surveyId, rating, review, source, answers } = req.body
    if (!surveyId || !rating || !review?.trim()) {
      res.status(400).json({ error: 'surveyId, rating, review 필요' })
      return
    }
    const result = await submitSurveyResponse(userId, surveyId, rating, review, source, answers)
    res.status(200).json(result)
    return
  }

  if (vent) {
    if (!text?.trim()) {
      res.status(400).json({ error: 'text 필요' })
      return
    }
    const { _push, ...result } = await sendVentMessage(userId, text.trim())
    res.status(200).json(result)
    if (_push) await sendPushToUser(_push.userId, _push)
    return
  }

  if (!conversationId) {
    res.status(400).json({ error: 'conversationId 필요' })
    return
  }
  // 소유권 확인 (conversation → workday.user_id) — 조인으로 한 번에 조회해 왕복을 줄인다
  const convo = (
    await admin().from('conversations').select('workday_id, workdays(user_id)').eq('id', conversationId).single()
  ).data
  if (!convo?.workdays?.user_id || convo.workdays.user_id !== userId) {
    res.status(403).json({ error: '권한 없음' })
    return
  }

  if (markRead) {
    await markConversationRead(conversationId)
    res.status(200).json({ ok: true })
    return
  }

  if (!text?.trim()) {
    res.status(400).json({ error: 'text 필요' })
    return
  }
  const { subject } = req.body || {}
  const normalizedHintLevel = hintLevel === 'word' || hintLevel === 'sentence' ? hintLevel : null
  const { _push, ...result } = await submitReply(
    conversationId,
    text.trim(),
    subject?.trim() || null,
    normalizedHintLevel,
    typeof hintSentence === 'string' ? hintSentence.trim() : null,
  )
  // 응답을 먼저 클라이언트에 보낸 뒤에 푸시를 보내야, 답을 보낸 유저 본인 화면에 그 결과가 반영되기도
  // 전에 알림이 먼저 뜨는 순서 역전이 안 생긴다
  res.status(200).json(result)
  if (_push) await sendPushToUser(_push.userId, _push)
})
