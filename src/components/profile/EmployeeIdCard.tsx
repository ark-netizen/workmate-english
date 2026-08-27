import { useState } from "react";
import * as api from "@/lib/api";
import { RANKS } from "@/components/promotion/rankArt";
import { RankAvatar } from "@/components/promotion/RankAvatar";
import { useBusinessMode } from "@/context/useBusinessMode";
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
  const { businessMode } = useBusinessMode();
  const name = profile.display_name?.trim() || "이름 미입력";
  const department = [profile.industry, profile.job_role].filter(Boolean).join(" · ") || "직무 미입력";
  const rank = profile.job_rank?.trim() || "사원";
  const employeeId = deriveEmployeeId(profile.email || profile.display_name || "");
  const rankIndex = Math.max(0, RANKS.indexOf(rank));
  const unlockedRanks = RANKS.slice(0, rankIndex + 1);

  const savedAvatarRank = profile.avatar_rank?.trim() || rank;
  const [selectedRank, setSelectedRank] = useState(savedAvatarRank);
  const [saving, setSaving] = useState(false);
  const [justSaved, setJustSaved] = useState(false);
  const [saveError, setSaveError] = useState<string | null>(null);

  const hasPendingChange = selectedRank !== savedAvatarRank;
  const showPhoto = Boolean(photoUrl) && !hasPendingChange;

  const handleSave = async () => {
    if (saving || !hasPendingChange) return;
    setSaving(true);
    setSaveError(null);
    try {
      const updated = await api.postProfile({ avatar_rank: selectedRank });
      if ((updated.avatar_rank?.trim() || "") !== selectedRank) {
        setSaveError("저장에 실패했어요. 이미 승급한 직급의 캐릭터만 고를 수 있어요.");
        return;
      }
      if (photoUrl) await onClearPhoto?.();
      window.dispatchEvent(new Event("go:profile-updated"));
      setJustSaved(true);
      setTimeout(() => setJustSaved(false), 2000);
    } catch (e) {
      setSaveError(e instanceof Error ? e.message : "저장 중 문제가 발생했습니다.");
    } finally {
      setSaving(false);
    }
  };

  const horizontal = hideAvatarPicker;
  // IntroPage에서 businessMode=true가 실제 "게임 모드"로 쓰인다.
  const gameCard = businessMode && !horizontal;

  return (
    <div
      className={
        gameCard
          ? "overflow-hidden rounded-[2px] border-2 border-[#28352f] bg-[#fff9e9] shadow-[5px_5px_0_rgba(40,53,47,.24)]"
          : "overflow-hidden rounded-2xl border border-border bg-surface shadow-sm"
      }
    >
      <div
        className={
          gameCard
            ? "hidden"
            : horizontal
              ? "h-1.5 bg-gradient-to-r from-accent to-accent-2"
              : "h-2 bg-gradient-to-r from-accent to-accent-2"
        }
      />
      <div
        className={
          horizontal
            ? "flex items-center gap-4 p-5 text-left"
            : gameCard
              ? "flex flex-col items-center gap-3 px-5 py-6 text-center"
              : "flex flex-col items-center gap-3 p-5 text-center"
        }
      >
        <div className="relative shrink-0">
          <div
            className={
              gameCard
                ? "h-20 w-20 overflow-hidden rounded-none border-2 border-[#28352f] bg-[#bce5dc] shadow-[3px_3px_0_#28352f]"
                : horizontal
                  ? "h-16 w-16 overflow-hidden rounded-xl ring-1 ring-border"
                  : "h-20 w-20 overflow-hidden rounded-xl ring-1 ring-border"
            }
          >
            {showPhoto ? (
              <img src={photoUrl ?? undefined} alt={name} className="h-full w-full object-cover" />
            ) : (
              <RankAvatar rank={selectedRank} className="h-full w-full" />
            )}
          </div>
        </div>

        <div className={horizontal ? "min-w-0 space-y-1" : "min-w-0 space-y-1 text-center"}>
          <p
            className={
              gameCard
                ? "text-[11px] font-black uppercase tracking-[0.14em] text-[#2f795d]"
                : "text-xs font-medium uppercase tracking-wide text-foreground/40"
            }
          >
            Global Office
          </p>
          <div className={horizontal ? "flex items-center gap-2" : "flex items-center justify-center gap-2"}>
            <p className={gameCard ? "truncate text-lg font-black text-[#18251f]" : "truncate text-lg font-semibold"}>{name}</p>
            <span
              className={
                gameCard
                  ? "shrink-0 border border-[#2f795d] bg-[#eaf5df] px-2 py-0.5 text-xs font-bold text-[#1f6d55]"
                  : "shrink-0 rounded-full bg-accent/10 px-2 py-0.5 text-xs font-medium text-accent"
              }
            >
              {rank}
            </span>
          </div>
          <p className={gameCard ? "truncate text-sm font-medium text-[#4d554f]" : "truncate text-sm text-foreground/60"}>{department}</p>
          <p className={gameCard ? "text-xs text-[#6e756f]" : "text-xs text-foreground/40"}>사번 {employeeId}</p>
        </div>
      </div>

      {!hideAvatarPicker && (
        <div
          className={
            gameCard
              ? "border-t-2 border-[#28352f] px-5 py-4 text-center"
              : "border-t border-border px-5 py-4 text-center"
          }
        >
          <p className={gameCard ? "mb-1 text-xs font-bold text-[#4d554f]" : "mb-1 text-xs font-medium text-foreground/50"}>
            수달 캐릭터 {unlockedRanks.length > 1 && <span className={gameCard ? "text-[#7c837e]" : "text-foreground/30"}>(승급하면 선택지가 늘어나요)</span>}
          </p>
          <p className={gameCard ? "mb-2 text-[11px] text-[#6e756f]" : "mb-2 text-[11px] text-foreground/35"}>
            현재는 수달 캐릭터를 제공해요 · 인간 캐릭터 모드도 준비 중이에요
          </p>
          <div className="flex flex-wrap items-center justify-center gap-3">
            {unlockedRanks.map((r) => (
              <button
                key={r}
                type="button"
                onClick={() => setSelectedRank(r)}
                aria-label={`${r} 수달 캐릭터 선택`}
                aria-pressed={selectedRank === r}
                className={
                  gameCard
                    ? `inline-flex h-11 w-11 shrink-0 items-center justify-center border-2 bg-[#fff9e9] p-0 leading-none transition-all ${
                        selectedRank === r
                          ? "border-[#2f795d] shadow-[2px_2px_0_#28352f]"
                          : "border-transparent opacity-60 hover:opacity-100"
                      }`
                    : `inline-flex h-10 w-10 shrink-0 items-center justify-center rounded-full p-0 leading-none transition-all ${
                        selectedRank === r ? "ring-2 ring-accent ring-offset-2 ring-offset-surface" : "opacity-60 hover:opacity-100"
                      }`
                }
              >
                <RankAvatar rank={r} className={gameCard ? "h-full w-full rounded-none" : "h-full w-full rounded-full"} />
              </button>
            ))}
          </div>
          {saveError && <p className="mt-2 text-xs text-red-600">{saveError}</p>}
          <button
            type="button"
            onClick={handleSave}
            disabled={!hasPendingChange || saving}
            className={
              gameCard
                ? "mt-3 w-full border-2 border-[#28352f] bg-[#fffaf0] px-3 py-2 text-xs font-black text-[#28352f] shadow-[2px_2px_0_#28352f] hover:bg-[#eaf5df] disabled:cursor-default disabled:bg-[#ece6d8] disabled:text-[#7a807b] disabled:shadow-none"
                : "mt-3 w-full rounded-md bg-accent px-3 py-2 text-xs font-medium text-white hover:opacity-90 disabled:cursor-default disabled:bg-foreground/10 disabled:text-foreground/40"
            }
          >
            {saving ? "저장 중..." : justSaved ? "저장했어요 ✓" : hasPendingChange ? "이 캐릭터로 저장" : "저장됨"}
          </button>
        </div>
      )}
    </div>
  );
}
