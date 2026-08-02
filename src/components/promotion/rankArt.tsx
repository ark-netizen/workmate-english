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

// 직급별 캐릭터 일러스트(텍스트 라벨 제외) — 승급할수록 안경/콧수염/훈장/왕관 등 장식이 하나씩 늘어나는 컨셉.
// 라인업(RankLineup)과 원형 아바타(RankAvatar) 양쪽에서 공유해서 쓴다.
export const RANK_BODY: Record<string, ReactNode> = {
  사원: (
    <>
      <rect x="2" y="8" width="52" height="16" fill="#1c1c1c" rx="5" />
      <rect x="2" y="16" width="52" height="42" fill="#f4c9a0" rx="9" />
      <rect x="15" y="34" width="6" height="6" fill="#222" />
      <rect x="35" y="34" width="6" height="6" fill="#222" />
      <rect x="-6" y="58" width="68" height="46" fill="#7fc4e0" rx="4" />
      <rect x="20" y="58" width="16" height="46" fill="#ffffff" />
    </>
  ),
  주임: (
    <>
      <rect x="2" y="8" width="52" height="16" fill="#1c1c1c" rx="5" />
      <rect x="2" y="16" width="52" height="42" fill="#f4c9a0" rx="9" />
      <rect x="15" y="34" width="6" height="6" fill="#222" />
      <rect x="35" y="34" width="6" height="6" fill="#222" />
      <rect x="-6" y="58" width="68" height="46" fill="#eae5d9" rx="4" />
      <rect x="20" y="58" width="16" height="46" fill="#ffffff" />
      <line x1="18" y1="58" x2="26" y2="70" stroke="#8a8a8a" strokeWidth="2" />
      <line x1="38" y1="58" x2="30" y2="70" stroke="#8a8a8a" strokeWidth="2" />
      <rect x="21" y="70" width="14" height="18" fill="#ffffff" stroke="#9a9488" strokeWidth="1.5" rx="1" />
      <rect x="24" y="74" width="8" height="6" fill="#7fc4e0" />
    </>
  ),
  대리: (
    <>
      <rect x="2" y="8" width="52" height="16" fill="#1c1c1c" rx="5" />
      <rect x="2" y="16" width="52" height="42" fill="#f4c9a0" rx="9" />
      <rect x="15" y="34" width="6" height="6" fill="#222" />
      <rect x="35" y="34" width="6" height="6" fill="#222" />
      <rect x="-6" y="58" width="68" height="46" fill="#efe9dc" rx="4" />
      <rect x="20" y="58" width="16" height="46" fill="#ffffff" />
      <path d="M25 58 L31 58 L34 68 L28 76 L22 68 Z" fill="#7a2233" />
      <rect x="27" y="76" width="2" height="24" fill="#7a2233" />
    </>
  ),
  과장: (
    <>
      <rect x="2" y="8" width="52" height="16" fill="#2b2b2b" rx="5" />
      <rect x="2" y="16" width="52" height="42" fill="#f4c9a0" rx="9" />
      <rect x="9" y="33" width="16" height="8" fill="none" stroke="#333" strokeWidth="2" rx="3" />
      <rect x="31" y="33" width="16" height="8" fill="none" stroke="#333" strokeWidth="2" rx="3" />
      <line x1="25" y1="37" x2="31" y2="37" stroke="#333" strokeWidth="2" />
      <rect x="-6" y="58" width="68" height="46" fill="#6b7280" rx="4" />
      <rect x="20" y="58" width="16" height="46" fill="#ffffff" />
      <path d="M25 58 L31 58 L34 68 L28 76 L22 68 Z" fill="#7a2233" />
      <rect x="27" y="76" width="2" height="24" fill="#7a2233" />
      <rect x="24" y="86" width="8" height="3" fill="#d9a441" />
    </>
  ),
  차장: (
    <>
      <rect x="2" y="8" width="52" height="16" fill="#4a4a4a" rx="5" />
      <rect x="2" y="8" width="52" height="6" fill="#8f8f8f" rx="3" />
      <rect x="2" y="16" width="52" height="42" fill="#f4c9a0" rx="9" />
      <rect x="9" y="33" width="15" height="7" fill="none" stroke="#2a2a2a" strokeWidth="2" rx="3" />
      <rect x="30" y="33" width="15" height="7" fill="none" stroke="#2a2a2a" strokeWidth="2" rx="3" />
      <line x1="24" y1="36" x2="30" y2="36" stroke="#2a2a2a" strokeWidth="2" />
      <path d="M12 46 Q28 52 44 46" fill="none" stroke="#3a3a3a" strokeWidth="3" strokeLinecap="round" />
      <rect x="-6" y="58" width="68" height="46" fill="#1c2b4a" rx="4" />
      <rect x="20" y="58" width="16" height="46" fill="#ffffff" />
      <path d="M25 58 L31 58 L34 68 L28 76 L22 68 Z" fill="#8a2a3d" />
      <rect x="27" y="76" width="2" height="24" fill="#8a2a3d" />
      <rect x="4" y="60" width="7" height="14" fill="#8a2a3d" />
      <circle cx="7.5" cy="76" r="5" fill="#d9a441" />
    </>
  ),
  부장: (
    <>
      <rect x="2" y="8" width="52" height="16" fill="#7d7d7d" rx="5" />
      <rect x="2" y="16" width="52" height="42" fill="#f4c9a0" rx="9" />
      <rect x="9" y="33" width="15" height="7" fill="none" stroke="#2a2a2a" strokeWidth="2" rx="3" />
      <rect x="30" y="33" width="15" height="7" fill="none" stroke="#2a2a2a" strokeWidth="2" rx="3" />
      <line x1="24" y1="36" x2="30" y2="36" stroke="#2a2a2a" strokeWidth="2" />
      <path d="M12 46 Q28 53 44 46" fill="none" stroke="#3a3a3a" strokeWidth="3.5" strokeLinecap="round" />
      <rect x="-6" y="58" width="68" height="46" fill="#111111" rx="4" />
      <rect x="20" y="58" width="16" height="46" fill="#ffffff" />
      <path d="M25 58 L31 58 L34 68 L28 76 L22 68 Z" fill="#d9a441" />
      <rect x="27" y="76" width="2" height="24" fill="#d9a441" />
      <rect x="4" y="60" width="7" height="14" fill="#7a2233" />
      <circle cx="7.5" cy="76" r="5" fill="#d9a441" />
      <rect x="45" y="60" width="7" height="14" fill="#1c2b4a" />
      <circle cx="48.5" cy="76" r="5" fill="#d9a441" />
      <path d="M2 92 L10 92 L6 100 Z" fill="#ffffff" />
    </>
  ),
  이사: (
    <>
      <path d="M6 4 L14 -6 L22 4 L28 -8 L34 4 L42 -6 L50 4 Z" fill="#d9a441" />
      <circle cx="28" cy="-8" r="3" fill="#f0cf7a" />
      <rect x="2" y="8" width="52" height="16" fill="#b5b5b5" rx="5" />
      <rect x="2" y="16" width="52" height="42" fill="#f4c9a0" rx="9" />
      <rect x="9" y="33" width="15" height="7" fill="none" stroke="#1a1a1a" strokeWidth="2" rx="3" />
      <rect x="30" y="33" width="15" height="7" fill="none" stroke="#1a1a1a" strokeWidth="2" rx="3" />
      <line x1="24" y1="36" x2="30" y2="36" stroke="#1a1a1a" strokeWidth="2" />
      <path d="M12 46 Q28 54 44 46" fill="none" stroke="#c9c9c9" strokeWidth="3.5" strokeLinecap="round" />
      <rect x="-6" y="58" width="68" height="46" fill="#0a0a0a" rx="4" />
      <rect x="20" y="58" width="16" height="46" fill="#ffffff" />
      <path d="M25 58 L31 58 L34 68 L28 76 L22 68 Z" fill="#d9a441" />
      <rect x="27" y="76" width="2" height="24" fill="#d9a441" />
      <rect x="0" y="60" width="7" height="14" fill="#7a2233" />
      <circle cx="3.5" cy="76" r="5" fill="#d9a441" />
      <rect x="47" y="60" width="7" height="14" fill="#1c2b4a" />
      <circle cx="50.5" cy="76" r="5" fill="#d9a441" />
      <rect x="24" y="60" width="7" height="12" fill="#3a3a3a" />
      <circle cx="27.5" cy="74" r="4.5" fill="#d9a441" />
      <path d="M2 92 L10 92 L6 100 Z" fill="#ffffff" />
    </>
  ),
};
