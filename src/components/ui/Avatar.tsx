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

  const initial = name.trim().charAt(0).toUpperCase() || "?";
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
