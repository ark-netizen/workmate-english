// 서비스 로고 — 실제 원본 파일(public/brand/logo-full.png, logo-mark.png) 사용.
export function LogoMark({ className }: { className?: string }) {
  return <img src="/brand/logo-mark.png" alt="부캐영어" className={className} />;
}

export function Logo({ className, compact = false }: { className?: string; compact?: boolean }) {
  if (compact) {
    return <img src="/brand/logo-mark.png" alt="부캐영어" className={`h-7 w-auto object-contain ${className ?? ""}`} />;
  }
  return <img src="/brand/logo-full.png" alt="부캐영어 WorkMate English" className={`h-8 w-auto object-contain ${className ?? ""}`} />;
}
