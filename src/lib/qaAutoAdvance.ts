// 시연 영상 촬영용 QA 전용 토글 — 켜두면 답장을 보낼 때마다 다음 예정 연락을 기다리지 않고 바로 발송한다.
// 서버 상태가 아니라 이 브라우저에서만 켜지는 로컬 설정이라 localStorage로 충분하다.
const KEY = "qa_auto_advance";

export function isAutoAdvanceEnabled(): boolean {
  return localStorage.getItem(KEY) === "1";
}

export function setAutoAdvance(enabled: boolean): void {
  if (enabled) localStorage.setItem(KEY, "1");
  else localStorage.removeItem(KEY);
}
