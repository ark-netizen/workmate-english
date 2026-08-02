// 사용자가 직접 고른 비즈니스/게임 모드를 저장 — 메인 홈, 1분 체험하기, 서비스 소개 페이지 등
// 어디로 이동하든 같은 테마로 보이게 함. AdminPage처럼 페이지가 자체적으로 테마를 강제하는 경우는
// 사용자의 저장된 취향을 덮어쓰면 안 되므로, 이 저장은 사용자가 직접 토글을 눌렀을 때만 호출한다.
const KEY = "go_business_mode";

export function getStoredBusinessMode(): boolean | null {
  try {
    const v = window.localStorage.getItem(KEY);
    if (v === "business") return true;
    if (v === "game") return false;
    return null;
  } catch {
    return null;
  }
}

export function setStoredBusinessMode(value: boolean): void {
  try {
    window.localStorage.setItem(KEY, value ? "business" : "game");
  } catch {
    /* localStorage 사용 불가(프라이빗 모드 등) — 이번 세션만 적용되고 저장은 안 됨 */
  }
}
