import { useRef } from "react";
import { useParams } from "react-router-dom";
import type { EmailThread } from "@/types/domain";
import { useWorkday } from "@/context/useWorkday";
import { EmailView } from "@/components/email/EmailView";
import { NotFoundPage } from "@/pages/NotFoundPage";

export function EmailThreadPage() {
  const { threadId } = useParams<{ threadId: string }>();
  const { getEmailThreadById } = useWorkday();
  const thread = threadId ? getEmailThreadById(threadId) : undefined;

  // 답장 직후 refresh()(자동진행 QA 토글이면 연달아 한 번 더)로 스레드 목록이 다시 만들어지는 사이,
  // 이 id가 새 배열에 한 프레임 순간적으로 안 잡힐 때가 있다 — 그때마다 바로 "찾을 수 없음"으로
  // 튕기면 화면(메일 제목·본문 등)이 통째로 사라졌다 나타나는 것처럼 보인다. 같은 id를 보는 동안은
  // 마지막으로 정상 로드됐던 내용을 유지해서 진짜로 없어진 게 아니면 화면이 안 흔들리게 한다
  const lastRef = useRef<EmailThread | undefined>(undefined);
  const lastIdRef = useRef<string | undefined>(undefined);
  if (thread) {
    lastRef.current = thread;
    lastIdRef.current = threadId;
  }
  const display = thread ?? (lastIdRef.current === threadId ? lastRef.current : undefined);

  if (!display) {
    return <NotFoundPage />;
  }

  return <EmailView thread={display} />;
}
