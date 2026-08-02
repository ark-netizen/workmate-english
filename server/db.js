// Supabase 관리자 클라이언트 (서버 전용 — service_role, RLS 우회)
// 절대 브라우저로 내보내지 말 것.
import { createClient } from '@supabase/supabase-js'

let _sb = null

export function admin() {
  if (_sb) return _sb
  const url = process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY
  if (!url || !key) {
    throw new Error('Supabase 서버 환경변수 누락: SUPABASE_URL / SUPABASE_SERVICE_ROLE_KEY')
  }
  _sb = createClient(url, key, { auth: { persistSession: false, autoRefreshToken: false } })
  return _sb
}

// 쿼리 결과 헬퍼: 에러면 throw
export function unwrap({ data, error }) {
  if (error) throw new Error(error.message)
  return data
}
