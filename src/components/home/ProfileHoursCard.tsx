import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { ChevronRight } from "lucide-react";
import { RankAvatar } from "@/components/promotion/RankAvatar";
import { EmployeeIdCardModal } from "@/components/profile/EmployeeIdCardModal";
import { useAvatarPhoto } from "@/hooks/useAvatarPhoto";
import { formatHoursMinutes } from "@/lib/format";
import type { ProfileResponse } from "@/types/api";
import type { WorkStatus } from "@/types/domain";

const STANDARD_WORKDAY_MINUTES = 8 * 60;
const RADIUS = 30;
const CIRCUMFERENCE = 2 * Math.PI * RADIUS;

function elapsedMinutes(startedAt: string | undefined, endedAt: string | null | undefined, now: Date): number {
  if (!startedAt) return 0;
  const start = new Date(startedAt).getTime();
  const end = endedAt ? new Date(endedAt).getTime() : now.getTime();
  return Math.max(0, Math.round((end - start) / 60_000));
}

export function ProfileHoursCard({
  profile,
  workStatus,
  startedAt,
  endedAt,
}: {
  profile: ProfileResponse | null;
  workStatus: WorkStatus;
  startedAt?: string;
  endedAt?: string | null;
}) {
  const [now, setNow] = useState(() => new Date());
  const [idCardOpen, setIdCardOpen] = useState(false);
  const { photoUrl } = useAvatarPhoto();

  useEffect(() => {
    if (workStatus !== "working" && workStatus !== "leave") return;
    const timer = setInterval(() => setNow(new Date()), 30_000);
    return () => clearInterval(timer);
  }, [workStatus]);

  const minutes = elapsedMinutes(startedAt, endedAt, now);
  const ratio = Math.min(1, minutes / STANDARD_WORKDAY_MINUTES);
  const dash = ratio * CIRCUMFERENCE;
  // profile이 아직 로딩 중(null)인 상태와 "실제로 게스트"인 상태를 구분 — 로딩 중엔 이름을 비워
  // 실계정 로그인 시 "게스트"가 잠깐 보였다가 실제 이름으로 바뀌는 깜빡임을 없앤다
  const displayName = profile ? profile.display_name || "게스트" : "";

  return (
    <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
      <button
        type="button"
        onClick={() => setIdCardOpen(true)}
        className="flex min-w-0 items-center gap-3 rounded-xl border border-border bg-surface p-5 text-left hover:bg-black/[.02]"
      >
        {photoUrl ? (
          <img src={photoUrl} alt={displayName} className="h-12 w-12 shrink-0 rounded-full object-cover" />
        ) : (
          <RankAvatar rank={profile?.avatar_rank || profile?.job_rank} className="h-12 w-12 rounded-full" />
        )}
        <div className="min-w-0">
          <p className="truncate text-sm font-semibold text-foreground">{displayName}</p>
          <p className="truncate text-xs text-foreground/50">{profile ? profile.email ?? "이메일 미등록" : ""}</p>
        </div>
      </button>

      <Link
        to="/hours"
        className="flex items-center gap-4 rounded-xl border border-border bg-surface p-5 hover:bg-black/[.02]"
      >
        <div className="relative h-16 w-16 shrink-0">
          <svg viewBox="0 0 68 68" className="h-full w-full -rotate-90">
            <circle cx="34" cy="34" r={RADIUS} fill="none" stroke="currentColor" strokeWidth="6" className="text-black/[.06]" />
            <circle
              cx="34"
              cy="34"
              r={RADIUS}
              fill="none"
              stroke="currentColor"
              strokeWidth="6"
              strokeLinecap="round"
              strokeDasharray={`${dash} ${CIRCUMFERENCE}`}
              className="text-accent transition-[stroke-dasharray] duration-500"
            />
          </svg>
          <div className="absolute inset-0 flex items-center justify-center text-xs font-semibold text-foreground">
            {Math.round(ratio * 100)}%
          </div>
        </div>
        <div className="min-w-0 flex-1">
          <p className="text-xs font-medium text-foreground/50">근무 시간 현황</p>
          <p className="mt-1 text-sm font-semibold text-foreground">{formatHoursMinutes(minutes)} / 8시간</p>
        </div>
        <ChevronRight className="size-4 shrink-0 text-foreground/30" strokeWidth={2} />
      </Link>

      {idCardOpen && (
        <EmployeeIdCardModal profile={profile ?? {}} photoUrl={photoUrl} onClose={() => setIdCardOpen(false)} />
      )}
    </div>
  );
}
