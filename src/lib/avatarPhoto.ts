// 프로필 사진 — 아직 서버/스토리지 API가 없어 브라우저(localStorage)에만 저장하는 임시 구현.
// 실제 업로드 API가 생기면 이 파일의 저장/조회 로직만 서버 호출로 교체하면 됨.
import { supabase, supabaseReady } from "./supabaseClient.js";

const STORAGE_PREFIX = "go_avatar_photo:";
const MAX_DIMENSION = 256;

async function currentUserId(): Promise<string> {
  if (supabaseReady && supabase) {
    const { data } = await supabase.auth.getSession();
    if (data.session?.user.id) return data.session.user.id;
  }
  return "guest";
}

export async function getAvatarPhoto(): Promise<string | null> {
  const id = await currentUserId();
  try {
    return window.localStorage.getItem(STORAGE_PREFIX + id);
  } catch {
    return null;
  }
}

export async function setAvatarPhoto(dataUrl: string): Promise<void> {
  const id = await currentUserId();
  window.localStorage.setItem(STORAGE_PREFIX + id, dataUrl);
}

// 업로드 UI가 더 이상 없어, 예전에 저장된 사진이 남아있으면 새로 고른 직급 캐릭터 아바타를
// 계속 가리는 문제가 있었다 — 캐릭터를 저장할 때 이 값을 지워서 캐릭터가 실제로 보이게 한다
export async function clearAvatarPhoto(): Promise<void> {
  const id = await currentUserId();
  window.localStorage.removeItem(STORAGE_PREFIX + id);
}

/** 업로드한 이미지를 정사각형으로 크롭 후 축소해 data URL로 반환 (localStorage 용량 보호) */
export function fileToAvatarDataUrl(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onerror = () => reject(new Error("이미지를 읽지 못했습니다."));
    reader.onload = () => {
      const img = new Image();
      img.onerror = () => reject(new Error("이미지를 불러오지 못했습니다."));
      img.onload = () => {
        const cropSize = Math.min(img.width, img.height);
        const sx = (img.width - cropSize) / 2;
        const sy = (img.height - cropSize) / 2;
        const targetSize = Math.min(MAX_DIMENSION, cropSize);

        const canvas = document.createElement("canvas");
        canvas.width = targetSize;
        canvas.height = targetSize;
        const ctx = canvas.getContext("2d");
        if (!ctx) {
          reject(new Error("이미지를 처리하지 못했습니다."));
          return;
        }
        ctx.drawImage(img, sx, sy, cropSize, cropSize, 0, 0, targetSize, targetSize);
        resolve(canvas.toDataURL("image/jpeg", 0.85));
      };
      img.src = reader.result as string;
    };
    reader.readAsDataURL(file);
  });
}
