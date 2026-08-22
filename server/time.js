// 시간 계산 공용 유틸 — workday.js/reviewItems.js에서 각자 따로 구현했다가 한쪽만
// 고쳐지는 사고가 있었음(타임존 버그). 앞으로는 여기 하나만 고치면 되게 통합한다.

// 'HH:MM'(사용자가 입력한 한국 시간 기준 시각) → 그 시각의 실제 절대 시각(Date)
// ⚠️ Date.prototype.setHours()는 "서버 프로세스의 로컬 타임존" 기준으로 시/분을 설정한다.
// Vercel 서버리스 함수는 기본적으로 UTC로 돌아가므로, 이걸 쓰면 "오후 6시"가 UTC 18시
// = 한국 시간(UTC+9)으로는 다음날 새벽 3시가 되어버린다. 한국은 서머타임이 없는 고정
// UTC+9라, 서버 타임존과 무관하게 "오늘 날짜(한국 기준) + 그 시각 + KST 오프셋"을 직접
// 조합해 절대 시각을 만든다.
export function todayAt(hhmm) {
  const [h, m] = (hhmm || '10:00').split(':').map(Number)
  const kstDate = new Intl.DateTimeFormat('en-CA', {
    timeZone: 'Asia/Seoul',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).format(new Date()) // "YYYY-MM-DD" (한국 기준 오늘 날짜)
  return new Date(`${kstDate}T${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}:00+09:00`)
}
