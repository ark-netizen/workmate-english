// 관리자 대시보드 — 가입 계정/출결/반차·연차/외근 이탈/메시지 수신 현황을 한 번에 조회.
// 권한: app_users.admin_role — 'full'(조회+삭제) | 'readonly'(조회만) | null(일반 유저, 접근 불가)
import { admin, unwrap } from './db.js'
import { RANKS, requiredDaysForRank } from './promotion.js'

export async function getAdminRole(userId) {
  const sb = admin()
  const row = unwrap(await sb.from('app_users').select('admin_role').eq('id', userId).maybeSingle())
  return row?.admin_role || null
}

export async function getAdminDashboard() {
  const sb = admin()
  const users = unwrap(await sb.from('app_users').select('id, email, display_name, is_trial, created_at').order('created_at', { ascending: false })) || []
  const profiles = unwrap(
    await sb
      .from('user_profiles')
      .select('user_id, industry, job_role, english_level, job_rank, level_evaluated_at, evaluation_started_at, consecutive_days, rank_leave_balance, earned_leave_balance'),
  ) || []
  const workdays = unwrap(await sb.from('workdays').select('id, user_id, work_date, state, comfort_sent_at, created_at')) || []
  const leaves = unwrap(await sb.from('leave_records').select('user_id, kind')) || []
  const fieldWorks = unwrap(await sb.from('field_work_events').select('user_id')) || []
  const conversations = unwrap(await sb.from('conversations').select('id, workday_id, status')) || []
  // 승급 이력(테이블 미마이그레이션이어도 대시보드가 안 깨지게 방어) — 상세보기용으로 제출 내용도 함께 조회
  let promotions = []
  try {
    promotions = unwrap(
      await sb
        .from('promotions')
        .select('user_id, from_rank, to_rank, satisfaction, persona_feedback, test_qna, created_at')
        .order('created_at', { ascending: false }),
    ) || []
  } catch (_) {
    promotions = []
  }

  const profileByUser = new Map(profiles.map((p) => [p.user_id, p]))
  const promotionsByUser = new Map()
  for (const p of promotions) {
    if (!promotionsByUser.has(p.user_id)) promotionsByUser.set(p.user_id, [])
    promotionsByUser.get(p.user_id).push(p)
  }

  const rows = users.map((u) => {
    const uWorkdays = workdays.filter((w) => w.user_id === u.id)
    const uLeaves = leaves.filter((l) => l.user_id === u.id)
    const uFieldWorks = fieldWorks.filter((f) => f.user_id === u.id)
    const uWorkdayIds = new Set(uWorkdays.map((w) => w.id))
    const uConvos = conversations.filter((c) => uWorkdayIds.has(c.workday_id))
    const profile = profileByUser.get(u.id)

    const byState = {}
    for (const w of uWorkdays) byState[w.state] = (byState[w.state] || 0) + 1

    // 승급 현황: 현재 직급 / 승급 횟수 / 연속 출근일수 / 필요일 / 대상 여부 / 진행중(중도 포기 신호) / 연차 잔액
    const currentRank = profile?.job_rank || '사원'
    const workdaysSincePromo = profile?.consecutive_days || 0
    const requiredDays = requiredDaysForRank(currentRank)
    const atTop = currentRank === RANKS[RANKS.length - 1]
    const uPromotions = promotionsByUser.get(u.id) || []
    const promotion = {
      currentRank,
      promotionCount: uPromotions.length,
      workdaysSincePromo,
      requiredDays,
      eligible: !atTop && workdaysSincePromo >= requiredDays,
      atTop,
      // 평가를 시작(문제까지 받음)했지만 제출 안 함 → 중도 포기 신호
      inProgress: Boolean(profile?.evaluation_started_at),
      rankLeaveBalance: profile?.rank_leave_balance ?? 0,
      earnedLeaveBalance: profile?.earned_leave_balance ?? 0,
      // 계정 상세보기용 — 승급평가에서 유저가 입력한 내용(대화상대 피드백 + 역량평가 문답), 최신순
      evaluations: uPromotions.map((p) => ({
        fromRank: p.from_rank,
        toRank: p.to_rank,
        satisfaction: p.satisfaction,
        personaFeedback: p.persona_feedback || [],
        qna: p.test_qna || [],
        createdAt: p.created_at,
      })),
    }

    return {
      id: u.id,
      email: u.email,
      display_name: u.display_name,
      is_trial: u.is_trial,
      created_at: u.created_at,
      english_level: profile?.english_level || null,
      industry: profile?.industry || null,
      job_role: profile?.job_role || null,
      attendanceByState: byState,
      leave: {
        annual: uLeaves.filter((l) => l.kind === 'annual').length,
        halfDay: uLeaves.filter((l) => l.kind === 'half_day').length,
        cancel: uLeaves.filter((l) => l.kind === 'cancel').length,
      },
      fieldWorkCount: uFieldWorks.length,
      // 스트레스 신호(외근 반복/미응답 누적) 감지돼서 "고함항아리" 위로 메시지가 발송된 날 수
      stressPingCount: uWorkdays.filter((w) => w.comfort_sent_at).length,
      promotion,
      messages: {
        total: uConvos.length,
        awaiting: uConvos.filter((c) => c.status === 'awaiting').length,
        replied: uConvos.filter((c) => c.status === 'replied').length,
        done: uConvos.filter((c) => c.status === 'done').length,
      },
    }
  })

  return { users: rows, generatedAt: new Date().toISOString() }
}

// ── CS 문의 (우측 하단 챗봇 "문의 남기기") ──
export async function getSupportInquiries() {
  const sb = admin()
  const inquiries = unwrap(
    await sb.from('support_inquiries').select('id, user_id, message, status, created_at').order('created_at', { ascending: false }),
  ) || []
  const users = unwrap(await sb.from('app_users').select('id, email, display_name')) || []
  const userById = new Map(users.map((u) => [u.id, u]))
  return inquiries.map((i) => ({
    ...i,
    email: userById.get(i.user_id)?.email || null,
    display_name: userById.get(i.user_id)?.display_name || null,
  }))
}

export async function resolveInquiry(inquiryId) {
  const sb = admin()
  unwrap(await sb.from('support_inquiries').update({ status: 'resolved' }).eq('id', inquiryId))
  return { resolved: true }
}

// ── 설문조사 (관리자가 만들고 "반영"하면 서비스에 노출) — 현재는 활성 설문 1개, 별점+후기 고정 형식 ──
export async function getSurveyAdmin() {
  const sb = admin()
  const survey = unwrap(await sb.from('surveys').select('*').order('updated_at', { ascending: false }).limit(1).maybeSingle())
  if (!survey) return { survey: null, responses: [] }

  const responses = unwrap(
    await sb
      .from('survey_responses')
      .select('id, user_id, rating, review, answers, featured, public_review, public_display_name, source, occurrence, created_at')
      .eq('survey_id', survey.id)
      .order('created_at', { ascending: false }),
  ) || []
  const users = unwrap(await sb.from('app_users').select('id, email, display_name')) || []
  const userById = new Map(users.map((u) => [u.id, u]))

  return {
    survey,
    responses: responses.map((r) => ({
      ...r,
      email: userById.get(r.user_id)?.email || null,
      display_name: userById.get(r.user_id)?.display_name || null,
    })),
  }
}

export async function saveSurveyDraft({ title, description, questions }) {
  const sb = admin()
  const existing = unwrap(await sb.from('surveys').select('id').order('updated_at', { ascending: false }).limit(1).maybeSingle())
  const patch = { title, description, questions: questions || [], updated_at: new Date().toISOString() }
  if (existing) {
    return unwrap(await sb.from('surveys').update(patch).eq('id', existing.id).select().single())
  }
  return unwrap(await sb.from('surveys').insert(patch).select().single())
}

// 관리자가 특정 응답을 소개 페이지 "실제 후기"에 노출할지 선택
// featured=true로 켤 때는 반드시 편집 팝업에서 확정한 publicReview(개인정보 마스킹 등 편집된 문구)와
// publicDisplayName(비식별 표기)을 같이 받는다 — 실제 review/display_name을 그대로 공개하지 않기 위함
export async function setResponsePublicDisplay(responseId, { featured, publicReview, publicDisplayName }) {
  const sb = admin()
  const patch = { featured }
  if (featured) {
    patch.public_review = publicReview
    patch.public_display_name = publicDisplayName
  }
  return unwrap(await sb.from('survey_responses').update(patch).eq('id', responseId).select().single())
}

export async function setSurveyPublished(published) {
  const sb = admin()
  const existing = unwrap(await sb.from('surveys').select('id').order('updated_at', { ascending: false }).limit(1).maybeSingle())
  if (!existing) throw Object.assign(new Error('먼저 설문 내용을 저장해주세요'), { status: 400 })
  const patch = { published, updated_at: new Date().toISOString() }
  if (published) patch.published_at = new Date().toISOString()
  return unwrap(await sb.from('surveys').update(patch).eq('id', existing.id).select().single())
}

// 소개 페이지 하단 "실제 후기" 롤링 노출 여부 — published(응답 수집)와는 독립적인 토글
export async function setReviewsPublic(reviewsPublic) {
  const sb = admin()
  const existing = unwrap(await sb.from('surveys').select('id').order('updated_at', { ascending: false }).limit(1).maybeSingle())
  if (!existing) throw Object.assign(new Error('먼저 설문 내용을 저장해주세요'), { status: 400 })
  return unwrap(
    await sb.from('surveys').update({ reviews_public: reviewsPublic, updated_at: new Date().toISOString() }).eq('id', existing.id).select().single(),
  )
}

export async function deleteUserAccount(targetUserId) {
  const sb = admin()
  const row = unwrap(await sb.from('app_users').select('auth_uid').eq('id', targetUserId).maybeSingle())
  if (row?.auth_uid) {
    await sb.auth.admin.deleteUser(row.auth_uid).catch(() => {})
  }
  unwrap(await sb.from('app_users').delete().eq('id', targetUserId))
  return { deleted: true }
}
