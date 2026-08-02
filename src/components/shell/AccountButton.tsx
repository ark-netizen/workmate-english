import { useCallback, useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { User } from "lucide-react";
import * as api from "@/lib/api";
import { signOut } from "@/lib/auth";
import { useWorkday } from "@/context/useWorkday";
import { useAvatarPhoto } from "@/hooks/useAvatarPhoto";
import { RankAvatar } from "@/components/promotion/RankAvatar";
import { EmployeeIdCardModal } from "@/components/profile/EmployeeIdCardModal";
import type { ProfileResponse } from "@/types/api";
import { useBusinessMode } from "@/context/useBusinessMode";
import { AccountModal } from "./AccountModal";

// 사이드바 좌측 상단 계정 영역
// - 프로필 아바타: 항상 노출, 클릭하면 사원증 모달
// - 익명(체험) 상태: "로그인 / 회원가입" → 모달로 실계정 승격/로그인
// - 로그인된 상태: 이름·이메일 + 로그아웃
export function AccountButton() {
  const { refresh } = useWorkday();
  const navigate = useNavigate();
  const [profile, setProfile] = useState<ProfileResponse | null>(null);
  const [open, setOpen] = useState(false);
  const [idCardOpen, setIdCardOpen] = useState(false);
  const { photoUrl, clearPhoto } = useAvatarPhoto();
  const { businessMode } = useBusinessMode();

  const load = useCallback(async () => {
    try {
      setProfile(await api.getProfile());
    } catch {
      setProfile(null);
    }
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  // 승급 등으로 프로필(직급 포함)이 바뀌면 사원증·이름 표시가 즉시 갱신되도록 신호를 듣는다
  useEffect(() => {
    const onProfileUpdated = () => load();
    window.addEventListener("go:profile-updated", onProfileUpdated);
    return () => window.removeEventListener("go:profile-updated", onProfileUpdated);
  }, [load]);

  const handleChanged = async () => {
    await load();
    await refresh();
    setOpen(false);
    try {
      const dash = await api.getAdminDashboard();
      if (dash.role) navigate("/admin");
    } catch {
      /* 관리자 아니면 403 — 그냥 진행 */
    }
  };

  const handleLogout = async () => {
    await signOut();
    await load();
    await refresh();
    // 로그아웃 후 조용히 게스트로 이어지지 않고, 소개 페이지(/intro)로 명시적으로 돌아간다
    window.dispatchEvent(new Event("go:force-intro"));
  };

  // profile이 아직 로딩 중(null)인 상태와 "실제로 게스트"인 상태를 구분 — 로딩 중엔 이름을 비워
  // 실계정 로그인 시 "게스트"가 잠깐 보였다가 실제 이름으로 바뀌는 깜빡임을 없앤다
  const avatarButton = (
    <button
      type="button"
      onClick={() => setIdCardOpen(true)}
      aria-label="사원증 보기"
      className="shrink-0 rounded-full focus:outline-none focus-visible:ring-2 focus-visible:ring-accent"
    >
      {photoUrl ? (
        <img
          src={photoUrl}
          alt={profile?.display_name || "게스트"}
          className="h-9 w-9 shrink-0 rounded-full object-cover"
        />
      ) : (
        <RankAvatar rank={profile?.avatar_rank || profile?.job_rank} className="h-9 w-9 rounded-full" />
      )}
    </button>
  );

  const idCardModal = idCardOpen && (
    <EmployeeIdCardModal
      profile={profile ?? {}}
      photoUrl={photoUrl}
      onClearPhoto={clearPhoto}
      onClose={() => setIdCardOpen(false)}
    />
  );

  // 아직 로딩 중이면 "로그인/회원가입" 버튼도, 로그인된 상태도 아닌 빈 자리만 보여준다 —
  // 실계정으로 이미 로그인된 경우 잠깐 "로그인" 버튼이 보였다가 사라지는 깜빡임을 없앤다
  if (profile === null) {
    return <div className="flex shrink-0 items-center gap-2">{avatarButton}</div>;
  }

  if (profile.email) {
    return (
      <div className="flex shrink-0 items-center gap-2">
        {avatarButton}
        <span
          className={`max-w-[10rem] truncate rounded-full border px-3 py-1.5 text-sm ${
            businessMode ? "border-white/50 text-white" : "border-border text-foreground/70"
          }`}
        >
          {profile.display_name || profile.email}
        </span>
        <button
          type="button"
          onClick={handleLogout}
          className={`shrink-0 text-xs underline ${
            businessMode ? "text-white/60 hover:text-white" : "text-foreground/40 hover:text-foreground/70"
          }`}
        >
          로그아웃
        </button>
        {idCardModal}
      </div>
    );
  }

  return (
    <div className="flex shrink-0 items-center gap-2">
      {avatarButton}
      <button
        type="button"
        onClick={() => setOpen(true)}
        aria-label="로그인 / 회원가입"
        className={`rounded-full border p-2 ${
          businessMode ? "border-white/50 text-white hover:bg-white/10" : "border-border text-foreground/70 hover:bg-black/[.03]"
        }`}
      >
        <User className="size-4" strokeWidth={2} />
      </button>
      {open && (
        <AccountModal
          profile={profile ?? { email: null }}
          onClose={() => setOpen(false)}
          onAccountChanged={handleChanged}
        />
      )}
      {idCardModal}
    </div>
  );
}
