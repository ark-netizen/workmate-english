import { useState } from "react";
import * as api from "@/lib/api";
import { RANKS } from "@/components/promotion/rankArt";
import { RankAvatar } from "@/components/promotion/RankAvatar";
import { deriveEmployeeId } from "@/lib/employeeId";
import type { ProfileResponse } from "@/types/api";

export function EmployeeIdCard({
  profile,
  photoUrl,
  onClearPhoto,
  hideAvatarPicker,
}: {
  profile: ProfileResponse;
  photoUrl?: string | null;
  onClearPhoto?: () => void | Promise<void>;
  /** 체험판 온보딩처럼 신원 확인용으로만 카드를 보여주고 캐릭터를 고를 필요 없을 때 이 섹션을 통째로 뺀다 */
  hideAvatarPicker?: boolean;
}) {
  const name = profile.display_name?.trim() || "이름 미입력";
  const department = [profile.industry, profile.job_role].filter(Boolean).join(" · ") || "직무 미입력";
  const rank = profile.job_rank?.trim() || "사원";
  const employeeId = deriveEmployeeId(profile.email || profile.display_name || "");
  const rankIndex = Math.max(0, RANKS.indexOf(rank));
  const unlockedRanks = RANKS.slice(0, rankIndex + 1);

  const savedAvatarRank = profile.avatar_rank?.trim() || rank;
  // 고르는 즉시 저장하지 않고, "저장" 버튼을 눌러야 반영 — 선택만으론 아직 아무것도 안 바뀜을 명확히 함
  const [selectedRank, setSelectedRank] = useState(savedAvatarRank);
  const [saving, setSaving] = useState(false);
  const [justSaved, setJustSaved] = useState(false);
  const [saveError, setSaveError] = useState<string | null>(null);

  const hasPendingChange = selectedRank !== savedAvatarRank;
  // 예전에 올려둔 프로필 사진이 남아있으면 캐릭터를 골라도 계속 사진에 가려져 있었으므로,
  // 저장하지 않았어도 캐릭터를 고르는 중이면 미리보기는 사진 대신 선택한 캐릭터로 보여준다
  const showPhoto = Boolean(photoUrl) && !hasPendingChange;

  const handleSave = async () => {
    if (saving || !hasPendingChange) return;
    setSaving(true);
    setSaveError(null);
    try {
      const updated = await api.postProfile({ avatar_rank: selectedRank });
      if ((updated.avatar_rank?.trim() || "") !== selectedRank) {
        // 서버가 200을 줬어도 실제로는 반영 안 됐을 수 있음(과거엔 유효성 검사 실패 시 조용히 무시했음) — 응답으로 직접 확인
        setSaveError("저장에 실패했어요. 이미 승급한 직급의 캐릭터만 고를 수 있어요.");
        return;
      }
      if (photoUrl) await onClearPhoto?.(); // 캐릭터를 저장하면 그 캐릭터가 실제로 보이도록 예전 사진은 지운다
      window.dispatchEvent(new Event("go:profile-updated"));
      setJustSaved(true);
      setTimeout(() => setJustSaved(false), 2000);
    } catch (e) {
      setSaveError(e instanceof Error ? e.message : "저장 중 문제가 발생했습니다.");
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="overflow-hidden rounded-2xl border border-border bg-surface shadow-sm">
      <div className="h-2 bg-gradient-to-r from-accent to-accent-2" />
      <div className="flex flex-col items-center gap-3 p-5 text-center">
        <div className="relative shrink-0">
          <div className="h-20 w-20 overflow-hidden rounded-xl ring-1 ring-border">
            {showPhoto ? (
              <img src={photoUrl ?? undefined} alt={name} className="h-full w-full object-cover" />
            ) : (
              <RankAvatar rank={selectedRank} className="h-full w-full" />
            )}
          </div>
        </div>

        <div className="min-w-0 space-y-1">
          <p className="text-xs font-medium uppercase tracking-wide text-foreground/40">Global Office</p>
          <div className="flex items-center justify-center gap-2">
            <p className="truncate text-lg font-semibold">{name}</p>
            <span className="shrink-0 rounded-full bg-accent/10 px-2 py-0.5 text-xs font-medium text-accent">{rank}</span>
          </div>
          <p className="truncate text-sm text-foreground/60">{department}</p>
          <p className="text-xs text-foreground/40">사번 {employeeId}</p>
        </div>
      </div>

      {!hideAvatarPicker && (
        <div className="border-t border-border px-5 py-4 text-center">
          <p className="mb-2 text-xs font-medium text-foreground/50">
            아바타 캐릭터 {unlockedRanks.length > 1 && <span className="text-foreground/30">(승급하면 선택지가 늘어나요)</span>}
          </p>
          <div className="flex flex-wrap items-center justify-center gap-2">
            {unlockedRanks.map((r) => (
              <button
                key={r}
                type="button"
                onClick={() => setSelectedRank(r)}
                aria-label={`${r} 캐릭터 선택`}
                aria-pressed={selectedRank === r}
                className={`rounded-full transition-all ${
                  selectedRank === r ? "ring-2 ring-accent ring-offset-2 ring-offset-surface" : "opacity-60 hover:opacity-100"
                }`}
              >
                <RankAvatar rank={r} className="h-10 w-10 rounded-full" />
              </button>
            ))}
          </div>
          {saveError && <p className="mt-2 text-xs text-red-600">{saveError}</p>}
          <button
            type="button"
            onClick={handleSave}
            disabled={!hasPendingChange || saving}
            className="mt-3 w-full rounded-md bg-accent px-3 py-2 text-xs font-medium text-white hover:opacity-90 disabled:cursor-default disabled:bg-foreground/10 disabled:text-foreground/40"
          >
            {saving ? "저장 중..." : justSaved ? "저장했어요 ✓" : hasPendingChange ? "이 캐릭터로 저장" : "저장됨"}
          </button>
        </div>
      )}
    </div>
  );
}
