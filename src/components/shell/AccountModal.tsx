// 사이드바 "로그인/회원가입"에서 열리는 모달 — 기존 AccountSection 폼 재사용
import type { ProfileResponse } from "@/types/api";
import { AccountSection } from "@/components/settings/AccountSection";

export function AccountModal({
  profile,
  onClose,
  onAccountChanged,
  initialMode,
}: {
  profile: ProfileResponse;
  onClose: () => void;
  onAccountChanged: () => void;
  initialMode?: "signup" | "signin";
}) {
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4" role="dialog" aria-modal="true">
      <div className="absolute inset-0 bg-black/40" onClick={onClose} />
      <div className="relative w-full max-w-sm space-y-2">
        <AccountSection profile={profile} onAccountChanged={onAccountChanged} initialMode={initialMode} />
        <button
          type="button"
          onClick={onClose}
          className="w-full rounded-md border border-border bg-surface px-3 py-2 text-xs text-foreground/50 hover:bg-black/[.03]"
        >
          닫기
        </button>
      </div>
    </div>
  );
}
