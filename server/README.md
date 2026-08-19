# 백엔드 (server/ + api/)

수아 담당. 서버 전용 로직 — 키(service_role / SOLAR_API_KEY / VAPID)는 여기서만 쓰이고 브라우저로 나가지 않는다.
Vercel 서버리스 함수(`api/*`)가 `server/*` 라이브러리를 오케스트레이션한다.

## 구조
```
server/
  db.js        Supabase 관리자 클라이언트 (service_role, RLS 우회)
  auth.js      Supabase JWT 검증 → app_users.id 매핑
  push.js      Web Push 발송 + 구독 저장 (VAPID)
  workday.js   출근~퇴근 오케스트레이션 (DB + LLM + Push)
  http.js      핸들러 공통 유틸
  llm/         시나리오·메시지·리포트 생성 (SOLAR 기본) — server/llm/README.md
api/
  workday/start.js         POST  출근: Workday+시나리오 생성, 알림 예약
  workday/deliver-next.js  POST  시연: 다음 예약 연락 즉시 발송
  workday/close.js         POST  퇴근: 리포트+익일요약 생성·저장
  reply.js                 POST  사용자 답변 → 후속 반응 + 푸시
  push/subscribe.js        POST  SW 구독 저장
  cron/dispatch.js         GET   예약시간 지난 알림 발송 (Vercel Cron)
```

## 흐름 (기획서 5장 핵심 흐름 = 서버측)
1. **출근** `start` → `generateScenario` → scenarios/characters/conversations/notification_schedules 저장
2. **연락 도착** cron `dispatch`(예약시간) 또는 `deliver-next`(시연) → `generateRoleMessage` → messages 저장 + **Web Push**
3. **답변** `reply` → 저장 → `generateRoleResponse` → messages 저장 + Push
4. **퇴근** `close` → `generateDailyReport` + `createWorkdayMemory` 저장 (미응답 대화는 평가 제외)

## 필요 env (`.env.local` / Vercel, 커밋 금지) — `.env.example` 참고
- Supabase: `SUPABASE_URL`, `SUPABASE_SERVICE_ROLE_KEY`
- LLM: `SOLAR_API_KEY` (+ `LLM_PROVIDER`, `SOLAR_MODEL`)
- Push: `VAPID_PUBLIC_KEY`, `VAPID_PRIVATE_KEY`, `VAPID_SUBJECT`
  - 키 생성: `npx web-push generate-vapid-keys`
- Cron: `CRON_SECRET` (Vercel Cron이 `Authorization: Bearer $CRON_SECRET`로 호출)

## 아직 안 된 것
- **프론트 ↔ API 연결** (프론트 프로토타입은 현재 인메모리 시뮬레이션. 실제 화면에서 이 엔드포인트 호출로 교체 필요)
- **RLS 정책**(owner-scoped) — 프론트가 anon 키로 DB 직접 읽을 경우 필요 (지금은 서버 service_role 경유라 미필요)
- 반차/연차/출근취소 처리 엔드포인트
- 출근기록/리워드 집계
```
