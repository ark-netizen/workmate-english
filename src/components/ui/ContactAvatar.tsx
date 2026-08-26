import type { ContactRole } from "@/types/domain";
import { useBusinessMode } from "@/context/useBusinessMode";
import { Avatar } from "./Avatar";

const SIZE_CLASSES = {
  sm: "h-7 w-7",
  md: "h-9 w-9",
  lg: "h-12 w-12",
} as const;

const NPC_IMAGE_BY_ROLE: Partial<Record<ContactRole, string>> = {
  colleague: "characters/npc/npc-coworker.webp",
  manager: "characters/npc/npc-teamlead.webp",
  client: "characters/npc/npc-client.webp",
};

export function ContactAvatar({
  name,
  role,
  size = "md",
  className = "",
}: {
  name: string;
  role?: ContactRole | null;
  size?: keyof typeof SIZE_CLASSES;
  className?: string;
}) {
  const { businessMode } = useBusinessMode();
  const npcImage = role ? NPC_IMAGE_BY_ROLE[role] : undefined;

  // 현재 앱에서는 businessMode=true가 게임모드다.
  // 게임모드의 동료·상사·거래처만 고정 수달 캐릭터를 쓰고,
  // 비즈니스모드/HR/기타 아바타는 기존 이니셜 디자인을 그대로 유지한다.
  if (businessMode && npcImage) {
    const baseUrl = import.meta.env.BASE_URL ?? "/";
    return (
      <img
        src={`${baseUrl}${npcImage}`}
        alt={name}
        className={`inline-block shrink-0 rounded-[4px] border border-[#315d53] bg-[#fffaf0] object-contain p-[3px] ${SIZE_CLASSES[size]} ${className}`}
      />
    );
  }

  return <Avatar name={name} size={size} className={className} />;
}
