// 브라우저용 Supabase 클라이언트 (anon 키 — 공개용, RLS가 데이터를 보호)
import { createClient } from '@supabase/supabase-js'

const url = import.meta.env.VITE_SUPABASE_URL
const anon = import.meta.env.VITE_SUPABASE_ANON_KEY

export const supabase = url && anon ? createClient(url, anon) : null
export const supabaseReady = Boolean(supabase)
