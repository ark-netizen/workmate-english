export type PresenceTone = "online" | "away" | "offline";

const toneClasses: Record<PresenceTone, string> = {
  online: "bg-emerald-500",
  away: "bg-orange-500",
  offline: "bg-foreground/25",
};

export function PresenceDot({ tone, className = "" }: { tone: PresenceTone; className?: string }) {
  return (
    <span
      className={`inline-block h-2 w-2 shrink-0 rounded-full ${toneClasses[tone]} ${className}`}
      aria-hidden="true"
    />
  );
}
