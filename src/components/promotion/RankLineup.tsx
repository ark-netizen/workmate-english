import { RANKS, RANK_SUBLABELS, RANK_BODY } from "./rankArt";

// translate x 간격(94px)은 캐릭터 폭(56px) + 여백 기준.
const GROUP_GAP = 94;
const GROUP_X_START = 12;

export function RankLineup({
  currentRank,
  topPercent,
  totalUsers,
}: {
  currentRank?: string;
  topPercent?: number | null;
  totalUsers?: number | null;
}) {
  const currentIndex = Math.max(0, RANKS.indexOf(currentRank || "사원"));
  const markerX = GROUP_X_START + currentIndex * GROUP_GAP + 28;
  // 상위 X% → 막대 위에서의 위치(왼쪽 0% = 하위, 오른쪽 100% = 상위)
  const barPosition = topPercent != null ? Math.min(96, Math.max(4, 100 - topPercent)) : null;

  return (
    <div className="mx-auto w-full max-w-[920px]">
      <svg
        viewBox="0 -34 640 190"
        preserveAspectRatio="xMidYMid meet"
        className="mx-auto block h-auto w-full"
        role="img"
        aria-label={`직급 라인업, 현재 ${currentRank ?? "사원"}`}
      >
        {/* 나(현재 직급) 표시 마커 */}
        <g transform={`translate(${markerX},-8)`}>
          <rect x="-17" y="-24" width="34" height="17" rx="3" fill="var(--accent)" />
          <text x="0" y="-11" textAnchor="middle" fontSize="10" fontWeight="700" fill="#fff" fontFamily="sans-serif">
            나
          </text>
          <polygon points="-6,-7 6,-7 0,3" fill="var(--accent)" />
        </g>

        {RANKS.map((rank, i) => (
          <g key={rank} transform={`translate(${GROUP_X_START + i * GROUP_GAP},10)`}>
            {RANK_BODY[rank]}
            <text x="28" y="121" textAnchor="middle" fontSize="15" fontWeight="700" fill="#2c2c2a" fontFamily="sans-serif">
              {rank}
            </text>
            <text x="28" y="137" textAnchor="middle" fontSize="10" fill="#5f5e5a" fontFamily="sans-serif">
              {RANK_SUBLABELS[rank]}
            </text>
          </g>
        ))}
      </svg>

      {/* 전체 사용자 대비 위치 — 텍스트 대신 막대 그래프 + 마커로 한눈에 보이게 */}
      <div className="relative mt-3 px-1">
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
        현재 직급: <span className="font-semibold text-foreground">{currentRank ?? "사원"}</span>
      </p>
    </div>
  );
}
