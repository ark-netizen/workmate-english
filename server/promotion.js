// 인사평가/승급 + 연차 (서버 전용)
// 정책(최종안 — devlog/승급-연차-정책-최종.md 참고):
//  - 직급별 필요 "연속 출근일수"가 누적 증가: 사원→주임 30일, 주임→대리 60일, 대리→과장 90일 … (직급 index+1 × 30)
//  - 결석(평일)한 날은 직급 연차 → 적립 연차 순으로 자동 차감해서 커버되면 연속 출근일수가 안 끊김.
//    둘 다 없으면 연속 출근일수(와 진행 중이던 적립 게이지)만 0으로 리셋 — 이미 적립 완료된 연차는 안 사라짐.
//  - 연차는 두 종류: 직급 연차(현재 직급 기준, 승급하면 새 직급 개수로 교체) + 적립 연차(연속 출근 5일마다
//    자동 +1, 승급해도 유지). 진행 중인 게이지(consecutive_days % 5)는 스트릭과 함께 움직인다.
//  - 인사평가에서 유저가 대화한 동료/상사/거래처 각각에 대해 만족도 + 개선 제안을 받는다(서비스 개선 반영용 저장)
//  - 이어서 그동안 쌓인 프롬프트/약점 데이터로 이 사람 수준에 맞는 역량평가 문제 3개(LLM 생성)
//  - 제출하면 무조건 승진. 승진 시 연속 출근일수는 0부터, 직급 연차는 새 직급 개수로 교체, 적립 연차는 유지.
import { admin, unwrap } from './db.js'
import { generateEvaluationQuestions } from './llm/client.js'

// 기존 회사 직급 체계
export const RANKS = ['사원', '주임', '대리', '과장', '차장', '부장', '이사']
// 직급별 연차 개수 — 승급하면 이전 값은 버리고 이 표의 새 직급 개수로 교체
export const RANK_LEAVE = { 사원: 2, 주임: 3, 대리: 4, 과장: 5, 차장: 6, 부장: 7, 이사: 8 }

export function nextRank(current) {
  const i = RANKS.indexOf(current)
  if (i === -1) return RANKS[1] // 알 수 없으면 '주임'
  return RANKS[Math.min(i + 1, RANKS.length - 1)]
}

const DAYS_PER_STEP = 30 // 한 단계 승급마다 필요 연속 출근일수가 30일씩 증가

// 현재 직급 index 기준, 다음 승급까지 필요한 연속 출근일수 (사원=0 → 30, 주임=1 → 60, 대리=2 → 90 …)
function requiredDaysFor(rankIndex) {
  return DAYS_PER_STEP * (rankIndex + 1)
}

const WEEKEND_DAYS = new Set([0, 6])
function isWeekday(dateStr) {
  return !WEEKEND_DAYS.has(new Date(`${dateStr}T00:00:00`).getDay())
}
function addDays(dateStr, n) {
  const d = new Date(`${dateStr}T00:00:00`)
  d.setDate(d.getDate() + n)
  return d.toISOString().slice(0, 10)
}

// 출근("startWorkday"가 새 workday를 만들 때) 시 호출:
//  (1) 직전 근무일과 오늘 사이에 결석한 평일이 있으면 직급 연차 → 적립 연차 순으로 자동 커버(커버되면 스트릭 유지),
//      둘 다 없으면 연속 출근일수 0으로 리셋
//  (2) 오늘 출근을 연속 출근일수에 +1 반영, 5일 채울 때마다 적립 연차 +1(주말에 출근해도 정상 반영됨)
export async function recordDailyAttendance(userId, lastWorkDate, todayWorkDate) {
  const sb = admin()
  const profile = unwrap(
    await sb
      .from('user_profiles')
      .select('consecutive_days, rank_leave_balance, earned_leave_balance')
      .eq('user_id', userId)
      .maybeSingle(),
  )
  if (!profile) return

  let consecutiveDays = profile.consecutive_days || 0
  let rankLeave = profile.rank_leave_balance || 0
  let earnedLeave = profile.earned_leave_balance || 0

  if (lastWorkDate) {
    let cursor = addDays(lastWorkDate, 1)
    while (cursor < todayWorkDate) {
      if (isWeekday(cursor)) {
        if (rankLeave > 0) rankLeave -= 1
        else if (earnedLeave > 0) earnedLeave -= 1
        else consecutiveDays = 0 // 커버 안 된 결석 — 진행 중이던 스트릭(게이지 포함) 리셋
      }
      cursor = addDays(cursor, 1)
    }
  }

  // 오늘 출근 반영 — 5일마다 적립 연차 자동 지급
  consecutiveDays += 1
  if (consecutiveDays % 5 === 0) earnedLeave += 1

  unwrap(
    await sb
      .from('user_profiles')
      .update({ consecutive_days: consecutiveDays, rank_leave_balance: rankLeave, earned_leave_balance: earnedLeave })
      .eq('user_id', userId),
  )
}

// 연차 사용 가능 여부 확인 + 소진(직급 연차 우선) — takeLeave('annual')에서 호출
export async function consumeLeaveForUse(userId) {
  const sb = admin()
  const profile = unwrap(
    await sb.from('user_profiles').select('rank_leave_balance, earned_leave_balance').eq('user_id', userId).maybeSingle(),
  )
  const rankLeave = profile?.rank_leave_balance || 0
  const earnedLeave = profile?.earned_leave_balance || 0
  if (rankLeave + earnedLeave <= 0) return { ok: false }

  const patch = rankLeave > 0 ? { rank_leave_balance: rankLeave - 1 } : { earned_leave_balance: earnedLeave - 1 }
  unwrap(await sb.from('user_profiles').update(patch).eq('user_id', userId))
  return { ok: true }
}

export async function getLeaveBalance(userId) {
  const sb = admin()
  const profile = unwrap(
    await sb.from('user_profiles').select('rank_leave_balance, earned_leave_balance').eq('user_id', userId).maybeSingle(),
  )
  const rankLeave = profile?.rank_leave_balance || 0
  const earnedLeave = profile?.earned_leave_balance || 0
  return { rankLeave, earnedLeave, total: rankLeave + earnedLeave }
}

// 직급 진행도를 하나의 점수로 환산 — 승급 없이는 못 넘는 누적 요구일수(이전 단계까지) + 현재 연속 출근일수.
// 승급해야만 올라가는 값이라 사용자 간 서열을 매길 때 직급 차이를 우선하고, 같은 직급이면 연속 출근일수로 갈린다.
function careerScoreFor(rank, consecutiveDays) {
  const rankIndex = Math.max(0, RANKS.indexOf(rank || '사원'))
  const cumulativeDaysToRank = (DAYS_PER_STEP * rankIndex * (rankIndex + 1)) / 2
  return cumulativeDaysToRank + (consecutiveDays || 0)
}

// 전체 사용자 대비 내 위치 — "상위 X%" (동점자는 절반씩 걸치는 것으로 처리하는 표준 percentile rank 방식)
async function getRankStanding(userId, myRank, myConsecutiveDays) {
  const sb = admin()
  const rows = unwrap(await sb.from('user_profiles').select('user_id, job_rank, consecutive_days')) || []
  const total = rows.length
  if (total < 2) return null // 비교 대상이 없으면 표시하지 않음

  const myScore = careerScoreFor(myRank, myConsecutiveDays)
  let below = 0
  let same = 0
  for (const r of rows) {
    if (r.user_id === userId) continue
    const score = careerScoreFor(r.job_rank, r.consecutive_days)
    if (score < myScore) below += 1
    else if (score === myScore) same += 1
  }
  const outrank = below + same / 2 // 나보다 아래인 사람 수(동점자는 절반)
  const topPercent = Math.max(1, Math.min(100, Math.round(((total - outrank) / total) * 100)))

  return { topPercent, totalUsers: total }
}

// 인사평가 자격/현황
export async function getPromotionStatus(userId) {
  const sb = admin()
  const profile = unwrap(
    await sb
      .from('user_profiles')
      .select('job_rank, level_evaluated_at, evaluation_started_at, consecutive_days')
      .eq('user_id', userId)
      .maybeSingle(),
  )
  if (!profile) return { eligible: false, reason: 'no-profile' }

  const currentRank = profile.job_rank || '사원'
  const rankIndex = Math.max(0, RANKS.indexOf(currentRank))
  const atTop = rankIndex >= RANKS.length - 1
  const requiredDays = requiredDaysFor(rankIndex)
  const workdayCount = profile.consecutive_days || 0
  const standing = await getRankStanding(userId, currentRank, workdayCount)

  return {
    eligible: !atTop && workdayCount >= requiredDays,
    currentRank,
    nextRank: nextRank(currentRank),
    workdayCount,
    requiredDays,
    atTop,
    inProgress: Boolean(profile.evaluation_started_at),
    evaluatedAt: profile.level_evaluated_at || null,
    topPercent: standing?.topPercent ?? null,
    totalUsers: standing?.totalUsers ?? null,
  }
}

// 프로필에 설정된 동료/상사/거래처를 인사평가 피드백 대상으로 정리(이름 없으면 기본 명칭)
function buildPersonas(profile) {
  return [
    { role: 'colleague', label: '동료', name: profile?.colleague_name || '동료' },
    { role: 'manager', label: '상사', name: profile?.manager_name || '상사' },
    { role: 'client', label: '거래처', name: profile?.client_name || '거래처' },
  ]
}

// 과거 daily_reports에서 반복 교정/이슈를 약점 후보로 수집
async function collectWeakPoints(sb, userId) {
  const wds = unwrap(await sb.from('workdays').select('id').eq('user_id', userId)) || []
  const ids = wds.map((w) => w.id)
  if (!ids.length) return []
  const reports = unwrap(await sb.from('daily_reports').select('corrections, recurring_issues').in('workday_id', ids)) || []
  const points = []
  for (const r of reports) {
    for (const c of r.corrections || []) {
      if (c?.before) points.push(`"${c.before}" → "${c.after || ''}" (${c.note || ''})`.trim())
    }
    for (const issue of r.recurring_issues || []) if (issue) points.push(issue)
  }
  return points
}

// LLM 실패/데이터 부족 시 기본 문제
const FALLBACK_QUESTIONS = [
  { id: 'qf1', prompt: '동료에게 "오후 3시까지 확인해줄 수 있어?"를 자연스러운 비즈니스 영어로 써보세요.', korean_hint: '정중한 요청 표현(could you ~ by 3 PM)에 유의하세요.' },
  { id: 'qf2', prompt: '거래처에 "금요일 대신 목요일에 자료를 받을 수 있을까요?"를 정중한 이메일 문장으로 써보세요.', korean_hint: '가능 여부를 묻는 완곡한 표현(Would it be possible ~)을 활용해 보세요.' },
  { id: 'qf3', prompt: '상사에게 "일정이 조금 빠듯해서 금요일 오전까지 가능합니다"를 명확하게 보고하는 문장으로 써보세요.', korean_hint: '마감 가능 시점을 분명히 전달하는 표현에 집중하세요.' },
]

// 인사평가 시작 — 평가 대상(동료/상사/거래처) + 역량평가 문제 3개(유저 수준 맞춤 LLM 생성)
export async function startEvaluation(userId) {
  const status = await getPromotionStatus(userId)
  if (!status.eligible) return { eligible: false, ...status }

  const sb = admin()
  const profile = unwrap(await sb.from('user_profiles').select('*').eq('user_id', userId).maybeSingle()) || {}

  // 진행 시작 표시(중도 포기 추적용) — 실패해도 평가 진행엔 지장 없게
  await sb
    .from('user_profiles')
    .update({ evaluation_started_at: new Date().toISOString() })
    .eq('user_id', userId)
    .then(() => {}, () => {})

  const personas = buildPersonas(profile)

  // 그동안의 고도화된 프롬프트로 이 사람 수준에 맞는 문제 생성 — 실패 시 교정 데이터/기본 문제로 대체
  let questions
  try {
    const weakPoints = await collectWeakPoints(sb, userId)
    const gen = await generateEvaluationQuestions({
      profile,
      weakPoints,
      rank: status.currentRank,
      nextRank: status.nextRank,
    })
    questions = (gen.questions || []).slice(0, 3).map((q, i) => ({
      id: `q${i + 1}`,
      prompt: q.prompt,
      korean_hint: q.korean_hint || '',
    }))
  } catch (_) {
    questions = []
  }
  while (questions.length < 3) questions.push(FALLBACK_QUESTIONS[questions.length])

  return {
    eligible: true,
    currentRank: status.currentRank,
    nextRank: status.nextRank,
    personas,
    questions: questions.slice(0, 3),
  }
}

// 제출 → 무조건 승진 + 대화상대별 만족도/개선제안 + 역량평가 문답 저장
// qna: [{ prompt, answer }] — 관리자 상세보기에서 유저가 뭐라고 답했는지 그대로 보여주기 위해 문제도 함께 저장
export async function submitEvaluation(userId, { personaFeedback, qna } = {}) {
  const sb = admin()
  const profile = unwrap(await sb.from('user_profiles').select('job_rank').eq('user_id', userId).maybeSingle())
  if (!profile) return { promoted: false, reason: 'no-profile' }

  const fromRank = profile.job_rank || '사원'
  const toRank = nextRank(fromRank)

  const feedback = Array.isArray(personaFeedback) ? personaFeedback : []
  const ratings = feedback.map((f) => Number(f?.satisfaction)).filter((n) => Number.isFinite(n) && n > 0)
  const avgSatisfaction = ratings.length ? Math.round(ratings.reduce((a, b) => a + b, 0) / ratings.length) : null

  unwrap(
    await sb
      .from('user_profiles')
      .update({
        job_rank: toRank,
        level_evaluated_at: new Date().toISOString(),
        evaluation_started_at: null,
        consecutive_days: 0,
        rank_leave_balance: RANK_LEAVE[toRank] ?? RANK_LEAVE['사원'],
        // earned_leave_balance는 의도적으로 건드리지 않음 — 승급해도 적립 연차는 유지
      })
      .eq('user_id', userId),
  )
  unwrap(
    await sb.from('promotions').insert({
      user_id: userId,
      from_rank: fromRank,
      to_rank: toRank,
      satisfaction: avgSatisfaction,
      persona_feedback: feedback.length ? feedback : null,
      test_qna: Array.isArray(qna) && qna.length ? qna : null,
    }),
  )

  return { promoted: true, fromRank, toRank, atTop: toRank === RANKS[RANKS.length - 1] }
}

// 관리자 대시보드용 — 유저별 승급 현황 계산에 쓰는 필요일 헬퍼 노출
export function requiredDaysForRank(rank) {
  return requiredDaysFor(Math.max(0, RANKS.indexOf(rank || '사원')))
}

// 인사평가에서 남긴 "이렇게 해줬으면" 제안을 실제 캐릭터 생성에 반영하기 위해, 가장 최근 인사평가의
// persona_feedback([{role, satisfaction, suggestion}])에서 역할별 제안 텍스트만 뽑아온다.
// 저장만 되고 아무 데도 안 쓰이던 걸(평가 이력 조회용) 매일 시나리오 생성 프롬프트에 실제로 반영한다.
export async function getLatestPersonaFeedback(userId) {
  const sb = admin()
  const latest = unwrap(
    await sb
      .from('promotions')
      .select('persona_feedback')
      .eq('user_id', userId)
      .order('created_at', { ascending: false })
      .limit(1)
      .maybeSingle(),
  )
  const feedback = {}
  for (const f of latest?.persona_feedback || []) {
    if (f?.role && f?.suggestion?.trim()) feedback[f.role] = f.suggestion.trim()
  }
  return feedback
}
