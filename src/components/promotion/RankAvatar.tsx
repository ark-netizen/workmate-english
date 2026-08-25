import { RANKS } from "./rankArt";

// 사용자가 확정한 수달 시안에서 직접 잘라낸 직급별 개별 이미지.
// 스프라이트 계산이나 SVG 중첩 없이 파일 자체를 <img>로 보여준다.
const RANK_IMAGE: Record<string, string> = {
  사원: `${import.meta.env.BASE_URL}characters/rank/rank-01.webp`,
  주임: `${import.meta.env.BASE_URL}characters/rank/rank-02.webp`,
  대리: `${import.meta.env.BASE_URL}characters/rank/rank-03.webp`,
  과장: `${import.meta.env.BASE_URL}characters/rank/rank-04.webp`,
  차장: `${import.meta.env.BASE_URL}characters/rank/rank-05.webp`,
  부장: `${import.meta.env.BASE_URL}characters/rank/rank-06.webp`,
  이사: `${import.meta.env.BASE_URL}characters/rank/rank-07.webp`,
};

export function RankAvatar({ rank, className = "h-12 w-12 rounded-full" }: { rank?: string | null; className?: string }) {
  const safeRank = rank && RANKS.includes(rank) ? rank : "사원";

  return (
    <span
      className={`inline-flex shrink-0 items-center justify-center overflow-hidden bg-black/[.04] ${className}`}
      role="img"
      aria-label={`${safeRank} 수달 캐릭터`}
    >
      <img
        src={RANK_IMAGE[safeRank]}
        alt=""
        aria-hidden="true"
        className="h-full w-full select-none object-contain"
        draggable={false}
      />
    </span>
  );
}
