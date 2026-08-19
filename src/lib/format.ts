// 브라우저/기기의 시스템 시간대가 KST가 아니어도(예: UTC로 설정된 환경) 항상 한국 시간 기준으로
// 보이도록 timeZone을 명시한다 — 이게 없으면 실제 시각과 몇 시간씩 차이나 보이는 문제가 생김
const KST = "Asia/Seoul";

export function formatTime(iso: string): string {
  return new Date(iso).toLocaleTimeString("ko-KR", {
    timeZone: KST,
    hour: "2-digit",
    minute: "2-digit",
  });
}

export function formatDateTime(iso: string): string {
  return new Date(iso).toLocaleString("ko-KR", {
    timeZone: KST,
    month: "long",
    day: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}

export function formatHoursMinutes(minutes: number): string {
  const h = Math.floor(minutes / 60);
  const m = minutes % 60;
  return `${h}시간 ${m}분`;
}
