import type { MessageHints } from "@/types/domain";

export interface ReplyHintsData {
  words: string[];
  korean: string;
  sentence: string;
}

// test@test.com 시연 계정은 첫 연락 자체를 LLM 없이 고정 콘텐츠로 저장한다.
// 따라서 DB에 실제 LLM 힌트가 없더라도, 고정된 첫 문장과 정확히 매칭해 힌트까지 항상 같은 내용으로 보여준다.
// 기존에 이미 만들어진 오늘자 QA 데이터도 초기화할 필요 없이 이 매칭만으로 바로 복구된다.
const DEMO_HINTS_BY_MESSAGE: Record<string, ReplyHintsData> = {
  "Hey! Is the main image ready? 🙏": {
    words: [
      "not yet (아직 아니야)",
      "final approval (최종 승인)",
      "confirmed (확정된)",
      "I'll let you know (알려줄게)",
    ],
    korean: "메인 이미지가 아직 최종 확정 전이라면, 현재 상태와 확정되는 즉시 알려주겠다는 내용을 짧고 캐주얼하게 답해보세요.",
    sentence: "Not yet. I'll let you know when it's ready.",
  },
  "Could you please confirm if the main image is final?": {
    words: [
      "not final yet (아직 최종 확정 전)",
      "waiting for final approval (최종 승인 대기 중)",
      "update you (알려드리다)",
      "as soon as (즉시)",
    ],
    korean: "아직 최종 확정 전이라면 현재 상태를 정중하게 보고하고, 확정되는 즉시 다시 알려드리겠다고 답해보세요.",
    sentence: "It is not final yet. I will update you soon.",
  },
  "We would kindly ask you to confirm the final main image.": {
    words: [
      "has not been finalized (아직 최종 확정되지 않았다)",
      "awaiting final approval (최종 승인 대기 중)",
      "confirmed version (확정본)",
      "as soon as it is available (준비되는 즉시)",
    ],
    korean: "메인 이미지가 아직 최종 확정 전임을 격식 있게 안내하고, 확정본이 준비되는 즉시 전달하겠다고 답해보세요.",
    sentence:
      "Dear Mr. Kim,\n\nThe main image is not final yet. I will send it when it is ready.\n\nBest regards,",
  },
};

const getDemoReplyHints = (lastMessageBody: string | undefined): ReplyHintsData | undefined => {
  const body = lastMessageBody?.trim();
  return body ? DEMO_HINTS_BY_MESSAGE[body] : undefined;
};

// 상대 메시지에 실제 LLM 힌트가 실려있으면 그걸 그대로 쓰고(채널별로 다르게 생성됨 —
// 이메일은 인사말+본문+맺음말을 갖춘 실제 이메일 답장 초안, 메신저는 짧은 답장 방향),
// 스크립트형 메시지라 힌트가 없을 때만 아래 고정 힌트로 대체한다.
export function resolveReplyHints(
  lastMessageBody: string | undefined,
  realHints: MessageHints | undefined,
): ReplyHintsData {
  // QA 시연용 고정 메시지는 DB에 남아 있는 이전/불완전 힌트보다 고정 힌트를 우선한다.
  // 발표 중 항상 같은 문장 → 같은 힌트가 나와야 하기 때문.
  const demoHints = getDemoReplyHints(lastMessageBody);
  if (demoHints) return demoHints;

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

const DEFAULT_HINTS: ReplyHintsData = {
  words: ["confirm", "follow up", "appreciate", "clarify"],
  korean: "상대방의 요청을 확인했다는 점과, 다음 행동이나 회신 예정 시점을 알려주면 좋아요.",
  sentence: "Thank you for letting me know — I'll look into this and get back to you shortly.",
};

// 실제 힌트는 LLM이 메시지와 함께 만들어 저장하므로(korean_hint/reply_hints/word_hints), 여기로 오는 건
// "이 메시지는 원래 힌트가 없는" 경우뿐이다(스크립트형 메시지, 혹은 대화를 자연스럽게 마무리하려고 일부러
// 힌트를 비운 마지막 응답 등). 예전엔 본문 키워드로 주제를 추측해 그럴싸한 힌트를 만들어줬지만, 우연히
// 엉뚱한 단어(예: "ASAP")만 걸려도 본문과 전혀 다른 방향의 힌트가 나가는 문제가 있어 — 항상 안전한
// 범용 힌트 하나로만 대체한다.
export function buildReplyHints(lastMessageBody: string | undefined): ReplyHintsData {
  return getDemoReplyHints(lastMessageBody) ?? DEFAULT_HINTS;
}
