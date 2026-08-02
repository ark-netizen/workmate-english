// /api/admin/dashboard — 관리자 전용
// GET: 가입 계정/출결/반차·연차/외근 이탈/메시지 수신 현황 + CS 문의 + 설문 현황 조회 (full, readonly 둘 다 가능)
// POST { action: 'resolve_inquiry'|'survey_save'|'survey_publish'|'survey_reviews_public', ... }: 변경 작업 (full만 가능)
// DELETE ?userId=...: 계정 삭제 (full만 가능)
import { requireUser } from '../../server/auth.js'
import {
  getAdminRole,
  getAdminDashboard,
  deleteUserAccount,
  getSupportInquiries,
  resolveInquiry,
  getSurveyAdmin,
  saveSurveyDraft,
  setSurveyPublished,
  setReviewsPublic,
  setResponsePublicDisplay,
} from '../../server/admin.js'
import { withErrors } from '../../server/http.js'

export default withErrors(null, async (req, res) => {
  const userId = await requireUser(req)
  const role = await getAdminRole(userId)
  if (!role) {
    res.status(403).json({ error: '관리자 권한이 없습니다' })
    return
  }

  if (req.method === 'GET') {
    // CS 문의/설문 테이블이 아직 마이그레이션 전이어도(SQL 미실행) 기존 대시보드 조회 자체는 안 깨지게 방어
    const [data, supportInquiries, surveyData] = await Promise.all([
      getAdminDashboard(),
      getSupportInquiries().catch(() => []),
      getSurveyAdmin().catch(() => ({ survey: null, responses: [] })),
    ])
    res.status(200).json({ ...data, role, supportInquiries, ...surveyData })
    return
  }

  if (req.method === 'POST') {
    if (role !== 'full') {
      res.status(403).json({ error: '조회 권한만 있습니다' })
      return
    }
    const { action } = req.body || {}
    if (action === 'resolve_inquiry') {
      const result = await resolveInquiry(req.body.inquiryId)
      res.status(200).json(result)
      return
    }
    if (action === 'survey_save') {
      const { title, description, questions } = req.body
      const survey = await saveSurveyDraft({ title, description, questions })
      res.status(200).json({ survey })
      return
    }
    if (action === 'survey_publish') {
      const survey = await setSurveyPublished(!!req.body.published)
      res.status(200).json({ survey })
      return
    }
    if (action === 'survey_reviews_public') {
      const survey = await setReviewsPublic(!!req.body.reviewsPublic)
      res.status(200).json({ survey })
      return
    }
    if (action === 'toggle_response_featured') {
      const { responseId, featured, publicReview, publicDisplayName } = req.body
      if (featured && !publicReview?.trim()) {
        res.status(400).json({ error: '노출할 문구(publicReview)가 필요합니다' })
        return
      }
      const response = await setResponsePublicDisplay(responseId, {
        featured: !!featured,
        publicReview: publicReview?.trim() || null,
        publicDisplayName: publicDisplayName?.trim() || '이용자',
      })
      res.status(200).json({ response })
      return
    }
    res.status(400).json({ error: '알 수 없는 action' })
    return
  }

  if (req.method === 'DELETE') {
    if (role !== 'full') {
      res.status(403).json({ error: '조회 권한만 있습니다' })
      return
    }
    const targetUserId = req.query?.userId
    if (!targetUserId) {
      res.status(400).json({ error: 'userId 필요' })
      return
    }
    const result = await deleteUserAccount(targetUserId)
    res.status(200).json(result)
    return
  }

  res.status(405).json({ error: 'Method Not Allowed' })
})
