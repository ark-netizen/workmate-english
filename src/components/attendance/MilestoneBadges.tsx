import { Award, Flame, Lock } from "lucide-react";
import type { Milestone, MilestoneType } from "@/types/attendance";

const TYPE_ICON: Record<MilestoneType, typeof Flame> = {
  streak: Flame,
  total: Award,
};

const TIER_CLASSES = [
  "border-amber-600 bg-amber-50 text-amber-700",
  "border-slate-400 bg-slate-50 text-slate-500",
  "border-yellow-500 bg-yellow-50 text-yellow-600",
  "border-purple-500 bg-purple-50 text-purple-600",
];

function tierClass(index: number): string {
  return TIER_CLASSES[index % TIER_CLASSES.length];
}

function MilestoneBadge({ milestone, index }: { milestone: Milestone; index: number }) {
  const Icon = TYPE_ICON[milestone.type];
  const rotate = index % 2 === 0 ? "-rotate-2" : "rotate-2";

  return (
    <div
      className={`flex flex-col items-center gap-2 text-center ${milestone.achieved ? rotate : ""}`}
      title={milestone.description}
    >
      <div
        className={`relative flex h-16 w-16 shrink-0 items-center justify-center rounded-full border-2 ${
          milestone.achieved ? tierClass(index) : "border-dashed border-border bg-black/[.02] text-foreground/25"
        }`}
      >
        {milestone.achieved ? <Icon className="size-7" /> : <Lock className="size-5" />}
        {!milestone.achieved && (
          <svg className="absolute inset-0 -rotate-90" viewBox="0 0 64 64" aria-hidden="true">
            <circle
              cx="32"
              cy="32"
              r="29"
              fill="none"
              stroke="currentColor"
              strokeWidth="3"
              strokeLinecap="round"
              strokeDasharray={`${Math.round(milestone.progress * 182)} 182`}
              className="text-accent/50"
            />
          </svg>
        )}
      </div>
      <p className={`text-xs leading-tight ${milestone.achieved ? "font-medium text-foreground" : "text-foreground/45"}`}>
        {milestone.label}
      </p>
    </div>
  );
}

export function MilestoneBadges({ milestones }: { milestones: Milestone[] }) {
  const achievedCount = milestones.filter((m) => m.achieved).length;

  return (
    <section className="space-y-4 rounded-xl border border-border bg-surface p-5">
      <div className="flex items-center justify-between border-b border-border pb-3">
        <h2 className="text-sm font-medium text-foreground/70">마일스톤</h2>
        <span className="text-xs text-foreground/40">
          {achievedCount}/{milestones.length} 달성
        </span>
      </div>
      <div className="grid grid-cols-3 gap-y-5 sm:grid-cols-4">
        {milestones.map((milestone, index) => (
          <MilestoneBadge key={milestone.id} milestone={milestone} index={index} />
        ))}
      </div>
    </section>
  );
}
