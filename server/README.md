# 백엔드 (server/ + api/)

서버 전용 로직 — 키(service_role / SOLAR_API_KEY / VAPID)는 여기서만 쓰이고 브라우저로 나가지 않는다.
`api/*` 핸들러가 `server/*` 라이브러리를 오케스트레이션하고, 배포 시에는
`supabase/functions/api`(Supabase Edge Function) 하나가 이 핸들러들을 경로별로 라우팅한다.

## 구조
```
server/
  db.js         Supabase 관리자 클라이언트 (service_role, RLS 우회)
  auth.js       Supabase JWT 검증 → app_users.id 매핑
  admin.js      관리자 권한(app_users.admin_role) 조회 + 관리자 대시보드 집계
  push.js       Web Push 발송 + 구독 저장 (VAPID)
  workday.js    출근~퇴근 오케스트레이션 (DB + LLM + Push)
  promotion.js  연속 출근·직급 승급·연차 규칙
  fieldWork.js  외근(연락 지연 후 재알림) 처리
  time.js       한국시간 기준 날짜/시각 유틸 (todayDateKST / todayAt)
  http.js       핸들러 공통 유틸 (메서드 검사 + 에러 응답)
  llm/          시나리오·메시지·리포트 생성 (SOLAR 기본) — server/llm/README.md
api/
  workday/today.js         GET       출근 및 오늘 상태 조회 (없으면 시나리오 생성 + 알림 예약)
  workday/deliver-next.js  POST      다음 예약 연락 즉시 발송 (QA·시연)
  workday/close.js         POST      퇴근: 리포트+익일요약 생성·저장
  workday/leave.js         POST      반차·연차·출근취소
  workday/field-work.js    POST      외근 시작(남은 연락 지연 후 재알림)
  workday/report/period.js GET/POST  주간·월간 리포트, 근무시간 이력, 출석 이력
  reply.js                 POST      사용자 답변 → 후속 반응 + 푸시
  push.js                  POST      SW 구독 저장 / 푸시 액션 처리
  profile.js               GET/POST  온보딩·프로필
  consent.js               POST      알림 수신 동의
  admin/dashboard.js       GET/POST/DELETE  관리자 대시보드 조회·계정 관리
  cron/dispatch.js         GET       예약시간 지난 알림 발송 (Supabase pg_cron)
```

## 흐름
1. **출근** `workday/today` → `generateScenario` → scenarios/characters/conversations/notification_schedules 저장
2. **연락 도착** cron `dispatch`(예약시간) 또는 `deliver-next`(즉시) → `generateRoleMessage` → messages 저장 + **Web Push**
3. **답변** `reply` → 저장 → `generateRoleResponse` → messages 저장 + Push
4. **퇴근** `close` → `generateDailyReport` + `createWorkdayMemory` 저장 (미응답 대화는 평가 제외)

## 필요 env (`.env.local` / Supabase Edge Functions Secrets, 커밋 금지) — `.env.example` 참고
- Supabase: `SUPABASE_URL`, `SUPABASE_SERVICE_ROLE_KEY`
- LLM: `SOLAR_API_KEY` (+ `LLM_PROVIDER`, `SOLAR_MODEL`)
- Push: `VAPID_PUBLIC_KEY`, `VAPID_PRIVATE_KEY`, `VAPID_SUBJECT`
  - 키 생성: `npx web-push generate-vapid-keys`
- Cron: `CRON_SECRET` (pg_cron이 `Authorization: Bearer $CRON_SECRET`로 호출)

## 주의
- 날짜 판정은 반드시 `server/time.js`의 `todayDateKST()`를 쓴다. 서버는 UTC로 돌기 때문에
  `new Date().toISOString().slice(0, 10)`을 쓰면 한국시간 자정~오전 9시 사이에 하루 전으로 계산된다.
- `close.js`의 `reset` / `resetAccount` / `advanceDay` 등 파괴적 QA 액션은 원래 `admin_role === 'full'`
  계정만 호출할 수 있다. **심사 기간 동안만** `ALLOW_QA_ACTIONS_FOR_ALL = true`로 이 검증을 끄고
  홈의 QA 패널을 심사자에게도 열어둔 상태이며, 끝나면 `false`로 되돌린다
  (프론트의 `SHOW_DESTRUCTIVE_QA_TOOLS`와 짝).
