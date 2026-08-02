const STORAGE_KEY = "go_access_token";

/**
 * TEMP: 로그인 화면이 아직 없어서 URL의 ?access_token=<supabase access token>을
 * 한 번 붙여서 열면 localStorage에 저장해두고 이후 요청에 계속 재사용한다.
 * 실제 로그인 플로우가 만들어지면 이 모듈만 교체하면 된다.
 */
export function getAccessToken(): string | null {
  if (typeof window === "undefined") return null;

  const params = new URLSearchParams(window.location.search);
  const fromUrl = params.get("access_token");
  if (fromUrl) {
    window.localStorage.setItem(STORAGE_KEY, fromUrl);
    params.delete("access_token");
    const query = params.toString();
    window.history.replaceState({}, "", `${window.location.pathname}${query ? `?${query}` : ""}`);
  }

  return window.localStorage.getItem(STORAGE_KEY);
}

export function setAccessToken(token: string) {
  window.localStorage.setItem(STORAGE_KEY, token);
}

export function clearAccessToken() {
  window.localStorage.removeItem(STORAGE_KEY);
}
