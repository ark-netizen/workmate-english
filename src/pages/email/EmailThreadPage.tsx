import { useParams } from "react-router-dom";
import { useWorkday } from "@/context/useWorkday";
import { EmailView } from "@/components/email/EmailView";
import { NotFoundPage } from "@/pages/NotFoundPage";

export function EmailThreadPage() {
  const { threadId } = useParams<{ threadId: string }>();
  const { getEmailThreadById } = useWorkday();
  const thread = threadId ? getEmailThreadById(threadId) : undefined;

  if (!thread) {
    return <NotFoundPage />;
  }

  return <EmailView thread={thread} />;
}
