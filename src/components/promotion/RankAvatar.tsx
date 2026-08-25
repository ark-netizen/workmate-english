import { RANKS, RANK_BODY } from "./rankArt";

// 프로필·인트로·승급 UI에서 공통으로 쓰는 직급별 수달 캐릭터.
// 얼굴은 동일하게 유지하고 승급에 따라 옷과 업무 소품만 달라진다.
// className으로 크기와 모서리(rounded-full 등)는 호출하는 쪽에서 결정한다.
export function RankAvatar({ rank, className = "h-12 w-12 rounded-full" }: { rank?: string | null; className?: string }) {
  const safeRank = rank && RANKS.includes(rank) ? rank : "사원";

  return (
    <span className={`inline-flex shrink-0 items-center justify-center overflow-hidden bg-black/[.04] ${className}`}>
      <svg viewBox="-8 2 72 72" className="h-full w-full" role="img" aria-label={`${safeRank} 수달 캐릭터`}>
        {RANK_BODY[safeRank]}
      </svg>
    </span>
  );
}
