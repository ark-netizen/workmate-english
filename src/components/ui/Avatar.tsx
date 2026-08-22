import { hashString } from "@/lib/hash";

const PALETTE = [
  "bg-blue-500",
  "bg-emerald-500",
  "bg-orange-500",
  "bg-purple-500",
  "bg-pink-500",
  "bg-teal-500",
  "bg-amber-500",
  "bg-indigo-500",
];

const SIZE_CLASSES = {
  sm: "h-7 w-7 text-xs",
  md: "h-9 w-9 text-sm",
  lg: "h-12 w-12 text-base",
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

  if (photoUrl) {
    return (
      <img
        src={photoUrl}
        alt={name}
        className={`inline-block shrink-0 rounded-full object-cover ${sizeClasses} ${className}`}
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
