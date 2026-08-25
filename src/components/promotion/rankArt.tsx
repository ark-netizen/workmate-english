import type { ReactNode } from "react";

// 기존 회사 직급 체계 — server/promotion.js의 RANKS와 동일한 순서로 유지할 것
export const RANKS = ["사원", "주임", "대리", "과장", "차장", "부장", "이사"];

export const RANK_SUBLABELS: Record<string, string> = {
  사원: "신입",
  주임: "실무 보조",
  대리: "3~5년차",
  과장: "팀 리드",
  차장: "부서 관리",
  부장: "부문 총괄",
  이사: "경영 임원",
};

// 사용자가 확정한 수달 시안 이미지에서 직급별 캐릭터를 직접 크롭한 스프라이트.
// 새로 그리거나 재해석하지 않고, 원본 캐릭터 이미지를 그대로 보여준다.
const FRAME_WIDTH = 140;
const FRAME_HEIGHT = 190;
const SPRITE_WIDTH = FRAME_WIDTH * RANKS.length;
// GitHub Pages는 /workmate-english/ 같은 base path 아래 배포되므로 사이트 루트(/characters/...)를 쓰면 404가 난다.
const SPRITE_PATH = `${import.meta.env.BASE_URL}characters/rank-otters.webp`;

function OtterRankImage({ index }: { index: number }) {
  return (
    <svg x="-6" y="12" width="68" height="92" viewBox={`${index * FRAME_WIDTH} 0 ${FRAME_WIDTH} ${FRAME_HEIGHT}`} preserveAspectRatio="xMidYMid meet" aria-hidden="true">
      <image href={SPRITE_PATH} x="0" y="0" width={SPRITE_WIDTH} height={FRAME_HEIGHT} preserveAspectRatio="none" />
    </svg>
  );
}

export const RANK_BODY: Record<string, ReactNode> = Object.fromEntries(
  RANKS.map((rank, index) => [rank, <OtterRankImage key={rank} index={index} />]),
) as Record<string, ReactNode>;
