import { RANKS } from "./rankArt";

// 사용자가 확정한 수달 시안 이미지를 그대로 크롭해서 보여주는 공용 직급 아바타.
// SVG 내부 <image> 렌더링을 쓰지 않고 일반 <img>를 overflow로 잘라서
// 인트로·사원증·프로필에서도 동일하게 안정적으로 표시한다.
const SPRITE_PATH = `${import.meta.env.BASE_URL}characters/rank-otters.webp`;
const FRAME_COUNT = RANKS.length;

export function RankAvatar({ rank, className = "h-12 w-12 rounded-full" }: { rank?: string | null; className?: string }) {
  const safeRank = rank && RANKS.includes(rank) ? rank : "사원";
  const rankIndex = Math.max(0, RANKS.indexOf(safeRank));

  // 스프라이트 전체 이미지를 원본 비율 그대로 높이에 맞춘 뒤,
  // 해당 직급 프레임의 중심이 컨테이너 중앙에 오도록 이동한다.
  // translateX(%)는 이미지 자체 너비 기준이라 각 프레임 폭을 정확히 계산할 수 있다.
  const frameCenterPercent = ((rankIndex + 0.5) / FRAME_COUNT) * 100;

  return (
    <span
      className={`relative inline-block shrink-0 overflow-hidden bg-black/[.04] ${className}`}
      role="img"
      aria-label={`${safeRank} 수달 캐릭터`}
    >
      <img
        src={SPRITE_PATH}
        alt=""
        aria-hidden="true"
        className="absolute top-0 h-full w-auto max-w-none select-none"
        style={{ left: "50%", transform: `translateX(-${frameCenterPercent}%)` }}
        draggable={false}
      />
    </span>
  );
}
