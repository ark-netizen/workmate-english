import { useContext } from "react";
import { hashString } from "@/lib/hash";
import { useBusinessMode } from "@/context/useBusinessMode";
import { WorkdayContext } from "@/context/workday-context-value";

// 예전엔 8색 무지개 팔레트를 이름 해시로 뿌렸는데, 카드/아바타 색이 너무 다채롭다는
// 피드백으로 브랜드 컬러(accent/accent-2) 중심 + 중립 톤 3가지로 절제했다.
const PALETTE = ["bg-accent", "bg-accent-2", "bg-slate-500"];

const SIZE_CLASSES = {
  sm: "h-7 w-7 text-xs",
  md: "h-9 w-9 text-sm",
  lg: "h-12 w-12 text-base",
};

const NPC_IMAGE_BY_ROLE: Record<string, string> = {
  colleague: "characters/npc/npc-coworker.webp",
  manager: "characters/npc/npc-teamlead.webp",
  client: "characters/npc/npc-client.webp",
};

export function Avatar({
  name,
  size = "md",
  photoUrl,
  className = "",
}: {
  name: string;
  size?: keyof typeof SIZE_CLASSES;
  photoUrl?: string | null;
  className?: string;
}) {
  const sizeClasses = SIZE_CLASSES[size];
  const { businessMode } = useBusinessMode();
  const workday = useContext(WorkdayContext);

  if (photoUrl) {
    return (
      <img
        src={photoUrl}
        alt={name}
        className={`inline-block shrink-0 rounded-full object-cover ${sizeClasses} ${className}`}
      />
    );
  }

  // 일부 오래된 화면(메일 본문 등)은 아직 role을 직접 넘기지 않고 Avatar만 사용한다.
  // WorkdayContext에서 같은 이름의 연락처를 찾아 게임모드에서만 역할별 고정 수달로 자동 보정한다.
  // 현재 앱에서는 businessMode=true가 실제 게임모드이므로 ContactAvatar와 같은 조건을 쓴다.
  const contact = workday?.contacts.find((item) => item.name === name);
  const npcImage = contact ? NPC_IMAGE_BY_ROLE[contact.role] : undefined;
  if (businessMode && npcImage) {
    return (
      <img
        src={`${import.meta.env.BASE_URL}${npcImage}`}
        alt={name}
        className={`inline-block shrink-0 rounded-[4px] border border-[#315d53] bg-[#fffaf0] object-contain p-[3px] ${sizeClasses} ${className}`}
      />
    );
  }

  // 이름 첫 단어가 이미 약어(예: "HR Team"의 "HR")면 그 약어 전체를 이니셜로 쓴다 —
  // 첫 글자만 쓰면 "H"가 되어 원래 이름이 뭔지 알아볼 수 없어짐
  const firstWord = name.trim().split(/\s+/)[0] ?? "";
  const initial = /^[A-Z]{2,}$/.test(firstWord)
    ? firstWord.slice(0, 2)
    : name.trim().charAt(0).toUpperCase() || "?";
  const color = PALETTE[hashString(name) % PALETTE.length];

  return (
    <span
      className={`inline-flex shrink-0 items-center justify-center rounded-full font-medium text-white ${color} ${sizeClasses} ${className}`}
      aria-hidden="true"
    >
      {initial}
    </span>
  );
}
