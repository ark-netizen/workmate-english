import type { ContactRole } from "@/types/domain";

// "1분 체험하기" 게스트가 실제 화면(메신저/이메일)에서 바로 눌러볼 수 있도록 미리 채워두는 답장 문구.
// 서버는 체험 계정에 항상 같은 고정 답장을 돌려주므로(server/trialContent.js), 이 문구 자체는 무엇이든
// 상관없다 — 사람이 실제로 답장을 "고른다"는 느낌을 주기 위한 예시일 뿐.
export const TRIAL_REPLY_TEXT: Partial<Record<ContactRole, string>> = {
  colleague: "Sure, I can check it by 3!",
  manager: "Of course, I'll have it reviewed by 3pm.",
  client: "Thank you for reaching out. We will complete the review by 3:00 PM.",
};
