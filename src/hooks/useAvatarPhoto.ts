// 여러 컴포넌트(상단 프로필, 사원증 모달, 온보딩 리빌 화면)가 같은 프로필 사진을 즉시 공유하도록
// localStorage 기반 저장소를 감싼 훅. 같은 탭 안에서는 storage 이벤트가 안 뜨므로 커스텀 이벤트로 동기화한다.
import { useCallback, useEffect, useState } from "react";
import { getAvatarPhoto, setAvatarPhoto, clearAvatarPhoto } from "@/lib/avatarPhoto";

const AVATAR_UPDATED_EVENT = "go:avatar-updated";

export function useAvatarPhoto() {
  const [photoUrl, setPhotoUrl] = useState<string | null>(null);

  const load = useCallback(() => {
    getAvatarPhoto().then(setPhotoUrl);
  }, []);

  useEffect(() => {
    load();
    window.addEventListener(AVATAR_UPDATED_EVENT, load);
    return () => window.removeEventListener(AVATAR_UPDATED_EVENT, load);
  }, [load]);

  const updatePhoto = useCallback(async (dataUrl: string) => {
    await setAvatarPhoto(dataUrl);
    setPhotoUrl(dataUrl);
    window.dispatchEvent(new Event(AVATAR_UPDATED_EVENT));
  }, []);

  const clearPhoto = useCallback(async () => {
    await clearAvatarPhoto();
    setPhotoUrl(null);
    window.dispatchEvent(new Event(AVATAR_UPDATED_EVENT));
  }, []);

  return { photoUrl, updatePhoto, clearPhoto };
}
