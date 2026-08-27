# 백엔드 로컬 실행 & 연결 테스트

프론트에서 실제 백엔드(API + LLM + DB + 푸시)를 연결해 확인하는 절차.
`/api/*` 핸들러는 Vite로는 안 돌아간다. 배포 백엔드는 **Supabase Edge Function**
(`supabase/functions/api`)이므로, 로컬에서도 **`supabase functions serve`** 로 따로 띄우고
프론트의 `VITE_API_BASE_URL`이 그 주소를 가리키게 한다.

## 1. 키 준비 — `.env.local` 생성
`.env.example`를 복사해 `.env.local`로 만들고 실제 값 채우기 (커밋 금지):

```
# 프론트(브라우저)
VITE_SUPABASE_URL=https://zchagwujhqjfteehexmp.supabase.co
VITE_SUPABASE_ANON_KEY=<anon public>
VITE_VAPID_PUBLIC_KEY=<VAPID public>
VITE_API_BASE_URL=http://127.0.0.1:54321/functions/v1

# 서버(비공개) — 배포 시에는 Supabase Edge Functions → Secrets 에 등록
SUPABASE_URL=https://zchagwujhqjfteehexmp.supabase.co
SUPABASE_SERVICE_ROLE_KEY=<service_role>
SOLAR_API_KEY=<up_...>
VAPID_PUBLIC_KEY=<VAPID public>
VAPID_PRIVATE_KEY=<VAPID private>
VAPID_SUBJECT=mailto:본인메일
CRON_SECRET=아무_문자열
```

- Supabase 키: 대시보드 **Settings → API**
- VAPID 키 생성: `npx web-push generate-vapid-keys` → public은 `VAPID_PUBLIC_KEY`와 `VITE_VAPID_PUBLIC_KEY` 둘 다에, private은 `VAPID_PRIVATE_KEY`에

## 2. Supabase 설정
- **Authentication → Providers → Anonymous sign-ins 활성화** (테스트 익명 로그인용)
- (DB 스키마·RLS는 이미 적용됨. 브라우저는 service_role API를 경유하므로 anon 테이블 정책 없이도 OK)

## 3. 실행
터미널 두 개를 쓴다.

```bash
# (1) 백엔드 — Supabase Edge Function
npm i -g supabase          # 최초 1회 (또는 npx supabase)
supabase login             # 최초 1회
supabase functions serve api --env-file .env.local
# → http://127.0.0.1:54321/functions/v1/api/*

# (2) 프론트 — Vite
npm install
npm run dev                # → http://localhost:5173
```

## 4. 연결 테스트
초기 개발 때 쓰던 `/backend-test` 진단 페이지는 실제 화면이 붙은 뒤 제거했다.
지금은 앱 본 화면으로 그대로 확인한다.

1. `http://localhost:5173` → **1분 체험하기** 또는 로그인 후 온보딩
2. **출근** — 시나리오·인물 생성(응답이 오는 데 몇 초 걸림)
3. QA 패널의 **연락 바로 받기** — 예정 시각을 기다리지 않고 다음 연락 발송 + 웹 푸시
4. 영어로 **답변** — 상대의 후속 반응 확인
5. **퇴근** — 리포트 + 익일 요약 생성

막히면 `supabase functions serve` 터미널의 로그에 요청·에러가 그대로 찍힌다.

## 흔한 문제
- `Supabase 설정 ❌` → `.env.local`의 VITE_ 키 확인 후 `npm run dev` 재시작
- API 호출이 전부 실패 → `VITE_API_BASE_URL`이 `functions serve` 주소와 맞는지, 함수 터미널이 떠 있는지 확인
- `인증 실패` → Anonymous sign-ins 미활성화
- start에서 지연/에러 → `SOLAR_API_KEY` 또는 LLM 응답 JSON 파싱 (schemas.js 검증 로그 확인)
- 푸시 안 옴 → VAPID 키 3개 정합성, localhost는 https 아니어도 SW/푸시 허용됨
