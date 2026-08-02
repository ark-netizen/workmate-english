import { RANKS, RANK_BODY } from "./rankArt";

// 프로필 아바타에 쓰는 직급 캐릭터 — RankLineup과 같은 일러스트를 얼굴~어깨 위주로 크롭해서 재사용.
// className으로 크기와 모서리(rounded-full 등)를 호출하는 쪽에서 결정한다(감싸는 컨테이너와 모양이 겹치지 않게).
export function RankAvatar({ rank, className = "h-12 w-12 rounded-full" }: { rank?: string | null; className?: string }) {
  const safeRank = rank && RANKS.includes(rank) ? rank : "사원";

  return (
    <span className={`inline-flex shrink-0 items-center justify-center overflow-hidden bg-black/[.04] ${className}`}>
      <svg viewBox="-8 2 72 72" className="h-full w-full" role="img" aria-label={`${safeRank} 캐릭터`}>
        {RANK_BODY[safeRank]}
      </svg>
    </span>
  );
}
