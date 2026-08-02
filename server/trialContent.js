// "1분 체험하기(로그인 불필요)" 게스트 전용 고정 콘텐츠 — LLM 호출 없이 항상 동일한 내용을 보여준다.
// 목적: (1) 첫인상을 예측 가능하고 안정적으로 통제 (2) 회원가입 여부가 불확실한 익명 세션에 LLM 비용을 쓰지 않음
export const TRIAL_SCENARIO = {
  title: '고객사 DVD 배송 지연 대응',
  summary: '거래처로 나가는 배송이 하루 지연되면서, 동료·상사·거래처에게 각각 다른 톤으로 상황을 전달해야 하는 하루.',
  project: 'DVD 배송 프로젝트',
  goal: '지연 상황을 팀 내부에는 캐주얼하게, 상사에게는 정중하게, 거래처에는 격식 있게 전달하기',
  practice_areas: ['정중한 요청 표현', '상황 보고', '격식 있는 이메일 어투'],
}

export const TRIAL_CHARACTERS = [
  {
    role: 'colleague',
    channel: 'messenger',
    name: 'Jake',
    title: '동료',
    register: '캐주얼, 이모지 자주 사용',
    color: '#1a56ff',
    firstMessage: 'Hey, can you take a look by 3? 🙏',
    purposeKo: '지연 상황 공유',
    purposeEn: 'Sharing the delay',
  },
  {
    role: 'manager',
    channel: 'messenger',
    name: 'Ellen',
    title: '상사',
    register: '정중한 격식체',
    color: '#7f77dd',
    firstMessage: 'Could you please review this by 3pm today?',
    purposeKo: '검토 마감 확인',
    purposeEn: 'Confirming review deadline',
  },
  {
    role: 'client',
    channel: 'email',
    name: 'Liam Carter',
    title: '거래처',
    register: '보수적이고 격식 있는 어투',
    color: '#ef476f',
    subject: 'Request for Review — DVD Shipment',
    firstMessage: 'We would kindly request your review by 3:00 PM.',
    purposeKo: '정중한 검토 요청',
    purposeEn: 'Polite review request',
  },
]

// 유저가 무엇을 보내든 항상 같은 확인 답장으로 마무리(체험판이라 채점·후속 대화 없음)
export const TRIAL_REPLY = {
  body: "Thanks, sounds good! I'll wait to hear back. 👍",
  subject: null,
  reaction_type: 'positive',
  needs_followup: false,
  korean_hint: '답장 고맙다는 뜻이에요. 체험은 여기까지 — 퇴근하고 리포트를 확인해보세요.',
  reply_hints: [],
  word_hints: [],
}

export const TRIAL_DAILY_REPORT = {
  workday_summary:
    '체험판에서는 Jake·Ellen·Liam Carter 중 한 명과 짧게 대화를 나눠봤어요. 실제 서비스에서는 매일 세 명 모두와 대화하며 훨씬 풍부한 리포트를 받아볼 수 있어요.',
  good_expressions: [
    { text: 'Sure, I can check it by 3!', note: '요청에 자연스럽게 응답하는 캐주얼 표현이에요.' },
  ],
  corrections: [],
  register_feedback: { colleague: '캐주얼한 톤을 잘 사용했어요.', manager: '-', client: '-' },
  recurring_issues: [],
  recommended_expressions: [
    { en: 'I will have it ready by 3pm.', ko: '3시까지 준비해두겠습니다.', note: '상사·거래처에게 시간 약속을 명확히 전달할 때 유용해요.' },
  ],
  next_day_context: null,
}
