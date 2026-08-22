// 하루 업무 오케스트레이션 (서버 전용)
// DB(schema.sql) + LLM(server/llm) + Web Push 를 잇는다. 기획서 17장 기능 단위.
import { admin, unwrap } from './db.js'
import { sendPushToUser } from './push.js'
import { getProfile } from './profile.js'
import { getActiveSurveyForUser } from './support.js'
import { TRIAL_SCENARIO, TRIAL_CHARACTERS, TRIAL_REPLY, TRIAL_DAILY_REPORT } from './trialContent.js'
import { recordDailyAttendance, consumeLeaveForUse, getLeaveBalance, getLatestPersonaFeedback } from './promotion.js'
import { scheduleSameDayReview, scheduleNextDayReview, submitReviewAnswer, getPendingReviewBanner } from './reviewItems.js'
import {
  generateScenario,
  generateRoleMessage,
  generateRoleResponse,
  generateDailyReport,
  generatePeriodReport,
  createWorkdayMemory,
  generateOjtWelcomeEmail,
  generateVentMessage,
} from './llm/client.js'

const ORDER = { colleague: 0, manager: 1, client: 2 }
// 채널은 관계별로 항상 고정(동료/상사=메신저, 거래처=이메일) — LLM이 가끔 client를 messenger로
// 잘못 돌려주면 그날 거래처 이메일 자체가 안 생겨서 "이메일 대기중"이 안 뜨므로, 응답을 신뢰하지 않고 강제한다
const ROLE_CHANNEL = { colleague: 'messenger', manager: 'messenger', client: 'email' }
// 알림 횟수(daily_count)에 맞춰 근무시간 전체에 분산할 때의 간격 하한/상한
const MIN_ROLE_GAP_MS = 60 * 60000
const MAX_ROLE_GAP_MS = 180 * 60000
// 출퇴근시간을 촉박하게 잡아서(예: 출근 직전으로 늦게 시작) 60분 간격으로는 전부 못 들어가는 경우,
// 60분 하한을 그대로 강제하면 뒤쪽 항목들이 endDeadlineMs 캡에 몰려 서로 같은 시각에 겹쳐버린다 —
// 그래서 자연 간격이 60분보다 짧으면 최소 5분 간격으로라도 붙여서 전부 서로 다른 시각에 표시되게 한다
const MIN_SQUEEZE_GAP_MS = 5 * 60000
// 설정한 퇴근 시각이 이미 지나버린 경우(퇴근을 이른 시각으로 잡았거나, 그 시각이 지난 뒤에 출근한 경우) —
// todayAt()은 항상 "오늘 날짜의 그 시각"만 계산해서 다음날로 넘기지 않으므로, endDeadlineMs가 과거가
// 되어 span이 음수가 되고 모든 알림이 그 과거 시각(예: 새벽) 하나로 뭉쳐버린다. 이럴 땐 퇴근 시각 대신
// 지금부터 이 정도 창을 새로 잡아 정상적으로 분산시킨다.
const FALLBACK_WINDOW_MS = 4 * 60 * 60000
function computeNotifyGap(span, count) {
  if (count <= 1) return 0
  const natural = span / (count - 1)
  if (natural >= MIN_ROLE_GAP_MS) return Math.min(natural, MAX_ROLE_GAP_MS)
  return Math.max(natural, MIN_SQUEEZE_GAP_MS)
}
// 알림 횟수가 3(동료/상사/거래처)을 초과하는 만큼 랜덤 배정되는 후속 체크인 — 새 사건이 아니라 오늘 사건에 대한 가벼운 확인
// 각 템플릿에 실제 내용과 맞는 힌트를 직접 붙여둔다 — 개수가 고정(3개)이라 LLM 없이도 안전하게
// 정확한 힌트를 줄 수 있고, 예전처럼 본문 키워드로 힌트를 추측하다 엉뚱한 방향이 나가는 문제를 막는다
const CHECKIN_TEMPLATES = [
  {
    body: 'Hey, just checking in — any update on this?',
    korean_hint: '진행 상황을 가볍게 물어보는 후속 확인이에요. 지금 어디까지 됐는지, 언제 끝날지 짧게 알려주세요.',
    reply_hints: ["Still working on it — I'll have an update for you soon."],
    word_hints: [
      { en: 'update', ko: '진행 상황' },
      { en: 'in progress', ko: '진행 중' },
      { en: 'shortly', ko: '곧' },
    ],
  },
  {
    body: "Quick follow-up — how's it going on your end?",
    korean_hint: '어떻게 진행되고 있는지 캐주얼하게 물어보는 거예요. 지금 상황을 한두 마디로 알려주세요.',
    reply_hints: ['Going well — should be done by end of day.'],
    word_hints: [
      { en: 'going well', ko: '잘 되고 있다' },
      { en: 'on track', ko: '순조롭게 진행 중' },
      { en: 'end of day', ko: '오늘 중' },
    ],
  },
  {
    body: 'Just wanted to circle back on this one.',
    korean_hint: '이전에 얘기했던 건을 다시 한번 확인하는 거예요. 아직 진행 중인지, 끝났는지 알려주세요.',
    reply_hints: ["Thanks for checking — it's done, just wrapping up the details."],
    word_hints: [
      { en: 'circle back', ko: '다시 확인하다' },
      { en: 'wrap up', ko: '마무리하다' },
      { en: 'done', ko: '완료' },
    ],
  },
]
const preview = (t) => (t.replace(/\n+/g, ' ').trim().slice(0, 60))
// 영어 문장 힌트(reply_hints)는 화면 길이·복습량 때문에 정확히 1개만 써야 함 — 프롬프트에서 1개만
// 만들라고 하지만, LLM이 더 주는 경우를 대비해 저장 직전에 항상 1개로 잘라 안전장치를 둔다
const capReplyHints = (hints) => (Array.isArray(hints) && hints.length ? [hints[0]] : null)
// LLM이 korean_summary/korean_reply_points 두 필드로 나눠서 준 걸, 기존 UI가 기대하는
// "요청 요약 / 답장에 포함할 내용" 형태의 단일 문자열(korean_hint)로 합쳐서 저장한다 —
// 자유 텍스트 하나로 두면 LLM이 종종 "답장에 포함할 내용" 부분을 통째로 빼먹는 문제가 있어서
// 스키마를 두 필드로 쪼갠 것이므로, 조합은 항상 여기서 결정론적으로 한다
function formatKoreanHint(summary, points) {
  const cleanPoints = (Array.isArray(points) ? points : []).filter(Boolean)
  if (!summary && !cleanPoints.length) return null
  if (!cleanPoints.length) return summary || null
  const lines = ['요청 요약', summary || '', '', '답장에 포함할 내용', ...cleanPoints.map((p) => `"${p}"`)]
  return lines.join('\n')
}
const WORK_CONTEXT_PREFIX = '__WORK_CONTEXT_V1__:'
const encodeWorkContext = (context) => `${WORK_CONTEXT_PREFIX}${JSON.stringify(context)}`
const decodeWorkContext = (scenario) => {
  if (!scenario) return null
  if (typeof scenario.project === 'string' && scenario.project.startsWith(WORK_CONTEXT_PREFIX)) {
    try { return JSON.parse(scenario.project.slice(WORK_CONTEXT_PREFIX.length)) } catch (_) {}
  }
  return {
    titleKo: scenario.title || '',
    titleEn: scenario.title || '',
    summaryKo: scenario.summary || '',
    summaryEn: scenario.summary || '',
    goalKo: scenario.goal || '',
    goalEn: scenario.goal || '',
    stageKo: '업무 진행',
    stageEn: 'In Progress',
    topicStatus: 'active',
    roles: [],
  }
}
const routeFor = (channel, conversationId) =>
  channel === 'email' ? `/email/${conversationId}` : `/messenger/${conversationId}`

// 'HH:MM'(사용자가 입력한 한국 시간 기준 시각) → 그 시각의 실제 절대 시각(Date)
// ⚠️ Date.prototype.setHours()는 "서버 프로세스의 로컬 타임존" 기준으로 시/분을 설정한다.
// Vercel 서버리스 함수는 기본적으로 UTC로 돌아가므로, 예전엔 "오후 6시"가 UTC 18시가 되어
// 한국 시간(UTC+9)으로는 다음날 새벽 3시가 되어버렸다(사용자가 어떤 시각을 넣어도 항상 +9시간
// 밀려서 새벽대로 몰리던 버그의 원인). 한국은 서머타임이 없는 고정 UTC+9라, 서버 타임존과
// 무관하게 "오늘 날짜(한국 기준) + 그 시각 + KST 오프셋"을 직접 조합해 절대 시각을 만든다.
function todayAt(hhmm) {
  const [h, m] = (hhmm || '10:00').split(':').map(Number)
  const kstDate = new Intl.DateTimeFormat('en-CA', {
    timeZone: 'Asia/Seoul',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).format(new Date()) // "YYYY-MM-DD" (한국 기준 오늘 날짜)
  return new Date(`${kstDate}T${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}:00+09:00`)
}

async function loadProfile(userId) {
  const sb = admin()
  const row = unwrap(await sb.from('user_profiles').select('*, app_users(display_name, is_trial)').eq('user_id', userId).single())
  const { app_users, ...profile } = row
  return { ...profile, display_name: app_users?.display_name || null, is_trial: !!app_users?.is_trial }
}

// ── 출근: Workday + 시나리오 + 인물 + 대화 + 알림 예약 ──
export async function startWorkday(userId) {
  const sb = admin()
  const profile = await loadProfile(userId)
  const workDate = new Date().toISOString().slice(0, 10)

  // 오늘 workday 확보 (있으면 재사용)
  let workday = unwrap(
    await sb.from('workdays').select('*').eq('user_id', userId).eq('work_date', workDate).maybeSingle(),
  )
  if (!workday) {
    // 승급/연차 정산은 실제 출근이 처음 기록되는 이 시점에만(같은 날 재조회로는 반복 실행되지 않게) 처리
    if (!profile.is_trial) {
      const lastWorkday = unwrap(
        await sb.from('workdays').select('work_date').eq('user_id', userId).lt('work_date', workDate).order('work_date', { ascending: false }).limit(1).maybeSingle(),
      )
      await recordDailyAttendance(userId, lastWorkday?.work_date || null, workDate).catch(() => {})
    }
    workday = unwrap(
      await sb.from('workdays').insert({ user_id: userId, work_date: workDate, state: 'COMMUTING', started_at: new Date().toISOString() }).select().single(),
    )
  } else {
    if (['OFF_DUTY', 'DONE', 'ON_LEAVE', 'HALF_DAY'].includes(workday.state)) return { workday, reused: true }
    // 이 함수는 화면 조회/폴링마다(45초마다) 호출되는데, 이미 진행 중인 근무일의 started_at을
    // 매번 "지금"으로 덮어쓰면 근무 시간이 계속 0에 가깝게 리셋돼서 절대 누적되지 않았다 —
    // state만 필요할 때 바로잡고, started_at은 처음 출근했을 때 값을 그대로 둔다.
    if (workday.state !== 'COMMUTING') {
      workday = unwrap(await sb.from('workdays').update({ state: 'COMMUTING' }).eq('id', workday.id).select().single())
    }
  }

  // 이미 시나리오가 있으면 그대로
  const existing = unwrap(await sb.from('scenarios').select('id').eq('workday_id', workday.id).maybeSingle())
  if (existing) return { workday, reused: true }

  // "1분 체험하기" 게스트는 LLM 호출 없이 항상 같은 고정 시나리오를 즉시 보여준다
  // — 캐릭터 3명분을 하나씩 순차로 insert하면 왕복이 12번 넘게 쌓여 "다음" 버튼이 눈에 띄게 느려지므로,
  // 테이블별로 한 번에 batch insert해서 왕복 횟수를 줄인다
  if (profile.is_trial) {
    const scenario = unwrap(
      await sb.from('scenarios').insert({
        workday_id: workday.id,
        title: TRIAL_SCENARIO.title,
        summary: TRIAL_SCENARIO.summary,
        project: encodeWorkContext({
          titleKo: TRIAL_SCENARIO.title,
          titleEn: 'Responding to a Client DVD Shipment Delay',
          summaryKo: TRIAL_SCENARIO.summary,
          summaryEn: 'A client shipment is delayed by one day, and the same issue must be coordinated with a colleague, a manager, and the client in different registers.',
          goalKo: TRIAL_SCENARIO.goal,
          goalEn: 'Explain the delay internally, report it clearly to the manager, and coordinate politely with the client.',
          stageKo: '지연 안내 및 일정 조율',
          stageEn: 'Delay Notice and Schedule Coordination',
          topicStatus: 'active',
          roles: TRIAL_CHARACTERS.map((c) => ({
            role: c.role,
            name: c.name,
            purposeKo: c.purposeKo,
            purposeEn: c.purposeEn,
          })),
        }),
        goal: TRIAL_SCENARIO.goal,
        practice_areas: TRIAL_SCENARIO.practice_areas,
      }).select().single(),
    )

    const characters = unwrap(
      await sb.from('characters').insert(
        TRIAL_CHARACTERS.map((c) => ({
          scenario_id: scenario.id,
          role: c.role,
          channel: c.channel,
          name: c.name,
          title: c.title,
          register: c.register,
          color: c.color,
        })),
      ).select(),
    )
    const characterByRole = new Map(characters.map((ch) => [ch.role, ch]))

    const scheduledAt = new Date().toISOString()
    const conversations = unwrap(
      await sb.from('conversations').insert(
        TRIAL_CHARACTERS.map((c) => ({
          workday_id: workday.id,
          character_id: characterByRole.get(c.role).id,
          channel: c.channel,
          subject: c.subject || null,
          status: 'awaiting',
          scheduled_at: scheduledAt,
        })),
      ).select(),
    )
    const convoByCharacterId = new Map(conversations.map((cv) => [cv.character_id, cv]))

    unwrap(
      await sb.from('messages').insert(
        TRIAL_CHARACTERS.map((c) => ({
          conversation_id: convoByCharacterId.get(characterByRole.get(c.role).id).id,
          sender: 'character',
          body: c.firstMessage,
          subject: c.subject || null,
          seq: 1,
        })),
      ),
    )
    unwrap(
      await sb.from('notification_schedules').insert(
        TRIAL_CHARACTERS.map((c) => {
          const convo = convoByCharacterId.get(characterByRole.get(c.role).id)
          return {
            workday_id: workday.id,
            conversation_id: convo.id,
            scheduled_at: scheduledAt,
            status: 'sent',
            title: `${c.name} · ${roleLabel(c.role)}`,
            preview: preview(c.firstMessage),
            route: routeFor(c.channel, convo.id),
            sent_at: scheduledAt,
          }
        }),
      ),
    )

    const created = TRIAL_CHARACTERS.map((c) => {
      const convo = convoByCharacterId.get(characterByRole.get(c.role).id)
      return { id: convo.id, role: c.role, name: c.name, channel: c.channel, scheduled_at: scheduledAt }
    })

    return { workday, scenario, conversations: created }
  }

  // 전날 요약(연속성)
  const memory = unwrap(
    await sb.from('workday_memories').select('summary').eq('user_id', userId).order('created_at', { ascending: false }).limit(1).maybeSingle(),
  )

  // 가장 최근에 지나간 workday가 반차/연차였는지 확인 (동료의 복귀 인사용)
  const lastPastWorkday = unwrap(
    await sb.from('workdays').select('state, leave_kind').eq('user_id', userId).lt('work_date', workDate).order('work_date', { ascending: false }).limit(1).maybeSingle(),
  )
  const returningFromLeave = ['HALF_DAY', 'ON_LEAVE'].includes(lastPastWorkday?.state) ? lastPastWorkday.leave_kind : null

  const resetRoles = profile.pending_persona_reset || []
  const personaFeedback = profile.is_trial ? {} : await getLatestPersonaFeedback(userId).catch(() => ({}))
  const gen = await generateScenario({ profile, previousMemory: memory?.summary || null, resetRoles, personaFeedback })
  for (const c of gen.characters) c.channel = ROLE_CHANNEL[c.role] || c.channel
  // 리셋은 오늘 시나리오 생성에 한 번 반영되면 소진 — 다음 출근일부턴 다시 정상 연속성으로 돌아간다
  if (resetRoles.length) {
    await sb.from('user_profiles').update({ pending_persona_reset: [] }).eq('user_id', userId).then(() => {}, () => {})
  }

  if (returningFromLeave) {
    const leaveLabel = returningFromLeave === 'annual' ? 'a day of annual leave' : 'a half-day off'
    const colleague = gen.characters.find((c) => c.role === 'colleague')
    if (colleague) {
      colleague.known_info = `${colleague.known_info ? colleague.known_info + ' ' : ''}The user just came back from ${leaveLabel}. Before getting into work, greet them warmly and tease them lightly about it in ONE short line (e.g. ask how it was, say you missed them, jokingly ask if they brought back a souvenir/gift) — then move into today's topic naturally.`.trim()
    }
  }

  const scenario = unwrap(
  await sb.from('scenarios').insert({
    workday_id: workday.id,
    title: gen.title_en,
    summary: gen.summary_en,
    project: encodeWorkContext({
      titleKo: gen.title_ko,
      titleEn: gen.title_en,
      summaryKo: gen.summary_ko,
      summaryEn: gen.summary_en,
      goalKo: gen.goal_ko,
      goalEn: gen.goal_en,
      stageKo: gen.stage_ko,
      stageEn: gen.stage_en,
      topicStatus: gen.topic_status,
      roles: gen.characters.map((c) => ({
        role: c.role,
        name: c.name,
        purposeKo: c.purpose_ko,
        purposeEn: c.purpose_en,
      })),
    }),
    goal: gen.goal_en,
    practice_areas: gen.practice_areas,
  }).select().single(),
)

  // 연락 예약 시간: 근무 시작+유예 후부터 퇴근-30분까지 전체에, 알림 횟수(daily_count)만큼 고르게 분산.
  // 간격은 근무시간 길이에 비례해서 자동으로 늘어나되(최소 60분/최대 180분 캡), 고정 60분이 아니게 함
  const count = Math.min(Math.max(profile.daily_count || 3, 3), 6)
  const startMs = Math.max(Date.now() + 10 * 60000, todayAt(profile.start_time).getTime() + 10 * 60000)
  let endDeadlineMs = todayAt(profile.end_time).getTime() - 30 * 60000
  if (endDeadlineMs <= startMs) {
    // 대체 창도 자정을 넘기면 "내일 새벽 2시" 같은 시각이 나와 오늘 연락인데 날짜가 다음날로 보이므로,
    // 오늘 자정 전까지로 한 번 더 잘라낸다(자정이 임박한 극단적인 경우엔 최소 30분만 확보)
    endDeadlineMs = Math.min(startMs + FALLBACK_WINDOW_MS, todayAt('23:59').getTime())
    if (endDeadlineMs <= startMs) endDeadlineMs = startMs + 30 * 60000
  }
  const span = endDeadlineMs - startMs
  const gap = computeNotifyGap(span, count)
  // 역할별로 설정에서 직접 지정한 알림 시각이 있으면 그걸 쓰고, 이미 지난 시각이면 "지금+10분"으로 대체
  const roleCustomTime = (role) => profile[`${role}_notify_time`]
  const resolveScheduledAt = (role, autoMs) => {
    const custom = roleCustomTime(role)
    if (!custom) return autoMs
    const customMs = todayAt(custom).getTime()
    return customMs > Date.now() ? customMs : Date.now() + 10 * 60000
  }

  const chars = [...gen.characters].sort((a, b) => ORDER[a.role] - ORDER[b.role])
  const created = []
  const characterByRole = {}
  // 동료가 그날의 첫 연락이어야 자연스러운 대화 흐름이 됨 — 상사/거래처가 알림 시각을 직접
  // 지정해서 동료보다 앞서게 되는 경우, 동료 시각 이후로 강제로 밀어서 순서를 지킨다
  let colleagueScheduledMs = null
  for (let i = 0; i < chars.length; i++) {
    const c = chars[i]
    const character = unwrap(
      await sb.from('characters').insert({
        scenario_id: scenario.id,
        role: c.role,
        channel: c.channel,
        name: c.name,
        title: c.title,
        register: c.register,
        goal: c.goal,
        known_info: c.known_info,
        unknown_info: c.unknown_info,
      }).select().single(),
    )
    characterByRole[c.role] = character
    let resolvedMs = resolveScheduledAt(c.role, startMs + i * gap)
    if (c.role === 'colleague') {
      colleagueScheduledMs = resolvedMs
    } else if (colleagueScheduledMs != null && resolvedMs <= colleagueScheduledMs) {
      resolvedMs = colleagueScheduledMs + MIN_ROLE_GAP_MS
    }
    // 근무 마감 시각을 넘어서 예정 잡히면 "오전 12시" 같은 다음날처럼 보이는 시각이 나와서
    // 절대 근무 마감(endDeadlineMs)을 넘지 않게 캡을 씌운다
    resolvedMs = Math.min(resolvedMs, endDeadlineMs)
    const scheduledAt = new Date(resolvedMs).toISOString()
    const convo = unwrap(
      await sb.from('conversations').insert({
        workday_id: workday.id,
        character_id: character.id,
        channel: c.channel,
        status: 'scheduled',
        scheduled_at: scheduledAt,
      }).select().single(),
    )
    unwrap(
      await sb.from('notification_schedules').insert({
        workday_id: workday.id,
        conversation_id: convo.id,
        scheduled_at: scheduledAt,
        status: 'scheduled',
        title: `${c.name} · ${roleLabel(c.role)}`,
        route: routeFor(c.channel, convo.id),
      }),
    )
    created.push({ id: convo.id, role: c.role, name: c.name, channel: c.channel, scheduled_at: scheduledAt })
  }

  // 유저가 Settings에서 아직 이름을 안 고정한 역할은, 오늘 LLM이 만든 이름을 그대로 프로필에 저장해서
  // 내일부터 buildCharacterPresetLines가 같은 사람으로 고정 생성하게 한다("매일 다른 사람" 방지 기본값)
  const nameLock = {}
  for (const role of ['colleague', 'manager', 'client']) {
    if (!profile[`${role}_name`] && characterByRole[role]) nameLock[`${role}_name`] = characterByRole[role].name
  }
  if (Object.keys(nameLock).length) {
    await sb.from('user_profiles').update(nameLock).eq('user_id', userId).then(() => {}, () => {})
  }

  // 알림 횟수가 기본 3건을 초과하는 만큼은 동료/상사/거래처 중 매일 무작위로 추가 배정 —
  // 새 사건이 아니라 오늘 사건에 대한 후속 체크인이라 채점/리포트 대상 아님(kind: 'checkin')
  const extraCount = count - chars.length
  for (let i = 0; i < extraCount; i++) {
    const pick = chars[Math.floor(Math.random() * chars.length)]
    const character = characterByRole[pick.role]
    // 여기도 근무 마감을 넘기지 않게 캡(위와 동일한 이유)
    const scheduledAt = new Date(Math.min(startMs + (chars.length + i) * gap, endDeadlineMs)).toISOString()
    const template = CHECKIN_TEMPLATES[Math.floor(Math.random() * CHECKIN_TEMPLATES.length)]
    const convo = unwrap(
      await sb.from('conversations').insert({
        workday_id: workday.id,
        character_id: character.id,
        channel: pick.channel,
        kind: 'checkin',
        status: 'scheduled',
        scheduled_at: scheduledAt,
      }).select().single(),
    )
    unwrap(
      await sb.from('messages').insert({
        conversation_id: convo.id,
        sender: 'character',
        body: template.body,
        seq: 1,
        korean_hint: template.korean_hint,
        reply_hints: template.reply_hints,
        word_hints: template.word_hints,
      }),
    )
    unwrap(
      await sb.from('notification_schedules').insert({
        workday_id: workday.id,
        conversation_id: convo.id,
        scheduled_at: scheduledAt,
        status: 'scheduled',
        title: `${pick.name} · ${roleLabel(pick.role)}`,
        route: routeFor(pick.channel, convo.id),
      }),
    )
    created.push({ id: convo.id, role: pick.role, name: pick.name, channel: pick.channel, scheduled_at: scheduledAt })
  }

  // ── 신입사원 온보딩(OJT) 첫날: 이 유저의 진짜 첫 workday면 HR 웰컴 이메일을 제일 먼저 얹는다 ──
  const isFirstEverWorkday = !unwrap(
    await sb.from('workdays').select('id').eq('user_id', userId).lt('work_date', workDate).limit(1).maybeSingle(),
  )
  if (isFirstEverWorkday) {
    const hrCharacter = unwrap(
      await sb.from('characters').insert({
        scenario_id: scenario.id,
        role: 'hr',
        channel: 'email',
        name: 'HR Team',
        title: 'People Team',
        register: 'warm, welcoming, still professional',
        goal: "Welcome the brand-new hire on their first day, cover first-day/OJT-week logistics, naturally drop ONE workplace-specific term or internal acronym the user wouldn't know yet (without explaining it), and ask something that needs a reply.",
        known_info: `Industry: ${profile.industry || 'unknown'}. Role: ${profile.job_role || 'unknown'}. This is the user's literal first day at the company — the OJT (on-the-job training) week is just starting.`,
        unknown_info: '',
      }).select().single(),
    )
    // 정규 연락(base)보다 먼저 도착하도록 예약 — "출근하자마자 받는 웰컴 메일" 연출
    const hrScheduledAt = new Date(Date.now() + 2 * 60000).toISOString()
    const hrConvo = unwrap(
      await sb.from('conversations').insert({
        workday_id: workday.id,
        character_id: hrCharacter.id,
        channel: 'email',
        kind: 'ojt',
        status: 'scheduled',
        scheduled_at: hrScheduledAt,
      }).select().single(),
    )
    unwrap(
      await sb.from('notification_schedules').insert({
        workday_id: workday.id,
        conversation_id: hrConvo.id,
        scheduled_at: hrScheduledAt,
        status: 'scheduled',
        title: `${hrCharacter.name} · ${roleLabel('hr')}`,
        route: routeFor('email', hrConvo.id),
      }),
    )
    created.unshift({ id: hrConvo.id, role: 'hr', name: hrCharacter.name, channel: 'email', scheduled_at: hrScheduledAt })
  }

  // 어제(또는 그 이전) 어려웠던 표현이 있으면, 오늘자로 익일 복습 1건을 배정(FIFO, 최대 1건)
  await scheduleNextDayReview({ userId, workday }).catch(() => {})

  return { workday, scenario, conversations: created }
}

// Settings에서 출퇴근시간을 바꿨을 때, 오늘 이미 잡혀있지만 아직 발송 안 된(scheduled) 연락들의
// 시각을 새 출퇴근시간 기준으로 다시 계산한다 — startWorkday의 간격 공식을 그대로 재사용,
// 다만 이미 만들어둔 연락 개수만큼만 새로 고르게 분산(체크인/복습 등 종류 구분 없이 전부 대상)
export async function rescheduleTodayNotifications(userId) {
  const sb = admin()
  const profile = await loadProfile(userId)
  if (profile.is_trial) return { skipped: true, reason: 'trial' }

  const workDate = new Date().toISOString().slice(0, 10)
  const workday = unwrap(await sb.from('workdays').select('id, state').eq('user_id', userId).eq('work_date', workDate).maybeSingle())
  if (!workday) return { skipped: true, reason: 'no-workday' }
  if (['OFF_DUTY', 'DONE', 'ON_LEAVE', 'HALF_DAY'].includes(workday.state)) return { skipped: true, reason: 'workday-closed' }

  const pending = unwrap(
    await sb
      .from('conversations')
      .select('id, scheduled_at, characters(role)')
      .eq('workday_id', workday.id)
      .eq('status', 'scheduled')
      .order('scheduled_at'),
  ) || []
  if (!pending.length) return { skipped: true, reason: 'nothing-pending' }

  const count = pending.length
  const startMs = Math.max(Date.now() + 10 * 60000, todayAt(profile.start_time).getTime() + 10 * 60000)
  let endDeadlineMs = todayAt(profile.end_time).getTime() - 30 * 60000
  if (endDeadlineMs <= startMs) {
    endDeadlineMs = Math.min(startMs + FALLBACK_WINDOW_MS, todayAt('23:59').getTime())
    if (endDeadlineMs <= startMs) endDeadlineMs = startMs + 30 * 60000
  }
  const span = endDeadlineMs - startMs
  const gap = computeNotifyGap(span, count)
  const roleCustomTime = (role) => profile[`${role}_notify_time`]
  const resolveScheduledAt = (role, autoMs) => {
    const custom = roleCustomTime(role)
    if (!custom) return autoMs
    const customMs = todayAt(custom).getTime()
    return customMs > Date.now() ? customMs : Date.now() + 10 * 60000
  }

  const rescheduled = []
  for (let i = 0; i < pending.length; i++) {
    const c = pending[i]
    const role = c.characters?.role
    let resolvedMs = resolveScheduledAt(role, startMs + i * gap)
    resolvedMs = Math.max(resolvedMs, Date.now() + 60000) // 과거 시각으로는 절대 안 잡히게
    resolvedMs = Math.min(resolvedMs, endDeadlineMs)
    const scheduledAt = new Date(resolvedMs).toISOString()
    unwrap(await sb.from('conversations').update({ scheduled_at: scheduledAt }).eq('id', c.id))
    unwrap(
      await sb.from('notification_schedules').update({ scheduled_at: scheduledAt }).eq('conversation_id', c.id).eq('status', 'scheduled'),
    )
    rescheduled.push({ id: c.id, scheduledAt })
  }
  return { rescheduled: rescheduled.length }
}

function roleLabel(role) {
  return role === 'colleague' ? '동료' : role === 'manager' ? '상사' : role === 'hr' ? '인사팀' : '거래처'
}

// ── 대화 최초 메시지 발송 (generateRoleMessage) + 푸시 ──
export async function deliverConversation(conversationId) {
  const sb = admin()
  const convo = unwrap(await sb.from('conversations').select('*').eq('id', conversationId).single())
  if (convo.status !== 'scheduled') return { skipped: true }

  const character = unwrap(await sb.from('characters').select('*').eq('id', convo.character_id).single())
  const workday = unwrap(await sb.from('workdays').select('user_id').eq('id', convo.workday_id).single())

  // '복습'/'후속 체크인' 대화는 생성 시점에 이미 메시지를 넣어뒀으므로, LLM 재생성 없이 상태만 넘긴다
  if (convo.kind === 'review' || convo.kind === 'checkin') {
    const existing = unwrap(await sb.from('messages').select('*').eq('conversation_id', convo.id).order('seq')) || []
    const firstMsg = existing[0]
    const label = convo.kind === 'review' ? '복습' : roleLabel(character.role)
    unwrap(await sb.from('conversations').update({ status: 'awaiting' }).eq('id', convo.id))
    unwrap(
      await sb.from('notification_schedules').update({ status: 'sent', sent_at: new Date().toISOString(), preview: preview(firstMsg?.body) }).eq('conversation_id', convo.id),
    )
    await sendPushToUser(workday.user_id, {
      title: `${character.name} · ${label}`,
      body: preview(firstMsg?.body),
      url: routeFor(convo.channel, convo.id),
    })
    return { delivered: true, conversationId: convo.id, role: character.role, name: character.name, channel: convo.channel }
  }

  const scenario = unwrap(await sb.from('scenarios').select('*').eq('id', character.scenario_id).single())
  const profile = await loadProfile(workday.user_id)

  // 크론 발송과 "연락 바로 받기" 수동 클릭이 같은 대화를 동시에 집으면 메시지가 중복되거나,
  // LLM 생성 도중 하나가 실패해도 status만 넘어가 메시지 없이 'awaiting'으로 남는 문제가 생길 수 있다 —
  // 그래서 LLM 호출 전에 "내가 발송 권한을 가져왔다"를 원자적으로 먼저 확정(claim)해두고,
  // 실패하면 아래 catch에서 되돌려 다음 기회(크론/재클릭)에 다시 시도되게 한다
  const claimed = unwrap(
    await sb.from('conversations').update({ status: 'awaiting' }).eq('id', convo.id).eq('status', 'scheduled').select(),
  )
  if (!claimed?.length) return { skipped: true, reason: 'already-claimed' }

  try {
    const msg = character.role === 'hr'
      ? await generateOjtWelcomeEmail({ profile })
      : await generateRoleMessage({ scenario, character, profile })

    unwrap(
      await sb.from('messages').insert({
        conversation_id: convo.id,
        sender: 'character',
        body: msg.body,
        subject: msg.subject || null,
        seq: 1,
        korean_hint: formatKoreanHint(msg.korean_summary, msg.korean_reply_points),
        reply_hints: capReplyHints(msg.reply_hints),
        word_hints: msg.word_hints || null,
      }),
    )
    const subject = character.channel === 'email' ? msg.subject || null : null
    unwrap(await sb.from('conversations').update({ subject }).eq('id', convo.id))
    unwrap(
      await sb.from('notification_schedules').update({ status: 'sent', sent_at: new Date().toISOString(), preview: preview(msg.body) }).eq('conversation_id', convo.id),
    )

    await sendPushToUser(workday.user_id, {
      title: character.channel === 'email' ? `새 이메일 — ${msg.subject || ''}` : `${character.name} · ${roleLabel(character.role)}`,
      body: preview(msg.body),
      url: routeFor(character.channel, convo.id),
    })

    return {
      delivered: true,
      conversationId: convo.id,
      role: character.role,
      name: character.name,
      channel: character.channel,
      subject: subject,
      body: msg.body,
      korean_hint: formatKoreanHint(msg.korean_summary, msg.korean_reply_points),
      reply_hints: msg.reply_hints,
      word_hints: msg.word_hints,
    }
  } catch (err) {
    await sb.from('conversations').update({ status: 'scheduled' }).eq('id', convo.id).then(() => {}, () => {})
    throw err
  }
}

// ── 시연/실사용: 예약시간 지난 알림 일괄 발송 (cron) ──
export async function deliverDueNotifications() {
  const sb = admin()
  const due = unwrap(
    await sb.from('notification_schedules').select('conversation_id').eq('status', 'scheduled').lte('scheduled_at', new Date().toISOString()),
  ) || []
  let count = 0
  for (const n of due) {
    try {
      const r = await deliverConversation(n.conversation_id)
      if (r.delivered) count++
    } catch (_) {
      await sb.from('notification_schedules').update({ status: 'failed' }).eq('conversation_id', n.conversation_id)
    }
  }
  return { delivered: count, checked: due.length }
}

// ── 시연: 오늘 workday의 다음 예약 대화 즉시 발송 ──
// filter.role/filter.kind를 주면 그 조건에 맞는 것 중 가장 이른 예정 건을 골라 발송한다 —
// 시연 영상을 역할별로 따로 찍을 때, 큐 순서와 무관하게 원하는 역할을 바로 불러오기 위함
export async function deliverNextForUser(userId, filter = {}) {
  const sb = admin()
  const workDate = new Date().toISOString().slice(0, 10)
  const workday = unwrap(
    await sb.from('workdays').select('id').eq('user_id', userId).eq('work_date', workDate).maybeSingle(),
  )
  if (!workday) return { skipped: true, reason: 'no-workday' }

  if (!filter.role && !filter.kind) {
    const next = unwrap(
      await sb.from('conversations').select('id').eq('workday_id', workday.id).eq('status', 'scheduled').order('scheduled_at').limit(1).maybeSingle(),
    )
    if (!next) return { skipped: true, reason: 'all-delivered' }
    return deliverConversation(next.id)
  }

  let query = sb
    .from('conversations')
    .select('id, characters(role)')
    .eq('workday_id', workday.id)
    .eq('status', 'scheduled')
  if (filter.kind) query = query.eq('kind', filter.kind)
  const rows = unwrap(await query.order('scheduled_at')) || []
  const match = filter.role ? rows.find((r) => r.characters?.role === filter.role) : rows[0]
  if (!match) return { skipped: true, reason: 'all-delivered' }
  return deliverConversation(match.id)
}

// ── 외근: 아직 안 보낸 오늘의 연락을 뒤로 미룸 (기존 대화·턴 수는 그대로 유지) ──
const FIELD_WORK_DELAY_MIN = 30

export async function goOnFieldWork(userId, delayMinutes = FIELD_WORK_DELAY_MIN, source = 'app') {
  const sb = admin()
  const workDate = new Date().toISOString().slice(0, 10)
  const workday = unwrap(
    await sb.from('workdays').select('id, state').eq('user_id', userId).eq('work_date', workDate).maybeSingle(),
  )
  if (!workday) return { skipped: true, reason: 'no-workday' }
  if (['OFF_DUTY', 'DONE', 'ON_LEAVE', 'HALF_DAY'].includes(workday.state)) return { skipped: true, reason: 'workday-closed' }

  const pending = unwrap(
    await sb.from('conversations').select('id, scheduled_at').eq('workday_id', workday.id).eq('status', 'scheduled'),
  ) || []

  // 미룰 연락이 없어도 "외근 중"을 눌렀다는 것 자체가 바쁘다는 신호이므로, 스트레스 감지(comfort ping)
  // 카운트에는 반영한다. 관리자 대시보드용 이력이기도 해서 실패해도 외근 처리 자체는 성공으로 취급.
  try {
    await sb.from('field_work_events').insert({ user_id: userId, workday_id: workday.id, source })
  } catch (_) {}

  if (!pending.length) return { skipped: true, reason: 'nothing-pending' }

  const delayMs = delayMinutes * 60000
  const rescheduled = []
  for (const c of pending) {
    const newTime = new Date(new Date(c.scheduled_at).getTime() + delayMs).toISOString()
    unwrap(await sb.from('conversations').update({ scheduled_at: newTime }).eq('id', c.id))
    unwrap(await sb.from('notification_schedules').update({ scheduled_at: newTime }).eq('conversation_id', c.id).eq('status', 'scheduled'))
    rescheduled.push({ conversationId: c.id, newScheduledAt: newTime })
  }
  return { fieldWork: true, delayMinutes, rescheduled }
}

// ── 반차/연차/출근취소 ──
// cancel: 출근 직후 유예 시간(COMMUTING)에만 가능 — 오늘 workday를 통째로 되돌림
// half_day/annual: 남은 예정 연락을 건너뛰고 하루를 그 상태로 마감
export async function takeLeave(userId, kind) {
  const sb = admin()
  const workDate = new Date().toISOString().slice(0, 10)
  const workday = unwrap(
    await sb.from('workdays').select('*').eq('user_id', userId).eq('work_date', workDate).maybeSingle(),
  )
  if (!workday) return { skipped: true, reason: 'no-workday' }
  if (['OFF_DUTY', 'DONE', 'ON_LEAVE', 'HALF_DAY'].includes(workday.state)) {
    return { skipped: true, reason: 'already-closed' }
  }

  if (kind === 'cancel') {
    if (workday.state !== 'COMMUTING') return { skipped: true, reason: 'cancel-window-closed' }
    unwrap(await sb.from('workdays').delete().eq('id', workday.id))
    return { cancelled: true }
  }

  if (kind !== 'half_day' && kind !== 'annual') {
    throw Object.assign(new Error(`알 수 없는 leave kind: ${kind}`), { status: 400 })
  }

  if (kind === 'annual') {
    const result = await consumeLeaveForUse(userId)
    if (!result.ok) return { skipped: true, reason: 'no-leave-balance' }
  }

  unwrap(await sb.from('conversations').update({ status: 'done' }).eq('workday_id', workday.id).eq('status', 'scheduled'))
  unwrap(await sb.from('notification_schedules').update({ status: 'skipped' }).eq('workday_id', workday.id).eq('status', 'scheduled'))

  const newState = kind === 'annual' ? 'ON_LEAVE' : 'HALF_DAY'
  unwrap(await sb.from('workdays').update({ state: newState, ended_at: new Date().toISOString(), leave_kind: kind }).eq('id', workday.id))
  unwrap(await sb.from('leave_records').insert({ user_id: userId, workday_id: workday.id, kind }))

  return { leave: true, kind, state: newState }
}

// ── 사용자 답변 → 후속 반응(generateRoleResponse) + 푸시 ──
// 사용자가 대화를 열어봤을 때 호출 — read_at을 지금 시각으로 찍어서 미읽음 뱃지를 지운다
export async function markConversationRead(conversationId) {
  const sb = admin()
  unwrap(await sb.from('conversations').update({ read_at: new Date().toISOString() }).eq('id', conversationId))
}

export async function submitReply(conversationId, userText, userSubject = null, hintLevel = null, hintSentence = null) {
  const sb = admin()
  const convo = unwrap(await sb.from('conversations').select('*').eq('id', conversationId).single())
  // 'vent'(고함항아리) 대화는 이 업무 시나리오 답변 경로가 아니라 sendVentMessage로 처리해야 함
  if (convo.kind === 'vent') return { skipped: true, reason: 'use-vent-message' }
  // '복습' 대화는 채점/후속 반응 없이 제출하면 바로 완료 처리(정답 여부 무관)
  if (convo.kind === 'review') return submitReviewAnswer(convo, userText)
  if (convo.status !== 'awaiting') return { skipped: true, reason: 'not-awaiting' }

  // convo만 있으면 바로 조회 가능한 3개는 서로 독립적이라 병렬로 — 응답 속도 개선(체감 지연의 주 원인)
  const [history, character, workday] = await Promise.all([
    sb.from('messages').select('*').eq('conversation_id', convo.id).order('seq').then((r) => unwrap(r) || []),
    sb.from('characters').select('*').eq('id', convo.character_id).single().then(unwrap),
    sb.from('workdays').select('id, user_id').eq('id', convo.workday_id).single().then(unwrap),
  ])
  const nextSeq = (history[history.length - 1]?.seq || 0) + 1

  // character/workday 결과가 있어야 조회 가능한 2개도 서로 독립적이라 병렬로
  const [scenario, profile] = await Promise.all([
    sb.from('scenarios').select('*').eq('id', character.scenario_id).single().then(unwrap),
    loadProfile(workday.user_id),
  ])

  // 사용자 메시지 저장 + 대화 상태 갱신은 서로 독립적이라 병렬로, 그리고 LLM 호출을 기다리지 않고 동시에 진행
  const insertUserMessagePromise = sb.from('messages').insert({
    conversation_id: convo.id,
    sender: 'user',
    body: userText,
    subject: userSubject,
    seq: nextSeq,
    hint_level: hintLevel === 'word' || hintLevel === 'sentence' ? hintLevel : null,
  }).then((r) => unwrap(r))
  const markRepliedPromise = sb.from('conversations').update({ status: 'replied' }).eq('id', convo.id).then((r) => unwrap(r))

  // 한국어 힌트까지만 봤으면 정상, 단어/문장 힌트까지 봤으면 "어려웠던 문항" — 당일(+익일) 복습 스케줄링.
  // 클라이언트 응답을 지연시키지 않도록 캐릭터 응답 생성(LLM 호출)과 동시에 진행하고, 함수가 끝나기 전에만 await한다
  const reviewSchedulePromise =
    !profile.is_trial &&
    (convo.kind === 'scenario' || convo.kind === 'checkin') &&
    (hintLevel === 'word' || hintLevel === 'sentence')
      ? scheduleSameDayReview({
          userId: workday.user_id,
          workday,
          profile,
          character,
          hintLevel,
          originalMessage: history[history.length - 1]?.body || '',
          answerSentence: hintSentence || history[history.length - 1]?.body || '',
        }).catch(() => {})
      : null

  // HR 웰컴 메일은 유저가 인사 답장을 한 번 보내면 그걸로 끝 — 후속 메일 없이 바로 대화 종료
  if (character.role === 'hr') {
    await Promise.all([insertUserMessagePromise, markRepliedPromise])
    await sb.from('conversations').update({ status: 'done' }).eq('id', convo.id).then((r) => unwrap(r))
    if (reviewSchedulePromise) await reviewSchedulePromise
    return { reaction_type: 'close', needs_followup: false, conversation_status: 'done', body: null, subject: null, korean_hint: null, reply_hints: [], word_hints: [] }
  }

  // 유저가 한 번 답장하면 그걸로 완료 — 계속 답장을 주고받아야 끝나는 구조가 아니라,
  // 매 답장을 항상 "마지막 턴"으로 취급해 캐릭터가 자연스럽게 마무리하고 더 안 붙잡는다
  const isFinalTurn = true

  // "1분 체험하기" 게스트는 LLM 채점 없이 항상 같은 확인 답장으로 마무리
  let resp
  if (profile.is_trial) {
    resp = TRIAL_REPLY
  } else {
    const historyWithReply = [...history, { sender: 'user', body: userText }]
    resp = await generateRoleResponse({ scenario, character, history: historyWithReply, userReply: userText, profile, isFinalTurn })
  }

  // 위에서 병렬로 던진 저장 작업들이 아직 안 끝났을 수 있으니 여기서 합류
  await Promise.all([insertUserMessagePromise, markRepliedPromise])

  // 유저 답장 한 번이면 항상 완료 처리(더 이상 대기 상태로 안 남김)
  const nextStatus = 'done'
  await Promise.all([
    sb.from('messages').insert({
      conversation_id: convo.id,
      sender: 'character',
      body: resp.body,
      subject: resp.subject || null,
      seq: nextSeq + 1,
      korean_hint: formatKoreanHint(resp.korean_summary, resp.korean_reply_points),
      reply_hints: capReplyHints(resp.reply_hints),
      word_hints: resp.word_hints || null,
    }).then((r) => unwrap(r)),
    sb.from('conversations').update({ status: nextStatus }).eq('id', convo.id).then((r) => unwrap(r)),
  ])

  if (reviewSchedulePromise) await reviewSchedulePromise

  // 푸시를 여기서 먼저 보내면, 답을 보낸 유저 본인 화면에 그 답장이 뜨기도 전에 알림이 먼저 뜨는 순서
  // 역전이 생김(같은 요청 안에서 push가 응답보다 먼저 끝남) — 그래서 push 발송은 호출부(api/reply.js)가
  // 클라이언트에 응답을 다 보낸 "다음"에 하도록 payload만 반환하고 실제 발송은 미룬다
  return {
    reaction_type: resp.reaction_type,
    needs_followup: resp.needs_followup,
    conversation_status: nextStatus,
    subject: resp.subject || null,
    body: resp.body,
    korean_hint: formatKoreanHint(resp.korean_summary, resp.korean_reply_points),
    reply_hints: resp.reply_hints,
    word_hints: resp.word_hints,
    _push: {
      userId: workday.user_id,
      title: `${character.name}님이 회신했습니다`,
      body: preview(resp.body),
      url: routeFor(character.channel, convo.id),
    },
  }
}

// ── 마음 편하게 말 걸기(vent) — 유저가 동료에게 먼저 캐주얼하게 말 거는 채널.
// 업무 시나리오/채점 대상이 아니라서 리포트에는 안 들어감(closeWorkday가 kind='scenario'만 조회).
async function getOrCreateVentConversation(sb, workday) {
  const existing = unwrap(
    await sb.from('conversations').select('*').eq('workday_id', workday.id).eq('kind', 'vent').maybeSingle(),
  )
  if (existing) return existing

  const scenario = unwrap(await sb.from('scenarios').select('id').eq('workday_id', workday.id).single())
  const colleague = unwrap(
    await sb.from('characters').select('*').eq('scenario_id', scenario.id).eq('role', 'colleague').single(),
  )
  return unwrap(
    await sb
      .from('conversations')
      .insert({ workday_id: workday.id, character_id: colleague.id, channel: 'messenger', kind: 'vent', status: 'done' })
      .select()
      .single(),
  )
}

// 유저가 먼저 말을 거는 경우("마법의 소라고동") — 대화가 없으면 새로 만들고, 있으면 이어서
export async function sendVentMessage(userId, userText) {
  const sb = admin()
  const workDate = new Date().toISOString().slice(0, 10)
  const workday = unwrap(
    await sb.from('workdays').select('id, state').eq('user_id', userId).eq('work_date', workDate).maybeSingle(),
  )
  if (!workday) return { skipped: true, reason: 'no-workday' }
  if (['OFF_DUTY', 'DONE', 'ON_LEAVE', 'HALF_DAY'].includes(workday.state)) {
    return { skipped: true, reason: 'workday-closed' }
  }

  const convo = await getOrCreateVentConversation(sb, workday)
  const character = unwrap(await sb.from('characters').select('*').eq('id', convo.character_id).single())
  const history = unwrap(await sb.from('messages').select('*').eq('conversation_id', convo.id).order('seq')) || []
  const nextSeq = (history[history.length - 1]?.seq || 0) + 1

  unwrap(await sb.from('messages').insert({ conversation_id: convo.id, sender: 'user', body: userText, seq: nextSeq }))

  const profile = await loadProfile(userId)
  // 캐주얼 채팅이라 이상한/과격한 입력(예: 감정 그대로 자모 반복)에 LLM이 유효한 JSON을 못 돌려줄 수 있음 —
  // 그래도 유저 메시지는 이미 저장됐으니, 답장 생성만 실패해도 대화가 끊기지 않게 기본 응답으로 대체
  let msg
  try {
    msg = await generateVentMessage({ character, history, userText, profile, isComfortPing: false })
  } catch (_) {
    msg = { body: "Whoa, that's a lot of feelings! 😅 I hear you — wanna tell me what happened?", korean_hint: '무슨 일 있었는지 다시 편하게 말해달라는 뜻이야.' }
  }

  unwrap(
    await sb.from('messages').insert({ conversation_id: convo.id, sender: 'character', body: msg.body, seq: nextSeq + 1 }),
  )
  unwrap(await sb.from('conversations').update({ status: 'awaiting' }).eq('id', convo.id))

  return {
    conversationId: convo.id,
    body: msg.body,
    korean_hint: msg.korean_hint,
    _push: {
      userId,
      title: `${character.name}님이 회신했습니다`,
      body: preview(msg.body),
      url: routeFor('messenger', convo.id),
    },
  }
}

// 스트레스 신호(외근 2회 이상 반복) 감지되면 하루 1번 동료가 위로 메시지를 선제 발송 — getTodaySnapshot에서 매번 확인
const COMFORT_TRIGGER_FIELD_WORK = 2

async function maybeSendComfortPing(userId, workday) {
  if (workday.comfort_sent_at) return
  if (!['COMMUTING', 'WORKING'].includes(workday.state)) return

  const sb = admin()
  const fieldWorkCount = (unwrap(await sb.from('field_work_events').select('id').eq('workday_id', workday.id)) || []).length

  if (fieldWorkCount < COMFORT_TRIGGER_FIELD_WORK) return

  const convo = await getOrCreateVentConversation(sb, workday)
  const character = unwrap(await sb.from('characters').select('*').eq('id', convo.character_id).single())
  const history = unwrap(await sb.from('messages').select('*').eq('conversation_id', convo.id).order('seq')) || []
  const nextSeq = (history[history.length - 1]?.seq || 0) + 1

  const profile = await loadProfile(userId)
  const msg = await generateVentMessage({ character, history, userText: null, profile, isComfortPing: true })

  unwrap(
    await sb.from('messages').insert({ conversation_id: convo.id, sender: 'character', body: msg.body, seq: nextSeq }),
  )
  unwrap(await sb.from('conversations').update({ status: 'awaiting' }).eq('id', convo.id))
  unwrap(await sb.from('workdays').update({ comfort_sent_at: new Date().toISOString() }).eq('id', workday.id))

  // 채팅 목록(ConversationList)에서 vent 대화는 항상 "고함항아리" 하나로 묶어 보여주므로,
  // 알림도 실제 동료 이름 대신 같은 이름을 써서 눌렀을 때 "다른 사람 것 아닌가" 하는 혼선을 없앤다
  await sendPushToUser(userId, {
    title: '고함항아리',
    body: preview(msg.body),
    url: routeFor('messenger', convo.id),
  })
}

// [개발용 QA 도구] 오늘 workday를 통째로 삭제해서 실제 며칠 기다리지 않고 출근부터 다시 테스트할 수 있게 함
// (scenarios/characters/conversations/messages/daily_reports 등은 전부 workdays FK cascade로 같이 삭제됨)
export async function devResetToday(userId) {
  const sb = admin()
  const workDate = new Date().toISOString().slice(0, 10)
  const workday = unwrap(
    await sb.from('workdays').select('id').eq('user_id', userId).eq('work_date', workDate).maybeSingle(),
  )
  if (!workday) return { skipped: true, reason: 'no-workday' }
  unwrap(await sb.from('workdays').delete().eq('id', workday.id))
  return { reset: true }
}

// [개발용 QA 도구] 이 계정의 진행상황을 전부 지우고 온보딩부터 다시 시작할 수 있게 함
// workdays를 지우면 scenarios/characters/conversations/messages/daily_reports/review_items/
// notification_schedules/workday_memories는 스키마의 on delete cascade로 함께 정리됨.
// leave_records/field_work_events/promotions/rewards는 workday_id가 아닌 user_id로도 남아있어 별도 삭제.
// user_profiles를 지우면 getProfile()이 null을 반환해 needsOnboarding이 다시 true가 됨(로그인 계정 자체는 유지).
export async function resetAccountProgress(userId) {
  const sb = admin()
  unwrap(await sb.from('workdays').delete().eq('user_id', userId))
  unwrap(await sb.from('leave_records').delete().eq('user_id', userId))
  unwrap(await sb.from('field_work_events').delete().eq('user_id', userId))
  unwrap(await sb.from('promotions').delete().eq('user_id', userId))
  unwrap(await sb.from('rewards').delete().eq('user_id', userId))
  unwrap(await sb.from('user_profiles').delete().eq('user_id', userId))
  return { reset: true }
}

// ── 퇴근: 리포트 + 익일 요약 생성·저장 ──
export async function closeWorkday(workdayId) {
  const sb = admin()
  const workday = unwrap(await sb.from('workdays').select('*').eq('id', workdayId).single())
  const scenario = unwrap(await sb.from('scenarios').select('*').eq('workday_id', workdayId).single())
  // 'vent'(마음 편하게 말 걸기) 대화는 채점 대상이 아니므로 리포트 생성에서 제외
  const convos = unwrap(
    await sb
      .from('conversations')
      .select('*, characters(role, channel), messages(sender, body, seq, hint_level, reply_hints)')
      .eq('workday_id', workdayId)
      .eq('kind', 'scenario'),
  ) || []

  // 완료한 대화만 평가 (미응답 제외 — 기획서 6-4)
  const conversations = convos
    .filter((c) => c.messages?.some((m) => m.sender === 'user'))
    .map((c) => {
      const sorted = [...c.messages].sort((a, b) => a.seq - b.seq)
      // 유저가 자기 문장을 쓴 게 아니라 문장 힌트를 그대로 복사했으면, 그 문장은 우리가 제안한
      // 것이므로 리포트의 "교정 내용"에 다시 걸리면 안 됨(하지만 잘한 표현으로는 쓸 수 있음) — 표시해둔다
      const norm = (s) => (s || '').trim().toLowerCase()
      const messages = sorted.map((m, i) => {
        if (m.sender !== 'user') return m
        const prevCharacterMsg = [...sorted.slice(0, i)].reverse().find((p) => p.sender === 'character')
        const suggestedSentence = prevCharacterMsg?.reply_hints?.[0]
        const isHintCopy = m.hint_level === 'sentence' && !!suggestedSentence && norm(m.body) === norm(suggestedSentence)
        return { ...m, isHintCopy }
      })
      return { role: c.characters.role, channel: c.characters.channel, messages }
    })

  // "오늘 어려웠던 표현" — 단어/문장 힌트까지 연 답변만 모음(scenario/checkin 전체 대상, review 자체는 제외).
  // review_items에 의존하면 당일 복습 큐(최대 1건) 밖으로 밀린 항목이 리포트에서도 빠지므로, messages.hint_level에서 직접 계산한다
  const hintConvos = unwrap(
    await sb
      .from('conversations')
      .select('kind, characters(name, role), messages(sender, body, seq, hint_level)')
      .eq('workday_id', workdayId)
      .in('kind', ['scenario', 'checkin']),
  ) || []
  const difficultExpressions = []
  for (const c of hintConvos) {
    const msgs = [...(c.messages || [])].sort((a, b) => a.seq - b.seq)
    msgs.forEach((m, i) => {
      if (m.sender !== 'user' || (m.hint_level !== 'word' && m.hint_level !== 'sentence')) return
      const prevCharacterMsg = [...msgs.slice(0, i)].reverse().find((p) => p.sender === 'character')
      difficultExpressions.push({
        contactName: c.characters?.name || '',
        role: c.characters?.role || '',
        hintLevel: m.hint_level,
        originalMessage: prevCharacterMsg?.body || '',
        yourReply: m.body,
      })
    })
  }

  const profile = await loadProfile(workday.user_id)

  // "1분 체험하기" 게스트는 LLM 호출 없이 항상 같은 고정 리포트를 보여준다
  let report
  if (profile.is_trial) {
    report = TRIAL_DAILY_REPORT
  } else {
    const prevIssues = unwrap(
      await sb.from('daily_reports').select('recurring_issues').eq('workday_id', workdayId).maybeSingle(),
    )?.recurring_issues

    report = await generateDailyReport({
      scenario,
      conversations,
      profile,
      previousIssues: prevIssues || [],
    })
    // LLM이 가끔 유저가 쓰지 않은 문장을 "잘한 표현"/"교정 내용"으로 지어내는 경우가 있어서,
    // 실제 유저 메시지 전문에 없는 문장은 저장 전에 걸러낸다(안전망 — 프롬프트 지시만으로는 100% 안 막힘)
    const norm = (s) => (s || '').toLowerCase().replace(/[^a-z0-9가-힣\s]/g, '').replace(/\s+/g, ' ').trim()
    const allUserText = norm(
      conversations.flatMap((c) => c.messages.filter((m) => m.sender === 'user').map((m) => m.body)).join(' § '),
    )
    report.good_expressions = (report.good_expressions || []).filter((g) => allUserText.includes(norm(g.text)))
    // 힌트를 그대로 복사한 문장은 (프롬프트에서도 하지 말라고 했지만) 혹시 모델이 놓쳐도 확실히 걸러낸다
    const hintCopiedText = new Set(
      conversations.flatMap((c) => c.messages.filter((m) => m.sender === 'user' && m.isHintCopy).map((m) => norm(m.body))),
    )
    report.corrections = (report.corrections || []).filter(
      (c) => allUserText.includes(norm(c.before)) && !hintCopiedText.has(norm(c.before)),
    )
  }

  unwrap(
    await sb.from('daily_reports').upsert(
      {
        workday_id: workdayId,
        workday_summary: report.workday_summary,
        good_expressions: report.good_expressions,
        corrections: report.corrections,
        register_feedback: report.register_feedback,
        recurring_issues: report.recurring_issues,
        recommended_expressions: report.recommended_expressions,
        next_day_context: report.next_day_context,
        difficult_expressions: difficultExpressions,
      },
      { onConflict: 'workday_id' },
    ),
  )

  if (!profile.is_trial) {
    const memory = await createWorkdayMemory({ scenario, conversations, report })
    unwrap(
      await sb.from('workday_memories').insert({ user_id: workday.user_id, workday_id: workdayId, summary: memory }),
    )
  }

  unwrap(
    await sb.from('workdays').update({ state: 'OFF_DUTY', ended_at: new Date().toISOString() }).eq('id', workdayId),
  )

  // 리포트 생성이 끝났음을 알림 — 퇴근 처리한 화면에는 이미 결과가 반영되지만, 앱을 닫고 있었을 수도 있으니 푸시로도 알림
  await sendPushToUser(workday.user_id, {
    title: '오늘의 업무일지가 준비됐어요',
    body: '오늘 대화를 바탕으로 리포트가 완성됐습니다. 확인해보세요.',
    url: '/reports',
  }).catch(() => {})

  return { report }
}

const WORK_STATUS = {
  IDLE: 'before-work',
  COMMUTING: 'working',
  WORKING: 'working',
  HALF_DAY: 'leave',
  ON_LEAVE: 'leave',
  OFF_DUTY: 'off-work',
  DONE: 'off-work',
}
const ITEM_STATUS = { scheduled: 'pending', awaiting: 'pending', replied: 'answered', done: 'resolved' }

// ── 프론트 홈/메신저/이메일/리포트 화면용 오늘의 스냅샷 ──
// 프로필 없으면 온보딩 필요 신호만 주고 끝, 있으면 오늘 workday를 (없으면 자동 생성해서) 반환
export async function getTodaySnapshot(userId) {
  const sb = admin()
  const profile = await getProfile(userId)
  if (!profile) return { needsOnboarding: true }

  const start = await startWorkday(userId)
  const workday = start.workday

  // 예정 시간이 지난 대화는 이번 조회에서 바로 발송(실제 크론이 늦어도 화면은 최신으로)
  const due = unwrap(
    await sb.from('conversations').select('id').eq('workday_id', workday.id).eq('status', 'scheduled').lte('scheduled_at', new Date().toISOString()),
  ) || []
  for (const d of due) {
    try { await deliverConversation(d.id) } catch (_) { /* 다음 조회에서 재시도 */ }
  }

  // 외근 반복/미응답 누적 등 스트레스 신호가 보이면 위로 메시지를 한 번 보냄(실패해도 조회 자체엔 영향 없게)
  try { await maybeSendComfortPing(userId, workday) } catch (_) { /* 다음 조회에서 재시도 */ }

  // 채팅방/메일함은 오늘 하루가 지나도 최근 7일치는 계속 열람할 수 있게(오늘의 연락 목록만 오늘로 한정)
  const RECENT_DAYS = 7
  const recentSinceDate = new Date(Date.now() - (RECENT_DAYS - 1) * 86400000).toISOString().slice(0, 10)
  const recentWorkdays = unwrap(
    await sb.from('workdays').select('id').eq('user_id', userId).gte('work_date', recentSinceDate),
  ) || []
  const recentWorkdayIds = recentWorkdays.map((w) => w.id)

  const convos = unwrap(
    await sb
      .from('conversations')
      .select('*, characters(id, role, channel, name, title)')
      .in('workday_id', recentWorkdayIds)
      .order('scheduled_at', { ascending: false }),
  ) || []

  const contacts = []
  const seenContact = new Set()
  const conversations = []
  const emailThreads = []
  const todayItems = []

  const mapMessages = (messages) =>
    messages.map((m) => ({
      id: m.id,
      from: m.sender === 'user' ? 'user' : 'contact',
      body: m.body,
      subject: m.subject || undefined,
      timestamp: m.sent_at,
      // 이 상대 메시지와 함께 LLM이 만든 실제 답장 힌트(체크인/복습 등 스크립트형 메시지는 없음 —
      // 클라이언트가 없으면 기존 고정 힌트로 대체함)
      koreanHint: m.korean_hint || undefined,
      replyHints: m.reply_hints || undefined,
      wordHints: m.word_hints || undefined,
    }))

  // 'scenario'(매일 배정되는 기본 업무 대화)는 날짜가 달라도 캐릭터 role이 같으면 같은 사람과의
  // 대화이므로, 채팅방 목록에서 날짜별로 따로 나열되지 않게(=같은 사람이 여러 번 뜨는 것처럼 보이지
  // 않게) 메시지를 이어붙여 하나의 스레드로 합친다. 체크인/복습/고함항아리는 원래대로 개별 항목 유지.
  // convos는 scheduled_at 내림차순(최신 먼저)이라, 그룹의 첫 원소가 오늘(가장 최근) 대화다.
  const scenarioGroups = new Map()
  const otherConvos = []
  for (const c of convos) {
    if (c.kind === 'scenario') {
      const role = c.characters.role
      if (!scenarioGroups.has(role)) scenarioGroups.set(role, [])
      scenarioGroups.get(role).push(c)
    } else {
      otherConvos.push(c)
    }
  }

  // 아직 도착 전(scheduled)이라 채팅방/메일함 목록엔 안 올라가는 상대도, "오늘의 연락" 카드에는
  // 이름·직함이 보여야 하므로 대화 내용 유무와 무관하게 contacts에는 항상 등록해둔다
  const ensureContact = (ch) => {
    if (seenContact.has(ch.id)) return
    seenContact.add(ch.id)
    contacts.push({ id: ch.id, name: ch.name, role: ch.role, title: ch.title || '' })
  }

  // 'vent'(마음 편하게 말 걸기)는 "오늘의 연락(예정된 업무 연락)" 목록엔 안 보여줌.
  // 지난 날짜 대화는 채팅방/메일함에서는 계속 보이되, "오늘의 연락" 목록은 오늘 것만 대상으로 함
  const pushTodayItem = (c, mapped) => {
    if (c.kind === 'vent' || c.workday_id !== workday.id) return
    const ch = c.characters
    ensureContact(ch)
    const last = mapped[mapped.length - 1]
    todayItems.push({
      id: c.id,
      contactId: ch.id,
      channel: c.channel,
      kind: c.kind,
      targetId: c.id,
      title: last ? preview(last.body) : c.status === 'done' ? `${roleLabel(ch.role)} 연락 건너뜀 (휴가)` : `${roleLabel(ch.role)} 연락 예정`,
      status: ITEM_STATUS[c.status] || 'pending',
      dueAt: c.scheduled_at,
    })
  }

  // 채팅방/메일함(실제 대화 내용) 목록에는 아직 도착하지 않은(status: 'scheduled') 대화는 올리지 않는다.
  // 아직 메시지가 없는데도 그 미래의 scheduled_at이 "최근 업데이트 시각"으로 잡혀서, 정작 이미 온
  // 메시지들보다 위(최신)로 정렬돼버리고, 내용도 없는 빈 대화가 목록에 보이는 문제가 있었다.
  const pushThreadContent = (c, mapped) => {
    if (c.status === 'scheduled') return
    const ch = c.characters
    ensureContact(ch)
    const last = mapped[mapped.length - 1]
    // "안 읽음" = 아직 답장 안 함이 아니라 실제로 안 열어봄 기준(읽으면 바로 사라짐)
    const unreadCount = c.status === 'awaiting' && (!c.read_at || new Date(c.read_at) < new Date(last?.timestamp || 0)) ? 1 : 0
    const updatedAt = last?.timestamp || c.scheduled_at

    if (c.channel === 'email') {
      emailThreads.push({
        id: c.id,
        contactId: ch.id,
        channel: 'email',
        kind: c.kind,
        subject: c.subject || last?.subject || '',
        unreadCount,
        updatedAt,
        emails: mapped,
      })
    } else {
      conversations.push({ id: c.id, contactId: ch.id, channel: 'messenger', kind: c.kind, unreadCount, updatedAt, messages: mapped })
    }
  }

  // 대화방마다 메시지를 하나씩 순서대로(await) 가져오면 대화 수만큼 왕복이 쌓여 로그인/새로고침이
  // 눈에 띄게 느려진다(원격 DB 왕복 지연이 대화 개수만큼 그대로 더해짐) — 서로 독립적인 조회라
  // Promise.all로 한꺼번에 병렬 요청한다. 이후 배열 정렬(아래)에서 순서를 다시 명시적으로 맞추므로
  // 병렬 처리로 완료 순서가 뒤섞여도 결과에는 영향이 없다.
  await Promise.all([
    ...Array.from(scenarioGroups.values()).map(async (group) => {
      // scheduled_at이 내림차순이라 보통 group[0]이 오늘 대화지만, 외근 재예약이 누적되면 예전 대화의
      // scheduled_at이 오늘 대화와 같아지거나 더 늦어질 수 있어 group[0]이 오늘 게 아닐 수 있음 —
      // 오늘 workday에 속한 대화가 있으면 그걸 항상 우선해서 "오늘의 연락"이 빠지지 않게 한다
      const todayInGroup = group.find((c) => c.workday_id === workday.id)
      const latest = todayInGroup || group[0]
      const results = await Promise.all(
        group.map((c) => sb.from('messages').select('*').eq('conversation_id', c.id).order('seq')),
      )
      const allMessages = results.flatMap((res) => mapMessages(unwrap(res) || []))
      // 대화(conversation) 단위 scheduled_at으로만 순서를 정하면, 외근 재예약·QA 도구(다음날로 넘기기,
      // 강제발송 등)로 여러 날짜의 scheduled_at이 서로 뒤엉켰을 때 메시지가 뒤죽박죽으로 이어붙여진다 —
      // 실제로 언제 오갔는지의 기준인 메시지 자체의 시각(timestamp)으로 최종 정렬해 항상 진짜 시간순이 되게 한다
      allMessages.sort((a, b) => new Date(a.timestamp) - new Date(b.timestamp))
      pushTodayItem(latest, allMessages)
      // 목록에 표시할 대표 대화는 "이미 도착한 것 중 가장 최근"이어야 함 — 오늘 것이 아직 도착 전이면
      // 지난 날짜의 마지막 대화로 대체하고, 그마저 없으면(한 번도 도착한 적 없음) 이 상대는 목록에 아예 안 보인다
      const deliveredLatest = group.find((c) => c.status !== 'scheduled')
      if (deliveredLatest) pushThreadContent(deliveredLatest, allMessages)
    }),
    ...otherConvos.map(async (c) => {
      const messages = unwrap(await sb.from('messages').select('*').eq('conversation_id', c.id).order('seq')) || []
      const mapped = mapMessages(messages)
      pushTodayItem(c, mapped)
      pushThreadContent(c, mapped)
    }),
  ])

  // "오늘의 연락"은 예정 시각이 이른 순으로(다음 연락 예정을 정확히 고르기 위해), 채팅방/메일함 목록은
  // 최근 업데이트 순으로 정렬 — 위 그룹핑 과정에서 원래의 조회 순서가 흐트러졌으므로 여기서 다시 명시적으로 정렬
  todayItems.sort((a, b) => new Date(a.dueAt) - new Date(b.dueAt))
  conversations.sort((a, b) => new Date(b.updatedAt) - new Date(a.updatedAt))
  emailThreads.sort((a, b) => new Date(b.updatedAt) - new Date(a.updatedAt))

  const currentScenario = unwrap(
    await sb.from('scenarios').select('*').eq('workday_id', workday.id).maybeSingle(),
  )
  const workContext = decodeWorkContext(currentScenario)

  let report = null
  if (['OFF_DUTY', 'DONE'].includes(workday.state)) {
    const r = unwrap(await sb.from('daily_reports').select('*').eq('workday_id', workday.id).maybeSingle())
    if (r) {
      report = {
        date: workday.work_date,
        summary: r.workday_summary,
        goodExpressions: r.good_expressions || [],
        improvementPoints: r.corrections || [],
        keyPhrases: r.recommended_expressions || [],
        nextPreview: r.next_day_context,
        difficultExpressions: r.difficult_expressions || [],
        registerFeedback: r.register_feedback || null,
      }
    }
  }

  const survey = await getActiveSurveyForUser(userId).catch(() => null)
  const leaveBalance = profile.is_trial ? null : await getLeaveBalance(userId).catch(() => null)
  // 어제(또는 그 이전) 어려웠던 표현의 익일 복습이 오늘자로 배정돼 아직 안 끝났으면, 홈 화면 배너로 안내
  const pendingReviewBanner = profile.is_trial ? null : await getPendingReviewBanner(userId, workday).catch(() => null)

  return {
    needsOnboarding: false,
    workStatus: WORK_STATUS[workday.state] || 'before-work',
    workday,
    contacts,
    conversations,
    emailThreads,
    todayItems,
    report,
    survey,
    isTrial: Boolean(profile.is_trial),
    leaveBalance,
    pendingReviewBanner,
    workContext,
  }
}

// ── 근무 시간 현황(리포트) — 최근 N일의 실제 출퇴근(started_at/ended_at) 기반 근무 시간 이력 ──
function workHoursStatus(dateStr, workday, today) {
  const date = new Date(`${dateStr}T00:00:00`)
  if (date > today) return 'future'
  if (workday?.state === 'HALF_DAY' || workday?.state === 'ON_LEAVE') return 'leave'
  if (workday) return 'present'
  const day = date.getDay()
  if (day === 0 || day === 6) return 'weekend'
  return 'absent'
}

export async function getWorkHoursHistory(userId, daysBack = 14) {
  const sb = admin()
  const today = new Date()
  today.setHours(0, 0, 0, 0)
  const since = new Date(today.getTime() - daysBack * 86400000).toISOString().slice(0, 10)

  const workdays = unwrap(
    await sb.from('workdays').select('work_date, state, started_at, ended_at').eq('user_id', userId).gte('work_date', since),
  ) || []
  const byDate = new Map(workdays.map((w) => [w.work_date, w]))

  const days = []
  for (let i = daysBack; i >= 0; i--) {
    const date = new Date(today.getTime() - i * 86400000).toISOString().slice(0, 10)
    const w = byDate.get(date)
    let minutes = 0
    if (w?.started_at) {
      const end = w.ended_at ? new Date(w.ended_at) : new Date()
      const rawMinutes = (end - new Date(w.started_at)) / 60000
      // 1분 미만의 짧은 실제 근무(테스트 등)도 반올림하면 0으로 뭉개져 "트래킹 안 됨"처럼 보이므로
      // 실제로 시간이 조금이라도 지났으면 최소 1분으로 표시
      minutes = rawMinutes > 0 ? Math.max(1, Math.round(rawMinutes)) : 0
    }
    days.push({ date, status: workHoursStatus(date, w, today), minutes })
  }
  return { days }
}

// ── 출석 캘린더(AttendancePage) — 실제 workdays·field_work_events 기반 근태 이력 ──
// present/field-work/leave/absent/weekend/future 여섯 상태로 구분(외근은 그날 field_work_events가 1건이라도 있으면)
function attendanceStatusFor(dateStr, workday, hadFieldWork, today) {
  const date = new Date(`${dateStr}T00:00:00`)
  if (date > today) return 'future'
  if (workday?.state === 'HALF_DAY' || workday?.state === 'ON_LEAVE') return 'leave'
  if (hadFieldWork) return 'field-work'
  if (workday) return 'present'
  const day = date.getDay()
  if (day === 0 || day === 6) return 'weekend'
  return 'absent'
}

export async function getAttendanceHistory(userId, daysBack = 119) {
  const sb = admin()
  const today = new Date()
  today.setHours(0, 0, 0, 0)
  const since = new Date(today.getTime() - daysBack * 86400000).toISOString().slice(0, 10)

  // 가입(첫 출근) 이전 날짜까지 "결근"으로 찍히면 안 되므로, 실제 첫 출근일을 따로 조회해 그 이전은 제외
  const firstWorkday = unwrap(
    await sb.from('workdays').select('work_date').eq('user_id', userId).order('work_date', { ascending: true }).limit(1).maybeSingle(),
  )
  const joinedDate = firstWorkday?.work_date || null

  const workdays = unwrap(
    await sb.from('workdays').select('id, work_date, state').eq('user_id', userId).gte('work_date', since),
  ) || []
  const byDate = new Map(workdays.map((w) => [w.work_date, w]))
  const workdayIds = workdays.map((w) => w.id)

  const fieldWorkDays = new Set()
  if (workdayIds.length) {
    const events = unwrap(
      await sb.from('field_work_events').select('workday_id').in('workday_id', workdayIds),
    ) || []
    const idToDate = new Map(workdays.map((w) => [w.id, w.work_date]))
    for (const e of events) fieldWorkDays.add(idToDate.get(e.workday_id))
  }

  const days = []
  for (let i = daysBack; i >= 0; i--) {
    const date = new Date(today.getTime() - i * 86400000).toISOString().slice(0, 10)
    const w = byDate.get(date)
    const status = joinedDate && date < joinedDate ? 'before-join' : attendanceStatusFor(date, w, fieldWorkDays.has(date), today)
    days.push({ date, status })
  }
  return { days }
}

// ── 특정 날짜의 일간 리포트 조회 — "어제 리포트 보고 싶다" 대응, 이미 저장된 daily_reports를 그대로 재사용 ──
export async function getDailyReportForDate(userId, workDate) {
  const sb = admin()
  const workday = unwrap(
    await sb.from('workdays').select('id, work_date, state').eq('user_id', userId).eq('work_date', workDate).maybeSingle(),
  )
  if (!workday || !['OFF_DUTY', 'DONE'].includes(workday.state)) return { available: false, date: workDate }

  const r = unwrap(await sb.from('daily_reports').select('*').eq('workday_id', workday.id).maybeSingle())
  if (!r) return { available: false, date: workDate }

  return {
    available: true,
    report: {
      date: workday.work_date,
      summary: r.workday_summary,
      goodExpressions: r.good_expressions || [],
      improvementPoints: r.corrections || [],
      keyPhrases: r.recommended_expressions || [],
      nextPreview: r.next_day_context,
      difficultExpressions: r.difficult_expressions || [],
      registerFeedback: r.register_feedback || null,
    },
  }
}

// ── 주간/월간 누적 리포트: 최근 daily_reports 여러 건을 LLM이 서술형으로 종합 ──
const PERIOD_RANGE_DAYS = { week: 7, month: 30 }
const PERIOD_RANGE_LABEL = { week: '지난 7일', month: '지난 30일' }

export async function getPeriodReport(userId, range) {
  if (!PERIOD_RANGE_DAYS[range]) {
    throw Object.assign(new Error(`알 수 없는 range: ${range}`), { status: 400 })
  }
  const rangeLabel = PERIOD_RANGE_LABEL[range]
  const sb = admin()
  const since = new Date(Date.now() - PERIOD_RANGE_DAYS[range] * 86400000).toISOString().slice(0, 10)

  const workdays = unwrap(
    await sb.from('workdays').select('id, work_date').eq('user_id', userId).gte('work_date', since).order('work_date'),
  ) || []
  if (!workdays.length) return { available: false, range, rangeLabel }

  const byWorkdayId = new Map(workdays.map((w) => [w.id, w.work_date]))
  const reports = unwrap(
    await sb
      .from('daily_reports')
      .select('workday_id, workday_summary, good_expressions, corrections, recurring_issues')
      .in('workday_id', workdays.map((w) => w.id)),
  ) || []
  if (!reports.length) return { available: false, range, rangeLabel }

  const days = reports
    .map((r) => ({ ...r, work_date: byWorkdayId.get(r.workday_id) }))
    .sort((a, b) => (a.work_date < b.work_date ? -1 : 1))

  const profile = await loadProfile(userId)
  const result = await generatePeriodReport({ rangeLabel, days, profile })

  return { available: true, range, rangeLabel, daysCount: days.length, ...result }
}

// ── 개발용 QA 도구: 가짜 지난 날짜 하루치를 만들어 누적 리포트 테스트를 가능하게 함 ──
// 실제 대화를 생성하지 않고 daily_reports만 채운다 — 이 도구의 목적은 "누적 종합" 기능 검증이지
// 개별 하루 생성 품질 검증이 아니라서, LLM 호출 없이 간단한 더미 문구로 채워 비용/시간을 아낀다.
const BACKFILL_TEMPLATES = [
  { summary: '팀장과 프로젝트 일정 조율, 거래처에 견적 관련 이메일 회신', good: 'Could we push the deadline by two days?', fix: ['We need discuss it → We need to discuss it'], issue: '전치사 누락' },
  { summary: '동료와 버그 공유, 해외 파트너사와 배송 지연 안내', good: "I'll keep you posted on the progress.", fix: ['I am agree → I agree'], issue: '동사 시제' },
  { summary: '상사에게 주간 보고, 거래처 클레임 대응 이메일', good: 'Let me double-check and get back to you.', fix: ['more cheaper → cheaper'], issue: '비교급 중복' },
]

export async function devBackfillPastDay(userId) {
  const sb = admin()
  const existing = unwrap(await sb.from('workdays').select('work_date').eq('user_id', userId)) || []
  const usedDates = new Set(existing.map((w) => w.work_date))

  let workDate = null
  // 최고 직급(이사)까지 필요한 누적일수(180일)를 한 계정에서 QA버튼으로 몰아 채울 수 있게 넉넉히 잡음
  for (let back = 1; back <= 400; back++) {
    const candidate = new Date(Date.now() - back * 86400000).toISOString().slice(0, 10)
    if (!usedDates.has(candidate)) {
      workDate = candidate
      break
    }
  }
  if (!workDate) return { skipped: true, reason: 'no-available-date' }

  const template = BACKFILL_TEMPLATES[existing.length % BACKFILL_TEMPLATES.length]
  const workday = unwrap(
    await sb
      .from('workdays')
      .insert({ user_id: userId, work_date: workDate, state: 'DONE', started_at: `${workDate}T09:00:00Z`, ended_at: `${workDate}T18:00:00Z` })
      .select()
      .single(),
  )
  unwrap(
    await sb.from('daily_reports').insert({
      workday_id: workday.id,
      workday_summary: `(QA 테스트용 더미 기록) ${template.summary}`,
      good_expressions: [{ text: template.good, note: '자연스러운 표현' }],
      corrections: template.fix.map((f) => {
        const [before, after] = f.split(' → ')
        return { before, after, note: template.issue }
      }),
      recurring_issues: [template.issue],
      recommended_expressions: [],
      next_day_context: '',
    }),
  )

  return { backfilled: true, workDate }
}

// [개발용 QA 도구] 지난 N일치 더미 근무 기록을 한 번에 채운다(승급 30일 게이트 등 테스트용)
export async function devBackfillPastDays(userId, count = 30) {
  // 부장→이사 승급에 필요한 180일까지 한 번의 QA버튼으로 채울 수 있어야 해서 상한을 넉넉히 잡음
  const n = Math.min(Math.max(Number(count) || 1, 1), 200)
  let backfilled = 0
  let lastDate = null
  for (let i = 0; i < n; i++) {
    const r = await devBackfillPastDay(userId)
    if (r.backfilled) {
      backfilled++
      lastDate = r.workDate
    } else {
      break // 더 채울 과거 날짜가 없음
    }
  }
  // devBackfillPastDay는 workdays/daily_reports만 채우고 recordDailyAttendance를 안 거치므로,
  // 이 도구의 원래 목적(승급 30일 게이트 테스트)대로 연속 출근일수·적립연차도 실제 출근과 같은 규칙으로 반영해준다
  if (backfilled > 0) {
    const sb = admin()
    const profile = unwrap(
      await sb.from('user_profiles').select('consecutive_days, earned_leave_balance').eq('user_id', userId).maybeSingle(),
    )
    const before = profile?.consecutive_days || 0
    const after = before + backfilled
    const earnedGained = Math.floor(after / 5) - Math.floor(before / 5)
    unwrap(
      await sb
        .from('user_profiles')
        .update({ consecutive_days: after, earned_leave_balance: (profile?.earned_leave_balance || 0) + earnedGained })
        .eq('user_id', userId),
    )
  }
  return { backfilled, days: backfilled, lastDate }
}

// [개발용 QA 도구] 오늘 하루를 마감하고, 실제로 하루를 기다리지 않아도 다음 접속 시 완전히 새로운
// 하루로 취급되게 함 — 오늘 workday를 지우는 게 아니라 "비어있는 과거 날짜"로 옮겨서(devBackfillPastDay와
// 같은 방식으로 충돌 없는 날짜를 찾음) 오늘 기록은 보존한 채, 실제 오늘 날짜 슬롯을 다시 비운다
export async function devAdvanceToNextDay(userId) {
  const sb = admin()
  const workDate = new Date().toISOString().slice(0, 10)
  const workday = unwrap(
    await sb.from('workdays').select('*').eq('user_id', userId).eq('work_date', workDate).maybeSingle(),
  )
  if (!workday) return { skipped: true, reason: 'no-workday' }

  if (!['OFF_DUTY', 'DONE', 'ON_LEAVE', 'HALF_DAY'].includes(workday.state)) {
    await closeWorkday(workday.id)
  }

  const existing = unwrap(await sb.from('workdays').select('work_date').eq('user_id', userId)) || []
  const usedDates = new Set(existing.map((w) => w.work_date))
  let pastDate = null
  // "N일 채우기" QA버튼으로 과거 날짜가 많이 소진돼 있어도 빈 슬롯을 찾을 수 있게 넉넉히 잡음
  for (let back = 1; back <= 400; back++) {
    const candidate = new Date(Date.now() - back * 86400000).toISOString().slice(0, 10)
    if (!usedDates.has(candidate)) {
      pastDate = candidate
      break
    }
  }
  if (!pastDate) return { skipped: true, reason: 'no-available-date' }

  unwrap(await sb.from('workdays').update({ work_date: pastDate }).eq('id', workday.id))
  return { advanced: true, movedTo: pastDate }
}
