# 백엔드 로컬 실행 & 연결 테스트 (수아용)

목업 프론트에서 실제 백엔드(API + LLM + DB + 푸시)를 연결해 확인하는 절차.
`/api/*` 함수는 Vite로는 안 돌아가므로 **`vercel dev`** 로 띄운다.

## 1. 키 준비 — `.env.local` 생성
`.env.example`를 복사해 `.env.local`로 만들고 실제 값 채우기 (커밋 금지):

```
# 프론트(브라우저)
VITE_SUPABASE_URL=https://zchagwujhqjfteehexmp.supabase.co
VITE_SUPABASE_ANON_KEY=<anon public>
VITE_VAPID_PUBLIC_KEY=<VAPID public>

# 서버(비공개)
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
```bash
npm install
npm i -g vercel      # 최초 1회
vercel login         # 최초 1회
vercel dev           # 프론트 + /api 를 http://localhost:3000 에 함께 서빙
```

## 4. 연결 테스트
브라우저에서 **http://localhost:3000/backend-test** 열고 순서대로:

1. **익명 로그인** — Supabase 세션 생성
2. **출근(start)** — 시나리오 생성 + 저장 → 응답에 workday/scenario/conversations
3. **다음 연락 받기** — 역할 메시지 생성 + 저장 + 푸시 → 응답에 conversationId + body
4. **답변 보내기** — 후속 반응 생성 → 응답에 reaction_type + body
5. **퇴근(close)** — 리포트 + 익일 요약 생성·저장
- **푸시 구독** — SW 구독 저장. 이후 3/4번 때 브라우저 알림이 뜸(다른 탭에서도)

각 버튼 아래 JSON 응답이 그대로 찍히므로, 어디서 막히는지 바로 보인다.

## 흔한 문제
- `Supabase 설정 ❌` → `.env.local`의 VITE_ 키 확인, `vercel dev` 재시작
- `인증 실패` → Anonymous sign-ins 미활성화
- start에서 지연/에러 → `SOLAR_API_KEY` 또는 LLM 응답 JSON 파싱 (schemas.js 검증 로그 확인)
- 푸시 안 옴 → VAPID 키 3개 정합성, localhost는 https 아니어도 SW/푸시 허용됨
