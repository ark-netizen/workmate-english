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
export function buildReplyHints(_lastMessageBody: string | undefined): ReplyHintsData {
  return DEFAULT_HINTS;
}
