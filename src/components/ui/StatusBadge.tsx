export type StatusTone = "success" | "pending" | "warning" | "error" | "neutral";

const toneClasses: Record<StatusTone, string> = {
  success: "bg-emerald-50 text-emerald-700",
  pending: "bg-blue-50 text-blue-700",
  warning: "bg-orange-50 text-orange-700",
  error: "bg-red-50 text-red-700",
  neutral: "bg-black/[.04] text-foreground/70",
};

export function StatusBadge({
  tone,
  children,
}: {
  tone: StatusTone;
  children: React.ReactNode;
}) {
  return (
    <span
      className={`inline-flex items-center rounded-full px-2.5 py-1 text-xs font-medium ${toneClasses[tone]}`}
    >
      {children}
    </span>
  );
}
