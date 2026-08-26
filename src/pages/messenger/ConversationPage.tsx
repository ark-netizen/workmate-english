import { useRef } from "react";
import { useParams } from "react-router-dom";
import type { Conversation } from "@/types/domain";
import { useWorkday } from "@/context/useWorkday";
import { ConversationView } from "@/components/messenger/ConversationView";
import { VentStartPage } from "@/pages/messenger/VentStartPage";
import { NotFoundPage } from "@/pages/NotFoundPage";

export function ConversationPage() {
  const { conversationId } = useParams<{ conversationId: string }>();
  const { getConversationById } = useWorkday();

  // /messenger/vent는 고함항아리 전용 경로다. 라우터가 동적 :conversationId로
  // 해석하는 경우에도 절대 NotFound로 떨어지지 않도록 여기서 한 번 더 방어한다.
  if (conversationId === "vent") {
    return <VentStartPage />;
  }

  const conversation = conversationId ? getConversationById(conversationId) : undefined;

  // 답장 직후 refresh()(자동진행 QA 토글이면 연달아 한 번 더)로 대화 목록이 다시 만들어지는 사이,
  // 이 id가 새 배열에 한 프레임 순간적으로 안 잡힐 때가 있다 — 그때마다 바로 "찾을 수 없음"으로
  // 튕기면 화면(내 메시지+입력중 표시)이 통째로 사라졌다 나타나는 것처럼 보인다. 같은 id를 보는
  // 동안은 마지막으로 정상 로드됐던 내용을 유지해서 진짜로 없어진 게 아니면 화면이 안 흔들리게 한다
  const lastRef = useRef<Conversation | undefined>(undefined);
  const lastIdRef = useRef<string | undefined>(undefined);
  if (conversation) {
    lastRef.current = conversation;
    lastIdRef.current = conversationId;
  }
  const display = conversation ?? (lastIdRef.current === conversationId ? lastRef.current : undefined);

  if (!display) {
    return <NotFoundPage />;
  }

  return <ConversationView conversation={display} />;
}
