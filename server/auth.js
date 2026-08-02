// 요청 인증: Supabase JWT(Authorization: Bearer) 검증 → app_users.id 반환
import { admin } from './db.js'

export async function requireUser(req) {
  const header = req.headers.authorization || ''
  const token = header.startsWith('Bearer ') ? header.slice(7) : null
  if (!token) throw Object.assign(new Error('인증 필요'), { status: 401 })

  const sb = admin()
  const { data, error } = await sb.auth.getUser(token)
  if (error || !data?.user) throw Object.assign(new Error('인증 실패'), { status: 401 })

  // auth uid → app_users 매핑(없으면 생성)
  let row = (await sb.from('app_users').select('id, email, display_name').eq('auth_uid', data.user.id).maybeSingle()).data
  if (!row) {
    row = (
      await sb.from('app_users').insert({
        auth_uid: data.user.id,
        email: data.user.email,
        display_name: data.user.user_metadata?.display_name || null,
        is_trial: data.user.is_anonymous ?? false,
      }).select('id, email, display_name').single()
    ).data
  } else if (!row.email && data.user.email) {
    // 익명 → 실계정 업그레이드 시 이메일/이름이 새로 생기면 반영
    await sb.from('app_users').update({
      email: data.user.email,
      display_name: row.display_name || data.user.user_metadata?.display_name || null,
      is_trial: false,
    }).eq('id', row.id)
  }
  return row.id
}
