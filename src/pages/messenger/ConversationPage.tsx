import { useParams } from "react-router-dom";
import { useWorkday } from "@/context/useWorkday";
import { ConversationView } from "@/components/messenger/ConversationView";
import { NotFoundPage } from "@/pages/NotFoundPage";

export function ConversationPage() {
  const { conversationId } = useParams<{ conversationId: string }>();
  const { getConversationById } = useWorkday();
  const conversation = conversationId ? getConversationById(conversationId) : undefined;

  if (!conversation) {
    return <NotFoundPage />;
  }

  return <ConversationView conversation={conversation} />;
}
