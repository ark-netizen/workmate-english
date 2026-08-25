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

const OUTLINE = "#202723";
const FUR = "#9a6a3a";
const MUZZLE = "#f4dfc2";
const PAW = "#8a5b34";

function OtterHead() {
  return (
    <>
      <circle cx="9" cy="19" r="7" fill={FUR} stroke={OUTLINE} strokeWidth="2" />
      <circle cx="47" cy="19" r="7" fill={FUR} stroke={OUTLINE} strokeWidth="2" />
      <circle cx="9" cy="19" r="3" fill="#d7ad7d" />
      <circle cx="47" cy="19" r="3" fill="#d7ad7d" />
      <path
        d="M7 24 C7 11 16 6 28 6 C40 6 49 11 49 24 L49 38 C49 51 41 59 28 59 C15 59 7 51 7 38 Z"
        fill={FUR}
        stroke={OUTLINE}
        strokeWidth="2"
      />
      <path d="M13 40 C14 31 21 27 28 27 C35 27 42 31 43 40 C42 50 36 54 28 54 C20 54 14 50 13 40 Z" fill={MUZZLE} />
      <circle cx="18" cy="30" r="3" fill="#111" />
      <circle cx="38" cy="30" r="3" fill="#111" />
      <circle cx="17" cy="29" r="0.8" fill="#fff" />
      <circle cx="37" cy="29" r="0.8" fill="#fff" />
      <path d="M24 38 Q28 34 32 38 Q31 43 28 43 Q25 43 24 38 Z" fill="#191919" />
      <path d="M28 43 Q25 47 22 45 M28 43 Q31 47 34 45" fill="none" stroke={OUTLINE} strokeWidth="1.5" strokeLinecap="round" />
      <line x1="12" y1="39" x2="2" y2="36" stroke={OUTLINE} strokeWidth="1.2" strokeLinecap="round" />
      <line x1="12" y1="43" x2="1" y2="43" stroke={OUTLINE} strokeWidth="1.2" strokeLinecap="round" />
      <line x1="44" y1="39" x2="54" y2="36" stroke={OUTLINE} strokeWidth="1.2" strokeLinecap="round" />
      <line x1="44" y1="43" x2="55" y2="43" stroke={OUTLINE} strokeWidth="1.2" strokeLinecap="round" />
    </>
  );
}

function ShirtBase({ fill }: { fill: string }) {
  return (
    <>
      <rect x="3" y="57" width="50" height="47" rx="10" fill={fill} stroke={OUTLINE} strokeWidth="2" />
      <path d="M20 58 L28 67 L36 58" fill="#fff" stroke={OUTLINE} strokeWidth="1.5" />
      <circle cx="8" cy="82" r="7" fill={PAW} stroke={OUTLINE} strokeWidth="1.5" />
      <circle cx="48" cy="82" r="7" fill={PAW} stroke={OUTLINE} strokeWidth="1.5" />
    </>
  );
}

export const RANK_BODY: Record<string, ReactNode> = {
  사원: (
    <>
      <OtterHead />
      <ShirtBase fill="#8fc8e3" />
      <path d="M25 63 L31 63 L33 75 L28 81 L23 75 Z" fill="#173c66" />
      <line x1="18" y1="62" x2="22" y2="72" stroke="#526a78" strokeWidth="1.5" />
      <line x1="38" y1="62" x2="34" y2="72" stroke="#526a78" strokeWidth="1.5" />
      <rect x="23" y="75" width="10" height="13" rx="1.5" fill="#f9fbfd" stroke={OUTLINE} strokeWidth="1.2" />
      <rect x="25" y="78" width="6" height="4" fill="#6ba7d0" />
    </>
  ),
  주임: (
    <>
      <OtterHead />
      <ShirtBase fill="#f5f0df" />
      <path d="M11 59 H21 L28 68 L35 59 H45 V101 H11 Z" fill="#d7a735" stroke={OUTLINE} strokeWidth="1.5" />
      <line x1="18" y1="67" x2="18" y2="94" stroke="#7e6020" strokeWidth="1.2" />
      <line x1="38" y1="67" x2="38" y2="94" stroke="#7e6020" strokeWidth="1.2" />
      <rect x="20" y="80" width="16" height="11" rx="2" fill="#6d5330" stroke={OUTLINE} strokeWidth="1.2" />
    </>
  ),
  대리: (
    <>
      <OtterHead />
      <ShirtBase fill="#9ecde7" />
      <path d="M25 62 L31 62 L33 73 L28 79 L23 73 Z" fill="#1e3f67" />
      <rect x="16" y="76" width="24" height="17" rx="2" fill="#39434b" stroke={OUTLINE} strokeWidth="1.5" />
      <rect x="19" y="79" width="18" height="10" rx="1" fill="#65727c" />
    </>
  ),
  과장: (
    <>
      <OtterHead />
      <ShirtBase fill="#7da9c9" />
      <path d="M13 58 L24 68 L28 64 L32 68 L43 58 L49 101 H7 Z" fill="#456f91" stroke={OUTLINE} strokeWidth="1.5" />
      <rect x="20" y="78" width="17" height="13" rx="1.5" fill="#e8edf1" stroke={OUTLINE} strokeWidth="1.2" />
      <line x1="23" y1="82" x2="34" y2="82" stroke="#7a8790" strokeWidth="1" />
      <line x1="23" y1="86" x2="32" y2="86" stroke="#7a8790" strokeWidth="1" />
    </>
  ),
  차장: (
    <>
      <OtterHead />
      <ShirtBase fill="#e8d2ae" />
      <path d="M10 58 L22 58 L28 69 L34 58 L46 58 L50 101 H6 Z" fill="#c8a477" stroke={OUTLINE} strokeWidth="1.5" />
      <rect x="31" y="78" width="12" height="15" rx="2" fill="#fffdf7" stroke={OUTLINE} strokeWidth="1.2" />
      <path d="M43 82 Q49 82 47 88 Q46 91 43 90" fill="none" stroke={OUTLINE} strokeWidth="1.5" />
      <rect x="34" y="81" width="6" height="3" fill="#d08c54" />
    </>
  ),
  부장: (
    <>
      <OtterHead />
      <ShirtBase fill="#274f79" />
      <path d="M8 58 L22 58 L28 68 L34 58 L48 58 L51 101 H5 Z" fill="#1d3e63" stroke={OUTLINE} strokeWidth="1.5" />
      <path d="M25 62 L31 62 L33 73 L28 79 L23 73 Z" fill="#d2b35b" />
      <circle cx="40" cy="68" r="3" fill="#d8b24f" stroke={OUTLINE} strokeWidth="1" />
      <path d="M19 84 Q28 78 37 84" fill="none" stroke="#9fb7ca" strokeWidth="2" strokeLinecap="round" />
    </>
  ),
  이사: (
    <>
      <OtterHead />
      <ShirtBase fill="#303234" />
      <path d="M7 58 L21 58 L28 69 L35 58 L49 58 L52 102 H4 Z" fill="#242628" stroke={OUTLINE} strokeWidth="1.5" />
      <path d="M25 62 L31 62 L33 73 L28 80 L23 73 Z" fill="#ede8dc" />
      <line x1="12" y1="82" x2="38" y2="94" stroke={OUTLINE} strokeWidth="5" strokeLinecap="round" />
      <line x1="44" y1="82" x2="18" y2="94" stroke={OUTLINE} strokeWidth="5" strokeLinecap="round" />
      <circle cx="42" cy="67" r="3.2" fill="#d4aa45" stroke={OUTLINE} strokeWidth="1" />
    </>
  ),
};
