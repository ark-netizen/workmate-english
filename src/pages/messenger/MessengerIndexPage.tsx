import { Navigate } from "react-router-dom";
import { useWorkday } from "@/context/useWorkday";

export function MessengerIndexPage() {
  const { conversations } = useWorkday();

  const latest = [...conversations].sort(
    (a, b) => new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime(),
  )[0];

  if (latest) {
    return <Navigate to={`/messenger/${latest.id}`} replace />;
  }

  return (
    <div className="hidden h-full w-full items-center justify-center text-sm text-foreground/40 md:flex">
      아직 대화가 없어요
    </div>
  );
}
