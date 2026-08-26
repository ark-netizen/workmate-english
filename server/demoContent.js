// 시연(발표)용 고정 콘텐츠 — DEMO_ACCOUNT_EMAIL 계정에서만 사용된다.
//
// 목적: 발표 중 1일차에 오는 세 통의 연락을 100% 재현 가능하게 만들어, 발표자가 답변을 미리 준비할 수 있게 함.
//   - 들어오는 연락 3건만 고정(LLM 호출 없음 → 출근/배달이 즉시 끝남)
//   - 답장 첨삭·상대 반응·퇴근 리포트·복습·승급은 그대로 실제 LLM/로직을 탄다
//   - 체험판(is_trial)과 달리 실계정이므로 연차·승급·리포트 기능이 모두 살아있다
//
// 시나리오 의도: "같은 요청(메인 이미지 확정됐나요?)을 상대에 따라 세 가지 톤으로" —
// 제품의 핵심 주장(관계별 톤 구분)이 한 화면에서 바로 드러나도록 구성했다.
// 영어 난이도는 '초급' 기준으로 짧고 쉬운 어휘만 사용한다.
export const DEMO_ACCOUNT_EMAIL = 'test@test.com'

export const DEMO_SCENARIO = {
  title: '신곡 프로모션 메인 이미지 확정',
  summary: '신곡 프로모션에 쓸 메인 이미지 확정 여부를 동료·팀장·거래처가 각각 다른 톤으로 물어보는 하루.',
  project: '신곡 국내 프로모션',
  goal: '메인 이미지 확정 상황을 동료에게는 캐주얼하게, 팀장에게는 정중하게, 거래처에는 격식 있게 전달하기',
  practice_areas: ['진행 상황 공유', '정중한 확인 요청', '격식 있는 이메일 어투'],
}

export const DEMO_CHARACTERS = [
  {
    role: 'colleague',
    channel: 'messenger',
    name: 'Mina',
    title: '동료',
    register: '캐주얼, 이모지 자주 사용',
    color: '#1a56ff',
    firstMessage: 'Hey! Is the main image ready? 🙏',
    purposeKo: '이미지 확정 여부 확인',
    purposeEn: 'Checking if the image is ready',
  },
  {
    role: 'manager',
    channel: 'messenger',
    name: 'Jisoo',
    title: '팀장',
    register: '정중한 격식체',
    color: '#7f77dd',
    firstMessage: 'Could you please confirm if the main image is final?',
    purposeKo: '확정 여부 정중히 확인',
    purposeEn: 'Politely confirming the final image',
  },
  {
    role: 'client',
    channel: 'email',
    name: 'Daniel Kim',
    title: '거래처',
    register: '보수적이고 격식 있는 어투',
    color: '#ef476f',
    subject: 'Confirmation Request — Main Promotion Image',
    firstMessage: 'We would kindly ask you to confirm the final main image.',
    purposeKo: '격식 있는 확정 요청',
    purposeEn: 'Formal confirmation request',
  },
]

export function isDemoAccount(profile) {
  return String(profile?.email || '').toLowerCase() === DEMO_ACCOUNT_EMAIL
}
