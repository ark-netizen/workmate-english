// "1분 체험하기(로그인 불필요)" 게스트 전용 고정 콘텐츠 — LLM 호출 없이 항상 동일한 내용을 보여준다.
// 목적: (1) 첫인상을 예측 가능하고 안정적으로 통제 (2) 회원가입 여부가 불확실한 익명 세션에 LLM 비용을 쓰지 않음
// 시나리오 문구는 아래 TRIAL_CHARACTERS의 고정 첫 메시지와 반드시 같은 사건이어야 한다 —
// 세 메시지가 전부 "오후 3시까지 검토"를 요청하므로 시나리오도 "배송 지연 대응"이 아니라
// "배송 전 최종 검토"다. (예전에는 지연 대응으로 적혀 있어서 화면 설명과 실제 대화가 어긋났다.)
export const TRIAL_SCENARIO = {
  title: '고객사 DVD 배송 검토',
  summary: '고객사 DVD 배송 전 최종 내용을 오후 3시까지 검토하고, 동료·상사·거래처의 요청에 관계별 톤으로 답변해야 하는 하루.',
  project: 'DVD 배송 프로젝트',
  goal: '같은 검토 요청에 동료에게는 캐주얼하게, 상사에게는 명확하게, 거래처에는 격식 있게 답변하기',
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
    purposeKo: '검토 상황 확인',
    purposeEn: 'Checking review progress',
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
  korean_hint: '답장 고맙다는 뜻이에요. 다음 체험 안내에 따라 이어가보세요.',
  reply_hints: [],
  word_hints: [],
}

// 실제 리포트가 상대별(동료/상사/거래처) 톤을 어떻게 비교·교정해주는지 체험만으로도 느낄 수
// 있도록, 세 명 모두와의 대화를 반영한 예시 내용으로 채운다(실제 서비스는 매일 다른 상황·문장으로 생성됨)
export const TRIAL_DAILY_REPORT = {
  workday_summary:
    '오늘은 Jake(동료)·Ellen(상사)·Liam Carter(거래처)의 DVD 배송 검토 요청에 답장했어요. 상대에 따라 캐주얼·격식체·비즈니스 격식으로 톤을 구분해서 답장했고, 전반적으로 자연스러웠어요. 실제 서비스에서는 매일 다른 업무 상황으로 이런 리포트가 쌓여가요.',
  // 한 문장은 good_expressions와 corrections 중 정확히 한쪽에만 들어가야 한다 — 칭찬해놓고 같은
  // 문장을 교정하면 모순이고, 실제 리포트 프롬프트도 이를 명시적으로 금지한다.
  // 교정 예시는 반드시 "진짜 오류"여야 한다. 축약형(I'll)이나 시간 표기(3pm/3 p.m.)는 오류가 아니라
  // 캐주얼/표기 관례라, 그걸 고치라고 하면 체험판이 실제 리포트와 정반대의 영어를 가르치게 된다.
  good_expressions: [
    { text: 'Sure, I can check it by 3!', note: 'Jake(동료)에게 캐주얼하게 응답 — 짧고 친근한 톤을 잘 살렸어요.' },
    {
      text: 'Thank you for reaching out. We will complete the review by 3:00 PM.',
      note: 'Liam Carter(거래처)에게는 가장 격식 있는 표현을 사용해 신뢰감을 줬어요.',
    },
  ],
  corrections: [
    {
      before: "Of course, I'll have it reviewed until 3pm.",
      after: "Of course, I'll have it reviewed by 3pm.",
      after_ko: '물론이죠, 3시까지 검토해두겠습니다.',
      note: "마감 시각을 말할 땐 'until'이 아니라 'by'예요. 'until 3pm'은 3시까지 그 상태가 계속되다 끝난다는 뜻이라, 검토처럼 한 번에 끝나는 일에는 맞지 않아요. 축약형(I'll)은 그대로 두셔도 좋아요 — 상사에게 쓰기에 충분히 자연스럽습니다.",
    },
  ],
  register_feedback: [
    {
      role: 'colleague',
      their_quote: 'Hey, can you take a look by 3? 🙏',
      their_quote_ko: '3시까지 봐줄 수 있어? 🙏',
      user_quote: 'Sure, I can check it by 3!',
      note: '동료 사이에는 느낌표와 짧은 문장으로 캐주얼하게 응답하는 게 자연스러워요. 이모지도 부담 없이 써도 좋아요.',
    },
    {
      role: 'manager',
      their_quote: 'Could you please review this by 3pm today?',
      their_quote_ko: '오늘 3시까지 검토해주실 수 있을까요?',
      user_quote: "Of course, I'll have it reviewed until 3pm.",
      note: '상사의 정중한 요청에는 "Of course" 정도로 응답하면 예의 바르면서도 자연스러워요. 다만 마감 시각은 \'until\'이 아니라 \'by\'로 써야 해요(교정 내용 참고).',
    },
    {
      role: 'client',
      their_quote: 'We would kindly request your review by 3:00 PM.',
      their_quote_ko: '3시까지 검토를 정중히 요청드립니다.',
      user_quote: 'Thank you for reaching out. We will complete the review by 3:00 PM.',
      note: '거래처의 완곡하고 격식 있는 표현엔 "We will complete" 식으로 받아 응답하면 프로페셔널하게 느껴져요.',
    },
  ],
  recurring_issues: [
    "마감을 말할 때 'until'과 'by'를 헷갈리는 경우가 있어요. 'by 3pm'은 3시까지 끝내는 것, 'until 3pm'은 3시까지 계속하는 것이라 뜻이 달라져요.",
  ],
  recommended_expressions: [
    { en: 'I will have it ready by 3 p.m.', ko: '오후 3시까지 준비해두겠습니다.', note: '상사·거래처에게 시간 약속을 명확히 전달할 때 유용해요.' },
    { en: 'Thank you for your patience.', ko: '기다려주셔서 감사합니다.', note: '검토를 기다리게 할 때 상대를 배려하는 느낌을 더해줘요.' },
    { en: "I'll keep you posted.", ko: '진행 상황 계속 알려드릴게요.', note: '동료 사이의 캐주얼한 후속 안내 표현이에요.' },
  ],
  next_day_context:
    "내일은 오늘 교정한 ‘I’ll have it reviewed by 3pm.’과 ‘Thank you for your patience.’를 다른 업무 상황에서 다시 써보며, 상사·거래처에게 마감 시간과 검토 진행 상황을 정중하게 전달하는 표현을 연습해요.",
}
