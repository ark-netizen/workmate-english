// 서비스 로고 — 실제 원본 파일(public/brand/logo-full.png, logo-mark.png) 사용.
import { useBusinessMode } from "@/context/useBusinessMode";

export function LogoMark({ className }: { className?: string }) {
  return <img src="/brand/logo-mark.png" alt="부캐영어" className={className} />;
}

// 로고 자체가 파랑·민트 색이라, 게임 모드(청록 #5aa89a 배경) 헤더 위에 그대로 올리면 민트색
// 말풍선이 배경에 묻혀 잘 안 보인다. 브랜드 가이드에서 흔히 쓰는 "리버스 모노(흰색 단색)
// 버전" 방식대로, 별도 흰색 로고 파일 없이 CSS 필터로 로고를 흰색 실루엣으로 바꿔서 쓴다
// (흰 배경 박스로 감싸는 방식은 어색해 보여서 제외).
export function Logo({ className, compact = false }: { className?: string; compact?: boolean }) {
  const { businessMode } = useBusinessMode();
  const reverseMono = businessMode ? "brightness(0) invert(1)" : undefined;
  return compact ? (
    <img
      src="/brand/logo-mark.png"
      alt="부캐영어"
      className={`h-7 w-auto object-contain ${className ?? ""}`}
      style={reverseMono ? { filter: reverseMono } : undefined}
    />
  ) : (
    <img
      src="/brand/logo-full.png"
      alt="부캐영어 WorkMate English"
      className={`h-8 w-auto object-contain ${className ?? ""}`}
      style={reverseMono ? { filter: reverseMono } : undefined}
    />
  );
}
