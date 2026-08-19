# 프론트 개발 요청 — 온보딩 / 웹알림 / 업무회고 / 설정

> 아래 4가지 화면·기능에 필요한 API는 전부 백엔드에 구현·테스트 완료된 상태입니다. 화면 UI/UX는 자유롭게 만들어주시면 되고, 여기 적힌 API 계약(엔드포인트·요청/응답 형태)대로만 호출해주시면 됩니다.

모든 API는 `Authorization: Bearer <supabase access_token>` 헤더가 필요합니다 (기존에 붙이시던 방식 그대로).

---

## 0. 공통 — 오늘의 데이터 조회 (홈/메신저/이메일/업무회고가 전부 이걸 씀)

**`GET /api/workday/today`**

로그인한 사용자의 "오늘" 상태를 한 번에 반환합니다. 온보딩 여부 체크도 여기서 같이 됩니다.

- 프로필(온보딩) 이 없으면 → `{ "needsOnboarding": true }` 만 옵니다. 이때 온보딩 화면으로 보내주세요.
- 있으면 → 오늘 출근 상태가 없을 시 자동으로 하루치 시나리오를 생성해서 아래 형태로 돌려줍니다. (별도로 "출근" 버튼을 누르게 할 필요 없음 — 앱 진입 = 자동 출근)

```json
{
  "needsOnboarding": false,
  "workStatus": "working",
  "workday": { "id": "...", "state": "COMMUTING", "started_at": "...", "ended_at": null },
  "contacts": [
    { "id": "캐릭터ID", "name": "Jin Park", "role": "colleague", "title": "Frontend Developer" }
  ],
  "conversations": [
    {
      "id": "대화ID",
      "contactId": "캐릭터ID",
      "channel": "messenger",
      "unreadCount": 0,
      "updatedAt": "2026-07-25T04:45:53Z",
      "messages": [
        { "id": "...", "from": "contact", "body": "Hey! ...", "timestamp": "..." },
        { "id": "...", "from": "user", "body": "I can send...", "timestamp": "..." }
      ]
    }
  ],
  "emailThreads": [
    {
      "id": "대화ID",
      "contactId": "캐릭터ID",
      "channel": "email",
      "subject": "...",
      "unreadCount": 1,
      "updatedAt": "...",
      "emails": [{ "id": "...", "from": "contact", "subject": "...", "body": "...", "timestamp": "..." }]
    }
  ],
  "todayItems": [
    { "id": "대화ID", "contactId": "캐릭터ID", "channel": "messenger", "targetId": "대화ID", "title": "마지막 메시지 미리보기", "status": "pending", "dueAt": "..." }
  ],
  "report": null
}
```

- `workStatus`: `"before-work" | "working" | "off-work" | "leave"` 중 하나
- `todayItems[].status`: `"pending" | "answered" | "resolved"` — 홈 화면 목록에 그대로 쓰시면 됩니다
- `report`: 아직 퇴근 전이면 `null`. 퇴근 후에는 아래 3장 형태로 채워집니다.
- 이 API를 호출하는 시점에 도착 예정 시간이 지난 연락이 있으면 자동으로 발송 처리되니, 그냥 필요할 때마다(홈 진입, 새로고침 등) 불러주시면 최신 상태가 유지됩니다.

**메신저/이메일 답장** — `POST /api/reply`
```json
{ "conversationId": "대화ID", "text": "사용자가 입력한 영어 답변" }
```
→ 상대방 후속 반응이 생성·저장되고 응답으로 옵니다. 보낸 후 `GET /api/workday/today`를 다시 호출해서 화면을 갱신하시면 됩니다.
(대화는 최대 3턴까지만 진행되고, 그 이후엔 상대가 자연스럽게 "나중에 다시 얘기하자"며 마무리합니다 — 별도 처리 필요 없음)

**퇴근** — `POST /api/workday/close` (body: `{ "workdayId": "..." }`, workdayId는 `today` 응답의 `workday.id`)
→ 리포트가 생성·저장됩니다. 이후 `GET /api/workday/today`를 다시 부르면 `report`가 채워져서 옵니다.

**반차/연차/출근취소** — `POST /api/workday/leave` (body: `{ "kind": "annual" | "half_day" | "cancel" }`), 구현·테스트 완료
- `half_day`/`annual`: 아직 안 보낸 오늘 남은 연락을 전부 건너뛰고 하루를 그 상태로 마감합니다. 이미 도착해서 답변 주고받은 대화는 그대로 남습니다.
- `cancel`(출근 취소): **출근 직후 유예 시간에만** 가능합니다 (이미 연락이 하나라도 도착했으면 취소 불가 — 이 경우 `{ "skipped": true, "reason": "cancel-window-closed" }`가 옵니다). 취소되면 오늘 시나리오가 통째로 사라지고, 다시 홈에 들어가면 완전히 새 시나리오로 시작됩니다.
- 홈 화면의 "반차 사용" 버튼(3장 MVP 화면 범위에 이미 있던 항목)을 이 API에 연결하시면 됩니다. 성공하면 `{ "leave": true, "kind": "...", "state": "HALF_DAY"|"ON_LEAVE" }`, 실패/불가하면 `{ "skipped": true, "reason": "..." }`가 옵니다.

---

## 1. 온보딩 페이지

첫 방문 시 `GET /api/workday/today`가 `{ needsOnboarding: true }`를 반환하면 이 화면으로 보내주세요.

### 입력 필드

| 필드 | 타입 | 필수 | 비고 |
|---|---|---|---|
| 업종 | 아래 카테고리 중 선택(드롭다운/칩) | ✅ | 자유 입력 금지 — 카테고리 목록 참고 |
| 직무 | 자유 텍스트 | ✅ | 예: "서비스 기획자", "해외영업 담당자" |
| 주요 업무 | 자유 텍스트(여러 줄 가능) | ✅ | 예: "신규 기능 기획, 유관부서 커뮤니케이션" |
| 자주 소통하는 대상 | 자유 텍스트 | ✅ | 예: "개발팀 동료, 팀장, 해외 파트너사 담당자" |
| 영어 난이도 | 초급/중급/고급 3지선다 | ✅ | 기본 선택값 "중급" |

**업종은 왜 선택형이어야 하나요?** 직군별로 다른 시나리오가 나오는 기능이 이미 구현·검증됐는데(IT→기능 배포 대응, 제조업 해외영업→바이어 납기 협의 등 업종에 딱 맞게 생성됨을 확인함), 업종을 자유 입력으로 두면 `IT 회사`/`it업계`/`소프트웨어`처럼 표현이 제각각이라 생성 품질이 들쭉날쭉해집니다. 직무는 자유 입력이어도 문제없이 잘 반영됩니다(오타·비격식 표현도 잘 이해함 — 확인됨).

**업종 카테고리 목록** (1차 안, 확정 아님 — 화면상 자연스럽게 다듬으셔도 됩니다):
IT/소프트웨어, 제조/생산, 무역/유통·이커머스, 금융/보험, 의료/헬스케어, 건설/부동산, 미디어/엔터테인먼트, 교육, 공공/비영리, 기타(선택 시 텍스트 입력창 노출)

### API

**`POST /api/profile`**
```json
{
  "industry": "IT/소프트웨어",
  "job_role": "서비스 기획자",
  "main_tasks": "신규 기능 기획, 유관부서 커뮤니케이션, 일정 조율",
  "contacts": "개발팀 동료, 팀장, 해외 파트너사 담당자",
  "english_level": "intermediate"
}
```
→ 저장 후 홈(`/`)으로 이동하면 됩니다. `GET /api/workday/today`가 자동으로 첫 시나리오를 생성해서 보여줍니다.

---

## 2. 웹알림 프론트 (Service Worker / 푸시)

- Service Worker 파일은 이미 있습니다 — `public/sw.js` (그대로 쓰시면 됩니다, 수정 불필요).
- 구독 생성 헬퍼도 있습니다 — `src/lib/api.js`의 `subscribePush()` 함수를 그대로 호출하시면 브라우저 알림 권한 요청 → 구독 생성 → 서버 저장(`POST /api/push/subscribe`)까지 한 번에 처리됩니다.
- VAPID 공개키는 `.env.local`의 `VITE_VAPID_PUBLIC_KEY`에 이미 있습니다 (배포 환경 변수는 수아가 등록).
- 알림 클릭 시 이동 경로는 서버가 알림 데이터에 `url` 필드로 실어 보내니(`/messenger/:id` 또는 `/email/:id`), `sw.js`의 `notificationclick` 핸들러가 그 경로로 이동시켜줍니다 — 이것도 이미 구현돼 있어서 추가 작업 없음.

### 외근 — `[지금 외근 중]` 버튼

**`POST /api/workday/field-work`** (body 없음)

아직 도착 안 한(예정 상태) 오늘의 남은 연락을 전부 90분 뒤로 미룹니다. 이미 도착한 대화나 끝난 대화는 안 건드립니다. "지금 바빠서 답 못 하니 나머지 연락 좀 늦게 와줘"라는 의미로, 하루 전체를 쉬는 반차/연차와는 다릅니다. 여러 번 눌러도 되고(누를 때마다 90분 추가로 밀림), `src/lib/workday.js`의 `goOnFieldWork()` 함수를 그대로 쓰시면 됩니다.

버튼 위치: 알림 클릭 후 이동한 대화 화면 상단 — iOS에서 알림 액션 버튼이 안 먹히는 경우의 대체 경로로 씁니다.

응답: `{ "fieldWork": true, "delayMinutes": 90, "rescheduled": [...] }` 또는 미룰 게 없으면 `{ "skipped": true, "reason": "..." }`.

---

## 3. 업무회고(리포트) 페이지

`GET /api/workday/today`의 `report` 필드를 그대로 씁니다. 퇴근 전엔 `null`이니 "아직 퇴근 전입니다" 같은 안내만 보여주시면 됩니다. 퇴근(`POST /api/workday/close`) 후 다시 `today`를 부르면 아래 형태로 채워집니다.

```json
{
  "date": "2026-07-25",
  "summary": "오늘 업무 요약 (한 문단)",
  "goodExpressions": ["\"I'll send it right over.\" — 즉시 처리 표현 설명"],
  "improvementPoints": ["\"I think maybe...\" → \"I'll confirm and get back to you.\" — 교정 설명"],
  "nextPreview": "내일 이어질 내용 미리보기"
}
```

주의: 성적표처럼 보이면 안 됩니다 (점수·정답표시 없음, 이미 원칙 문서에 있는 그대로).

---

## 4. 설정 화면

### 4-1. 동료/상사/거래처 이름·성격 (선택 기능)

값을 채워두면 다음 시나리오부터 그 이름·성격이 계속 유지됩니다(비워두면 지금처럼 매일 새로 생성). 실제로 "sarcastic and blunt"라고 넣으면 메시지 톤에 그대로 반영되는 것까지 확인했습니다.

입력 필드 (전부 선택): 동료 이름/성격, 상사 이름/성격, 거래처 이름/성격 — 성격은 "차분하고 말수 적음"처럼 짧은 문장 하나면 충분합니다.

### 4-2. 영어 난이도

온보딩 때 고른 난이도를 여기서 언제든 바꿀 수 있어야 합니다. 바꾸면 다음 시나리오 생성부터 바로 반영됩니다.

### API (4-1, 4-2 공통 — 부분 업데이트 가능)

**`GET /api/profile`** → 현재 저장된 값 전부 반환 (설정 화면 진입 시 초기값 채우기용)

**`POST /api/profile`** — 바꾸고 싶은 필드만 보내면 됩니다 (나머지는 그대로 유지됨)
```json
{
  "colleague_name": "Mina",
  "colleague_personality": "차분하고 논리적",
  "manager_name": "David",
  "manager_personality": "유머러스하지만 마감엔 엄격함",
  "client_name": "Sarah",
  "client_personality": "격식 있고 신중함",
  "english_level": "advanced"
}
```
