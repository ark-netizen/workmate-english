// 카카오톡 "나에게 보내기" 발송 (서버 전용). 알림톡(대행사·심사·과금)이 아니라
// 카카오 로그인 시 talk_message 스코프로 받은 access/refresh token을 그대로 쓰는 무료 방식.
// 필요 env: KAKAO_REST_API_KEY (Supabase Kakao Provider의 Client ID와 동일), KAKAO_CLIENT_SECRET(있으면)
import { admin, unwrap } from './db.js'

const TOKEN_URL = 'https://kauth.kakao.com/oauth/token'
const SEND_URL = 'https://kapi.kakao.com/v2/api/talk/memo/default/send'

// 첫 동의(re-consent OAuth) 후 프론트가 넘겨준 provider_token/provider_refresh_token 저장
export async function saveKakaoToken(userId, { accessToken, refreshToken, expiresIn }) {
  const sb = admin()
  const expiresAt = new Date(Date.now() + Math.max(0, (expiresIn || 0) - 60) * 1000).toISOString()
  unwrap(
    await sb.from('kakao_tokens').upsert(
      { user_id: userId, access_token: accessToken, refresh_token: refreshToken, expires_at: expiresAt, updated_at: new Date().toISOString() },
      { onConflict: 'user_id' },
    ),
  )
}

export async function deleteKakaoToken(userId) {
  const sb = admin()
  unwrap(await sb.from('kakao_tokens').delete().eq('user_id', userId))
}

async function refreshToken(row) {
  const { KAKAO_REST_API_KEY, KAKAO_CLIENT_SECRET } = process.env
  if (!KAKAO_REST_API_KEY) throw new Error('KAKAO_REST_API_KEY 누락')
  const body = new URLSearchParams({
    grant_type: 'refresh_token',
    client_id: KAKAO_REST_API_KEY,
    refresh_token: row.refresh_token,
    ...(KAKAO_CLIENT_SECRET ? { client_secret: KAKAO_CLIENT_SECRET } : {}),
  })
  const res = await fetch(TOKEN_URL, {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body,
  })
  if (!res.ok) throw new Error(`카카오 토큰 갱신 실패: ${res.status}`)
  const json = await res.json()
  const sb = admin()
  const expiresAt = new Date(Date.now() + Math.max(0, (json.expires_in || 0) - 60) * 1000).toISOString()
  const nextRefreshToken = json.refresh_token || row.refresh_token
  unwrap(
    await sb.from('kakao_tokens').update({
      access_token: json.access_token,
      refresh_token: nextRefreshToken,
      expires_at: expiresAt,
      updated_at: new Date().toISOString(),
    }).eq('user_id', row.user_id),
  )
  return { ...row, access_token: json.access_token, refresh_token: nextRefreshToken, expires_at: expiresAt }
}

// 야간 조용시간(22:00~07:00, KST 실제 시각) — 트리거 종류 무관 공통 규칙
export function isQuietHours(date = new Date()) {
  const kstHour = Number(
    new Intl.DateTimeFormat('en-US', { hour: 'numeric', hour12: false, timeZone: 'Asia/Seoul' }).format(date),
  )
  return kstHour >= 22 || kstHour < 7
}

// text 템플릿(나에게 보내기) — 링크 버튼 포함
async function callSend(accessToken, { text, url, buttonTitle }) {
  const templateObject = {
    object_type: 'text',
    text,
    link: { web_url: url, mobile_web_url: url },
    button_title: buttonTitle || '확인하기',
  }
  const res = await fetch(SEND_URL, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${accessToken}`,
      'Content-Type': 'application/x-www-form-urlencoded',
    },
    body: new URLSearchParams({ template_object: JSON.stringify(templateObject) }),
  })
  return res
}

// payload = { text, url, buttonTitle } — 조용시간이면 발송 안 하고 skipped 리턴(호출부에서 재시도 큐 등 처리)
export async function sendKakaoToUser(userId, payload) {
  if (isQuietHours()) return { sent: false, reason: 'quiet_hours' }

  const sb = admin()
  const profile = unwrap(
    await sb.from('user_profiles').select('kakao_notify_enabled').eq('user_id', userId).maybeSingle(),
  )
  if (!profile?.kakao_notify_enabled) return { sent: false, reason: 'disabled' }

  const row = unwrap(await sb.from('kakao_tokens').select('*').eq('user_id', userId).maybeSingle())
  if (!row) return { sent: false, reason: 'not_connected' }

  let token = row
  if (new Date(row.expires_at).getTime() <= Date.now()) {
    token = await refreshToken(row)
  }

  let res = await callSend(token.access_token, payload)
  if (res.status === 401) {
    // access token이 만료 시각보다 먼저 무효화된 경우 한 번 더 갱신 후 재시도
    token = await refreshToken(token)
    res = await callSend(token.access_token, payload)
  }
  if (!res.ok) {
    const body = await res.text().catch(() => '')
    return { sent: false, reason: `http_${res.status}`, body }
  }
  return { sent: true }
}
