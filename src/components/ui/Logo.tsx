// 서비스 로고 — 실제 원본 파일(public/brand/logo-full.png, logo-mark.png) 사용.
import { useBusinessMode } from "@/context/useBusinessMode";

export function LogoMark({ className }: { className?: string }) {
  return <img src="/brand/logo-mark.png" alt="부캐영어" className={className} />;
}

// 로고 자체가 파랑·민트 색이라, 게임 모드(청록 #5aa89a 배경) 헤더 위에 그대로 올리면 민트색
// 말풍선이 배경에 묻혀 색약 사용자뿐 아니라 일반적으로도 잘 안 보인다 — 항상 흰 배경 위에
// 얹어서 배경색과 무관하게 로고 색이 선명하게 유지되도록 한다.
export function Logo({ className, compact = false }: { className?: string; compact?: boolean }) {
  const { businessMode } = useBusinessMode();
  const img = compact ? (
    <img src="/brand/logo-mark.png" alt="부캐영어" className={`h-7 w-auto object-contain ${className ?? ""}`} />
  ) : (
    <img src="/brand/logo-full.png" alt="부캐영어 WorkMate English" className={`h-8 w-auto object-contain ${className ?? ""}`} />
  );
  if (!businessMode) return img;
  return <span className="inline-flex items-center rounded-lg bg-white px-2 py-1 shadow-sm">{img}</span>;
}
