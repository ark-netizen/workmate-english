# LLM 생성 레이어 (server/llm)

수아 담당. 시나리오·역할 메시지·후속 반응·퇴근 리포트·익일 요약을 LLM으로 생성한다.
**서버 전용** — API 키는 여기(서버 함수)서만 쓰이고 브라우저로 나가지 않는다.

## 구성
- `registers.js` — 동료/상사/거래처 레지스터 규칙 + 반응 유형 + 생성 가드레일 (기획서 2-3·8-2·14-3)
- `prompts.js` — 5개 생성 함수의 프롬프트 빌더 + 출력 JSON 계약 (기획서 17장).
- `client.js` — 실제 LLM 호출 + JSON 파싱. **SOLAR(Upstage)** 전용.

## 사용 (Vercel 서버 함수 등에서)
```js
import { generateScenario, generateRoleResponse } from '../server/llm/client.js'

const scenario = await generateScenario({ profile, previousMemory })
const reply = await generateRoleResponse({ scenario, character, history, userReply, profile })
```

## 필요 env (`.env.local` / Vercel, 커밋 금지)
- `SOLAR_API_KEY` — Upstage SOLAR API 키
- `SOLAR_MODEL` — 선택, 기본 `solar-pro2`

## 다음 작업
- [ ] 생성 결과를 `db/schema.sql` 테이블(scenarios/characters/conversations/messages/daily_reports/workday_memories)에 저장하는 서버 함수
- [ ] 알림 스케줄링 + Web Push 발송(push_tokens/notification_schedules) 연결
- [ ] 출력 스키마 검증(zod 등)으로 파싱 실패 대비
