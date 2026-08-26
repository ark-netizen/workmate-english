// Supabase 익명 세션을 자동으로 확보하고, 이후 로그인/로그아웃/OAuth 리다이렉트 복귀 등으로
// 세션이 바뀔 때마다 authToken 저장소를 계속 따라가도록 동기화한다.
import { supabase, supabaseReady } from "./supabaseClient.js";
import { getAccessToken, setAccessToken, clearAccessToken } from "./authToken";
import { resetTrialSequence } from "./trialSequence";

let authSyncStarted = false;

// 카카오 로그인처럼 브라우저가 통째로 리다이렉트됐다 돌아오는 플로우는 signIn/signUp 함수가
// 직접 setAccessToken을 호출할 기회가 없어서, 세션 변경을 실시간으로 구독해 따라가야 함
function startAuthSync() {
  if (authSyncStarted || !supabaseReady || !supabase) return;
  authSyncStarted = true;
  supabase.auth.onAuthStateChange((_event, session) => {
    if (session?.access_token) setAccessToken(session.access_token);
    else clearAccessToken();
  });
}

export async function ensureSession(): Promise<void> {
  startAuthSync();

  // Supabase 미설정이면 URL(?access_token=)로 주입된 토큰 폴백만 사용
  if (!supabaseReady || !supabase) {
    getAccessToken();
    return;
  }

  // ⚠️ 저장된 go_access_token을 무조건 재사용하면 안 됨.
  // 만료됐거나 이전 설정 때 발급된 토큰이 남아 있으면 계속 그걸 보내서 서버가 "인증 실패"를 냈음.
  // → 항상 Supabase 라이브 세션(자동 리프레시)을 신뢰해 동기화하고, 만료 임박이면 갱신한다.
  const { data: current } = await supabase.auth.getSession();
  let session = current.session;

  // 만료됐거나 60초 내 만료 예정이면 강제 리프레시
  if (session?.expires_at && session.expires_at * 1000 < Date.now() + 60_000) {
    const { data: refreshed } = await supabase.auth.refreshSession();
    session = refreshed.session ?? null;
  }

  if (!session) {
    const { data, error } = await supabase.auth.signInAnonymously();
    if (error) throw new Error(error.message);
    session = data.session;
  }

  if (session?.access_token) setAccessToken(session.access_token);
  else clearAccessToken();
}

/**
 * "1분 체험하기(로그인 불필요)" 전용 — 매번 눌렀을 때 항상 온보딩부터 시작하는 새 체험이어야 함.
 * 실계정 세션은 물론, 이전에 진행하다 만 익명 체험 세션이 남아있어도(체험 종료를 안 누르고
 * 나간 경우 등) 그 이어보기가 아니라 완전히 새 세션으로 리셋한다.
 */
export async function startFreshGuestTrial(): Promise<void> {
  resetTrialSequence();
  if (!supabaseReady || !supabase) return;

  const { data } = await supabase.auth.getSession();
  if (data.session) {
    await supabase.auth.signOut();
    clearAccessToken();
  }

  await ensureSession();
}

// "체험 종료" — 화면 전환을 막지 않도록 로컬 체험 상태를 즉시 비운다.
// Supabase 익명 세션 정리는 fire-and-forget으로 처리한다. 다음 체험 시작 시에도
// startFreshGuestTrial()이 남아 있는 세션을 다시 정리하므로 체험 데이터가 이어지지 않는다.
export async function endGuestTrial(): Promise<void> {
  clearAccessToken();
  resetTrialSequence();

  if (supabaseReady && supabase) {
    void supabase.auth.signOut({ scope: "local" }).catch(() => {
      // 인트로 복귀 UX는 백그라운드 세션 정리 실패와 무관하게 즉시 완료한다.
    });
  }
}

// 현재 세션이 "1분 체험하기"로 만든 익명 세션인지 — 온보딩 화면에서 직접 입력 없이 기본값으로
// 바로 진행할 수 있게 할지 판단할 때 사용
export async function isAnonymousSession(): Promise<boolean> {
  if (!supabaseReady || !supabase) return false;
  const { data } = await supabase.auth.getSession();
  return Boolean(data.session?.user?.is_anonymous);
}

// 실계정(익명 아님)으로 이미 로그인된 세션이 브라우저에 남아있는지 — 알림 클릭 등으로 새 탭이 열렸을 때
// 소개 페이지(인트로) 게이트를 건너뛰고 바로 앱으로 들어갈지 판단할 때 사용
export async function hasRealSession(): Promise<boolean> {
  if (!supabaseReady || !supabase) return false;
  const { data } = await supabase.auth.getSession();
  return Boolean(data.session?.user && !data.session.user.is_anonymous);
}
