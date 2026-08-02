// 회원가입/로그인 — 익명 세션을 실계정으로 업그레이드(온보딩 데이터 유지) or 기존 계정 로그인
import { supabase, supabaseReady } from "./supabaseClient.js";
import { setAccessToken, clearAccessToken } from "./authToken";
import { postConsent } from "./api";

function requireSupabase() {
  if (!supabaseReady || !supabase) throw new Error("Supabase 설정이 없습니다.");
  return supabase;
}

// Supabase AuthError의 code(예: "email_exists")를 그대로 실어서 던짐 —
// 화면단에서 "이미 가입된 이메일" 같은 구체적인 안내를 보여줄 수 있도록.
function toError(message: string, code?: string): Error & { code?: string } {
  const err = new Error(message) as Error & { code?: string };
  if (code) err.code = code;
  return err;
}

/** 회원가입: 지금 쓰던 익명 계정을 그대로 실계정으로 승격 (온보딩/시나리오 데이터 유지) */
export async function signUp(params: { email: string; password: string; displayName: string }) {
  const sb = requireSupabase();
  const { data, error } = await sb.auth.updateUser({
    email: params.email,
    password: params.password,
    data: { display_name: params.displayName },
  });
  if (error) throw toError(error.message, error.code);

  const { data: sessionData } = await sb.auth.getSession();
  if (sessionData.session) setAccessToken(sessionData.session.access_token);

  await postConsent();
  return data.user;
}

/** 로그인: 기존 실계정으로 전환 (지금 세션의 익명/체험 데이터는 버려짐) */
export async function signIn(params: { email: string; password: string }) {
  const sb = requireSupabase();
  const { data, error } = await sb.auth.signInWithPassword(params);
  if (error) throw toError(error.message, error.code);
  if (data.session) setAccessToken(data.session.access_token);
  return data.user;
}

/**
 * 카카오 회원가입: 지금 쓰던 익명 계정에 카카오 계정을 연결(linkIdentity)해서 승격.
 * 브라우저가 카카오 인증 페이지로 완전히 이동했다가 redirectTo로 돌아오는 방식이라
 * 이 함수 자체는 리다이렉트를 시작만 하고 끝남 — 동의 기록은 돌아온 뒤 처리해야 해서
 * sessionStorage에 표시를 남겨둔다.
 */
export async function signUpWithKakao() {
  const sb = requireSupabase();
  window.sessionStorage.setItem(PENDING_CONSENT_KEY, "1");
  const { error } = await sb.auth.linkIdentity({
    provider: "kakao",
    options: { redirectTo: window.location.origin },
  });
  if (error) {
    window.sessionStorage.removeItem(PENDING_CONSENT_KEY);
    throw new Error(error.message);
  }
}

/** 카카오 로그인: 기존 카카오 연동 계정으로 전환 (지금 세션의 익명/체험 데이터는 버려짐) */
export async function signInWithKakao() {
  const sb = requireSupabase();
  const { error } = await sb.auth.signInWithOAuth({
    provider: "kakao",
    options: { redirectTo: window.location.origin },
  });
  if (error) throw new Error(error.message);
}

const PENDING_CONSENT_KEY = "go_pending_privacy_consent";

/** 카카오 리다이렉트로 돌아온 직후 SettingsPage에서 호출 — 대기 중인 동의 기록을 마저 처리 */
export async function finalizePendingConsent() {
  if (window.sessionStorage.getItem(PENDING_CONSENT_KEY) !== "1") return false;
  window.sessionStorage.removeItem(PENDING_CONSENT_KEY);
  await postConsent();
  return true;
}

export async function signOut() {
  const sb = requireSupabase();
  await sb.auth.signOut();
  clearAccessToken();
}
