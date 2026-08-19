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

// /qa로 분리해서 띄운 QA 도구 창(듀얼 모니터 시연 녹화용)이 조작한 뒤, 메인 창에 "지금 바로
// 새로고침해"라고 알리는 채널 — 같은 브라우저의 다른 창/탭끼리만 통하고 서버로는 안 나간다
export const QA_ACTIONS_CHANNEL = "go-qa-actions";

export function notifyQaAction(): void {
  if (typeof BroadcastChannel === "undefined") return;
  try {
    new BroadcastChannel(QA_ACTIONS_CHANNEL).postMessage("refresh");
  } catch {
    /* 무시 — 폴링으로 대체 반영 */
  }
}
