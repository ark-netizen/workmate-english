// 온보딩 프로필 조회/저장 (server/llm/prompts.js가 그대로 쓰는 필드 계약)
// display_name은 user_profiles가 아니라 app_users 테이블 컬럼이라 별도로 합쳐서 다룬다.
import { admin, unwrap } from './db.js'
import { RANKS } from './promotion.js'
import { todayDateKST } from './time.js'

export async function getProfile(userId) {
  const sb = admin()
  const { data: row, error } = await sb.from('user_profiles').select('*, app_users(display_name, email, privacy_consented_at, is_trial)').eq('user_id', userId).maybeSingle()
  if (error) throw new Error(error.message)
  if (!row) return null
  const { app_users, ...profile } = row
  return {
    ...profile,
    display_name: app_users?.display_name || null,
    email: app_users?.email || null,
    privacy_consented: Boolean(app_users?.privacy_consented_at),
    is_trial: Boolean(app_users?.is_trial),
  }
}

// 개인정보처리방침 동의 기록 (회원가입 시 1회)
export async function recordPrivacyConsent(userId) {
  const sb = admin()
  unwrap(await sb.from('app_users').update({ privacy_consented_at: new Date().toISOString() }).eq('id', userId).select().single())
}

// 부분 업데이트 허용 필드 — 안 보낸 필드는 손대지 않는다(설정 화면에서 하나만 바꿔도 안전)
const EDITABLE_FIELDS = [
  'industry', 'job_role', 'main_tasks', 'contacts', 'english_level',
  'colleague_name', 'colleague_personality',
  'manager_name', 'manager_personality',
  'client_name', 'client_personality',
  'start_time', 'end_time', 'daily_count',
  'colleague_notify_time', 'manager_notify_time', 'client_notify_time',
  'kakao_notify_enabled',
]

// 이름만 바뀐 역할(성격은 그대로, "새로운 사람"으로 리셋하지 않은 경우) — 다음 출근을 기다릴 필요 없이
// 오늘 이미 생성된 캐릭터 이름에도 바로 반영한다. 대화방/연락처 목록은 전부 characters.name을 그 자리에서
// 조인해서 보여주므로(server/workday.js의 getTodaySnapshot), 이 값만 바꾸면 화면에 즉시 반영된다.
async function renameActiveCharacters(sb, userId, renames) {
  const workDate = todayDateKST()
  const workday = unwrap(
    await sb.from('workdays').select('id').eq('user_id', userId).eq('work_date', workDate).maybeSingle(),
  )
  if (!workday) return
  const scenario = unwrap(
    await sb.from('scenarios').select('id').eq('workday_id', workday.id).maybeSingle(),
  )
  if (!scenario) return
  for (const { role, name } of renames) {
    await sb.from('characters').update({ name }).eq('scenario_id', scenario.id).eq('role', role)
  }
}

export async function saveProfile(userId, fields) {
  const sb = admin()
  if (fields.display_name !== undefined) {
    unwrap(await sb.from('app_users').update({ display_name: fields.display_name }).eq('id', userId).select().single())
  }
  const row = { user_id: userId }
  let hasProfileField = false
  for (const key of EDITABLE_FIELDS) {
    if (fields[key] !== undefined) {
      row[key] = fields[key]
      hasProfileField = true
    }
  }

  // 이름 변경 감지: persona_reset_roles에 안 담긴(= "새로 시작"이 아니라 "이름만 바꾸기"를 고른) 역할만
  // 오늘 캐릭터에도 바로 반영 대상으로 표시해둔다("새로 시작" 역할은 기존 흐름대로 다음 출근에 새 사람으로 생성됨)
  const NAME_FIELDS = ['colleague_name', 'manager_name', 'client_name']
  const resetRoleSet = new Set(fields.persona_reset_roles || [])
  let renameNow = []
  if (NAME_FIELDS.some((key) => fields[key] !== undefined)) {
    const current = unwrap(
      await sb.from('user_profiles').select(NAME_FIELDS.join(', ')).eq('user_id', userId).maybeSingle(),
    )
    renameNow = NAME_FIELDS.map((key) => key.replace('_name', ''))
      .filter((role) => {
        const key = `${role}_name`
        return fields[key] !== undefined && fields[key] !== (current?.[key] || '') && !resetRoleSet.has(role)
      })
      .map((role) => ({ role, name: fields[`${role}_name`] }))
  }
  // avatar_rank: 프로필 아바타로 쓸 직급 캐릭터 — 이미 달성한 직급(현재 직급 이하)만 고를 수 있어
  // 서버에서 현재 job_rank와 비교해 검증한다(클라이언트 값을 그대로 믿지 않음).
  // 예전엔 유효하지 않으면 조용히 무시하고 200을 돌려줘서, 클라이언트에선 "저장 눌렀는데 반영 안 됨"으로만 보였다 —
  // 이제는 명확한 에러로 알려준다.
  if (fields.avatar_rank !== undefined) {
    const current = unwrap(
      await sb.from('user_profiles').select('job_rank').eq('user_id', userId).maybeSingle(),
    )
    const myRankIndex = Math.max(0, RANKS.indexOf(current?.job_rank || '사원'))
    const wantedIndex = RANKS.indexOf(fields.avatar_rank)
    if (wantedIndex === -1) {
      throw Object.assign(new Error(`알 수 없는 직급입니다: ${fields.avatar_rank}`), { status: 400 })
    }
    if (wantedIndex > myRankIndex) {
      throw Object.assign(new Error('아직 승급하지 않은 직급의 캐릭터는 선택할 수 없어요.'), { status: 400 })
    }
    row.avatar_rank = fields.avatar_rank
    hasProfileField = true
  }
  // 상사/거래처 알림 시각은 항상 동료보다 늦어야 "동료가 하루의 첫 연락"이라는 대화 순서가 지켜짐.
  // 이름/성격을 뭘로 바꾸든 이 순서 제약은 그대로 유지되어야 하므로 저장 시점에 검증한다.
  const NOTIFY_TIME_ROLES = { manager: '상사', client: '거래처' }
  if (Object.keys(NOTIFY_TIME_ROLES).some((role) => fields[`${role}_notify_time`] !== undefined) || fields.colleague_notify_time !== undefined) {
    const current = unwrap(
      await sb.from('user_profiles').select('colleague_notify_time, manager_notify_time, client_notify_time').eq('user_id', userId).maybeSingle(),
    )
    const effectiveColleague = fields.colleague_notify_time !== undefined ? fields.colleague_notify_time : current?.colleague_notify_time
    for (const [role, label] of Object.entries(NOTIFY_TIME_ROLES)) {
      const key = `${role}_notify_time`
      const effective = fields[key] !== undefined ? fields[key] : current?.[key]
      if (!effective) continue
      if (!effectiveColleague) {
        throw Object.assign(new Error(`${label} 알림 시각을 지정하려면 먼저 동료 알림 시각을 설정해야 해요.`), { status: 400 })
      }
      if (effective <= effectiveColleague) {
        throw Object.assign(new Error(`${label} 알림 시각은 동료 알림 시각(${effectiveColleague}) 이후로 설정해야 해요.`), { status: 400 })
      }
    }
  }
  // persona_reset_roles: Settings에서 "새로 시작"을 선택한 역할들 — 아직 소진 안 된 기존 pending과 합쳐서(중복 제거) 저장.
  // 블라인드 덮어쓰기하면 이전 저장 이후 아직 안 쓰인 리셋이 이번 저장으로 사라질 수 있어 병합한다
  if (Array.isArray(fields.persona_reset_roles) && fields.persona_reset_roles.length) {
    const current = unwrap(
      await sb.from('user_profiles').select('pending_persona_reset').eq('user_id', userId).maybeSingle(),
    )
    const merged = Array.from(new Set([...(current?.pending_persona_reset || []), ...fields.persona_reset_roles]))
    row.pending_persona_reset = merged
    hasProfileField = true
  }
  // display_name만 온 경우(온보딩 전 인트로 화면 등) user_profiles 로우를 만들면
  // getProfile()이 non-null을 반환해서 온보딩이 필요 없다고 오판하게 되므로 건드리지 않는다
  if (hasProfileField) {
    unwrap(await sb.from('user_profiles').upsert(row, { onConflict: 'user_id' }).select().single())
  }
  if (renameNow.length) {
    await renameActiveCharacters(sb, userId, renameNow).catch(() => {})
  }
  return getProfile(userId)
}
