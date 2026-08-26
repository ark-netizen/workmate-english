import { RankAvatar } from "./RankAvatar";
import { RANKS, RANK_SUBLABELS } from "./rankArt";

export function RankLineup({
  currentRank,
  topPercent,
  totalUsers,
}: {
  currentRank?: string;
  topPercent?: number | null;
  totalUsers?: number | null;
}) {
  const safeRank = currentRank && RANKS.includes(currentRank) ? currentRank : "사원";
  const currentIndex = Math.max(0, RANKS.indexOf(safeRank));
  const barPosition = topPercent != null ? Math.min(96, Math.max(4, 100 - topPercent)) : null;

  return (
    <div className="mx-auto w-full max-w-[920px]">
      <div
        className="grid grid-cols-4 gap-x-3 gap-y-5 px-1 sm:grid-cols-7 sm:gap-x-4 sm:gap-y-0"
        role="img"
        aria-label={`수달 직급 라인업, 현재 ${safeRank}`}
      >
        {RANKS.map((rank, i) => {
          const isCurrent = i === currentIndex;
          const hideArrowOnMobileRowEnd = i === 3;

          return (
            <div key={rank} className="relative flex min-w-0 flex-col items-center text-center">
              {isCurrent && (
                <span className="absolute -top-4 left-1/2 z-10 -translate-x-1/2 whitespace-nowrap rounded bg-accent px-1.5 py-0.5 text-[9px] font-bold text-white shadow-sm sm:-top-5 sm:text-[10px]">
                  나
                </span>
              )}

              <div
                className={`flex items-center justify-center rounded-md p-1 transition-colors ${
                  isCurrent ? "border-2 border-accent bg-accent/5" : "border border-transparent"
                }`}
              >
                <RankAvatar
                  rank={rank}
                  className="h-[58px] w-[52px] rounded-sm bg-transparent sm:h-[72px] sm:w-[64px]"
                />
              </div>

              <span className="mt-1 text-[11px] font-bold text-foreground sm:text-xs">{rank}</span>
              <span className="mt-0.5 hidden break-keep text-[9px] leading-tight text-foreground/45 sm:block">
                {RANK_SUBLABELS[rank]}
              </span>

              {i < RANKS.length - 1 && (
                <span
                  aria-hidden="true"
                  className={`absolute -right-2 top-[34px] text-xs font-bold text-foreground/30 sm:-right-3 sm:top-[42px] sm:block ${
                    hideArrowOnMobileRowEnd ? "hidden" : "block"
                  }`}
                >
                  →
                </span>
              )}
            </div>
          );
        })}
      </div>

      <div className="relative mt-8 px-1 sm:mt-9">
        {barPosition != null ? (
          <span
            className="absolute -top-6 -translate-x-1/2 whitespace-nowrap rounded-full bg-accent px-2 py-0.5 text-[10px] font-bold text-white shadow-sm"
            style={{ left: `${barPosition}%` }}
          >
            상위 {topPercent}%
          </span>
        ) : (
          <span className="absolute -top-6 left-1/2 -translate-x-1/2 whitespace-nowrap rounded-full bg-black/[.06] px-2 py-0.5 text-[10px] font-medium text-foreground/50">
            집계 중
          </span>
        )}
        <div className="h-2 w-full overflow-hidden rounded-full bg-gradient-to-r from-black/[.05] to-accent/15">
          {barPosition != null && (
            <div
              className="h-full rounded-full bg-gradient-to-r from-accent/40 to-accent transition-all"
              style={{ width: `${barPosition}%` }}
            />
          )}
        </div>
        {barPosition != null && (
          <span
            className="absolute top-2 h-2 w-0.5 -translate-x-1/2 bg-accent"
            style={{ left: `${barPosition}%` }}
          />
        )}
        <div className="mt-1 flex items-center justify-between text-[10px] text-foreground/40">
          <span>하위</span>
          <span>{totalUsers != null ? `전체 ${totalUsers}명 중` : ""}</span>
          <span>상위</span>
        </div>
      </div>

      <p className="mt-3 text-center text-xs text-foreground/50">
        현재 직급: <span className="font-semibold text-foreground">{safeRank}</span>
      </p>
      <p className="mt-1 text-center text-[11px] text-foreground/35">현재 수달 캐릭터 모드 · 인간 캐릭터 모드 준비 중</p>
    </div>
  );
}
