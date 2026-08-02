// CS 챗봇(우측 하단) + 설문조사 — 관리자 전용 함수는 admin.js 쪽에 있음, 여긴 일반 유저용
import { admin, unwrap } from './db.js'
import { generateSupportAnswer } from './llm/client.js'

// ── FAQ 자동 응답 + 문의 접수 ──
export async function askSupportBot(question) {
  const result = await generateSupportAnswer({ question })
  return result
}

export async function submitSupportInquiry(userId, message) {
  const sb = admin()
  unwrap(await sb.from('support_inquiries').insert({ user_id: userId, message }))
  return { submitted: true }
}

// ── 설문조사(현재 published된 설문 하나만 운영, 별점+후기 고정 형식) ──
// 챗봇 종료 시 뜨는 설문은 매번 다시 물어봐도 되지만(챗봇=이미 불만 있는 상태일 확률이 높아 배너와
// 분리 집계해야 함), 화면 하단 배너는 "실계정 + 오늘이 첫 방문이 아닐 때"만 + 한 번 응답하면 다시 안 물어봄
export async function getActiveSurveyForUser(userId) {
  const sb = admin()
  const survey = unwrap(
    await sb.from('surveys').select('id, title, description, questions').eq('published', true).maybeSingle(),
  )
  if (!survey) return null

  const [bannerResponse, user, workdays] = await Promise.all([
    sb.from('survey_responses').select('id').eq('survey_id', survey.id).eq('user_id', userId).eq('source', 'banner').maybeSingle().then(unwrap),
    sb.from('app_users').select('email').eq('id', userId).maybeSingle().then(unwrap),
    sb.from('workdays').select('id').eq('user_id', userId).limit(2).then(unwrap),
  ])

  return {
    ...survey,
    alreadyRespondedViaBanner: !!bannerResponse,
    isRealAccount: !!user?.email,
    isFirstVisit: (workdays || []).length <= 1,
  }
}

// source: 'banner' | 'chat_preset' | 'chat_freeform' | 'chat_inquiry'
// 챗봇에서 남긴 응답은 몇 번째 챗봇 이용 중 남긴 건지(occurrence) 같이 기록 — 배너 응답은 항상 1회성
export async function submitSurveyResponse(userId, surveyId, rating, review, source = 'banner', answers = []) {
  const sb = admin()
  let occurrence = 1
  if (source.startsWith('chat')) {
    const prior = unwrap(
      await sb.from('survey_responses').select('id').eq('survey_id', surveyId).eq('user_id', userId).like('source', 'chat%'),
    ) || []
    occurrence = prior.length + 1
  }
  unwrap(
    await sb.from('survey_responses').insert({
      survey_id: surveyId,
      user_id: userId,
      rating,
      review: review || null,
      answers: answers || [],
      source,
      occurrence,
    }),
  )
  return { submitted: true }
}

// ── 소개 페이지 하단 "실제 후기" 롤링 노출 — reviews_public=true인 설문에서 관리자가 편집 팝업으로
// 확정(public_review/public_display_name)한 응답만 노출. 실제 review/display_name(개인정보 포함 가능)은
// 절대 그대로 내보내지 않고, 관리자가 마스킹/비식별 처리한 public_* 필드만 사용 ──
export async function getPublicReviews() {
  const sb = admin()
  const survey = unwrap(await sb.from('surveys').select('id').eq('reviews_public', true).maybeSingle())
  if (!survey) return []

  const responses = unwrap(
    await sb
      .from('survey_responses')
      .select('rating, public_review, public_display_name, created_at')
      .eq('survey_id', survey.id)
      .eq('featured', true)
      .not('public_review', 'is', null)
      .order('created_at', { ascending: false })
      .limit(30),
  ) || []

  return responses
    .filter((r) => r.public_review?.trim())
    .map((r) => ({
      rating: r.rating,
      review: r.public_review,
      displayName: r.public_display_name || '이용자',
      createdAt: r.created_at,
    }))
}
