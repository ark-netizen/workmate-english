# LLM 생성 레이어 (server/llm)

시나리오·역할 메시지·후속 반응·퇴근 리포트·익일 요약을 LLM으로 생성한다.
**서버 전용** — API 키는 여기(서버 함수)서만 쓰이고 브라우저로 나가지 않는다.

## 구성
- `registers.js` — 동료/상사/거래처 레지스터 규칙 + 반응 유형 + 생성 가드레일 (기획서 2-3·8-2·14-3)
- `prompts.js` — 5개 생성 함수의 프롬프트 빌더 + 출력 JSON 계약 (기획서 17장).
- `client.js` — 실제 LLM 호출 + JSON 파싱. **SOLAR(Upstage)** 전용.

## 사용 (`api/*` 서버 핸들러에서)
```js
import { generateScenario, generateRoleResponse } from '../server/llm/client.js'

const scenario = await generateScenario({ profile, previousMemory })
const reply = await generateRoleResponse({ scenario, character, history, userReply, profile })
```

## 필요 env (`.env.local` / Supabase Edge Functions Secrets, 커밋 금지)
- `SOLAR_API_KEY` — Upstage SOLAR API 키
- `SOLAR_MODEL` — 선택, 기본 `solar-pro2`

## 출력 검증
- 각 생성 함수의 출력 JSON은 `schemas.js`에서 검증하고, 파싱/검증 실패 시 폴백 문구로 대체해
  하루 흐름이 끊기지 않게 한다.
