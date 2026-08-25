import { useBusinessMode } from "@/context/useBusinessMode";
import type { ProfileResponse } from "@/types/api";
import { EmployeeIdCard } from "./EmployeeIdCard";

export function EmployeeIdCardModal({
  profile,
  photoUrl,
  onClearPhoto,
  onClose,
}: {
  profile: ProfileResponse;
  photoUrl?: string | null;
  onClearPhoto?: () => void | Promise<void>;
  onClose: () => void;
}) {
  const { businessMode } = useBusinessMode();

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4" role="dialog" aria-modal="true">
      <div className="absolute inset-0 bg-black/40" onClick={onClose} />
      <div className="relative w-full max-w-sm space-y-2">
        <EmployeeIdCard profile={profile} photoUrl={photoUrl} onClearPhoto={onClearPhoto} />
        <button
          type="button"
          onClick={onClose}
          className={
            businessMode
              ? "w-full rounded-[2px] border-2 border-[#28352f] bg-[#fff9e9] px-3 py-2 text-xs font-black text-[#28352f] shadow-[3px_3px_0_rgba(40,53,47,.2)] hover:bg-[#eaf5df]"
              : "w-full rounded-md border border-border bg-surface px-3 py-2 text-xs text-foreground/50 hover:bg-black/[.03]"
          }
        >
          닫기
        </button>
      </div>
    </div>
  );
}
