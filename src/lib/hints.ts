import type { MessageHints } from "@/types/domain";

export interface ReplyHintsData {
  words: string[];
  korean: string;
  sentence: string;
}

// 상대 메시지에 실제 LLM 힌트가 실려있으면 그걸 그대로 쓰고(채널별로 다르게 생성됨 —
// 이메일은 인사말+본문+맺음말을 갖춘 실제 이메일 답장 초안, 메신저는 짧은 답장 방향),
// 스크립트형 메시지라 힌트가 없을 때만 아래 고정 힌트로 대체한다.
export function resolveReplyHints(
  lastMessageBody: string | undefined,
  realHints: MessageHints | undefined,
): ReplyHintsData {
  if (realHints?.replyHints?.length) {
    return {
      words: (realHints.wordHints ?? []).map((w) => (w.ko ? `${w.en} (${w.ko})` : w.en)),
      korean: realHints.koreanHint ?? "",
      // 문장 힌트는 항상 1개만 온다(서버에서 1개로 잘라 저장)
      sentence: realHints.replyHints[0],
    };
  }
  return buildReplyHints(lastMessageBody);
}

interface HintTopic {
  keywords: string[];
  words: string[];
  korean: string;
  sentence: string;
}

const TOPICS: HintTopic[] = [
  {
    keywords: ["meeting", "schedule", "call", "미팅", "회의"],
    words: ["reschedule", "agenda", "availability", "confirm"],
    korean: "일정 조율이 필요한 상황이에요. 가능한 시간대를 제안하거나 일정을 확인해달라고 요청해보세요.",
    sentence: "Does Thursday afternoon work for you, or should we find another time?",
  },
  {
    keywords: ["invoice", "payment", "budget", "cost", "인보이스", "결제", "비용"],
    words: ["invoice", "payment", "process", "approve"],
    korean: "비용이나 결제와 관련된 요청이에요. 처리 상태나 예상 일정을 알려주면 좋아요.",
    sentence: "I'll check with our finance team and confirm the payment status by tomorrow.",
  },
  {
    keywords: ["deadline", "due", "urgent", "asap", "마감", "급히"],
    words: ["deadline", "priority", "extension", "follow up"],
    korean: "마감이나 우선순위와 관련된 내용이에요. 처리 가능 여부와 예상 완료 시점을 알려주세요.",
    sentence: "I understand this is time-sensitive — I'll prioritize it and update you by end of day.",
  },
  {
    keywords: ["thanks", "thank you", "appreciate", "감사"],
    words: ["appreciate", "glad", "welcome", "pleasure"],
    korean: "감사 인사에 대한 답변이에요. 짧게 감사를 주고받고 다음 이야기로 넘어가면 자연스러워요.",
    sentence: "Happy to help — let me know if there's anything else you need.",
  },
];

const DEFAULT_HINTS: ReplyHintsData = {
  words: ["confirm", "follow up", "appreciate", "clarify"],
  korean: "상대방의 요청을 확인했다는 점과, 다음 행동이나 회신 예정 시점을 알려주면 좋아요.",
  sentence: "Thank you for letting me know — I'll look into this and get back to you shortly.",
};

// 실제 힌트 생성은 LLM 기반 백엔드 연동이 필요해서, 연동 전까지는 최근 메시지의 키워드로 간단한 힌트를 고른다.
export function buildReplyHints(lastMessageBody: string | undefined): ReplyHintsData {
  const text = (lastMessageBody ?? "").toLowerCase();
  const matched = TOPICS.find((topic) => topic.keywords.some((keyword) => text.includes(keyword)));

  return matched
    ? { words: matched.words, korean: matched.korean, sentence: matched.sentence }
    : DEFAULT_HINTS;
}
