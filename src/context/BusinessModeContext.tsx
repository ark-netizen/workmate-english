import { useEffect, useState } from "react";
import type { ReactNode } from "react";
import { BusinessModeContext } from "./business-mode-context-value";
import { getStoredBusinessMode } from "@/lib/businessModePref";

// 인트로 페이지에서 켠 비즈니스 모드가 온보딩 등 다른 화면으로 넘어가도 유지되도록
// document.body에 클래스를 토글해 index.css의 .business-mode 테마 변수를 전역으로 적용한다.
// 사용자가 한 번 직접 고른 값은 localStorage에 저장돼 있어, 새로고침·다른 페이지 이동에도 유지된다.
export function BusinessModeProvider({ children }: { children: ReactNode }) {
  const [businessMode, setBusinessMode] = useState(() => getStoredBusinessMode() ?? true);

  useEffect(() => {
    document.body.classList.toggle("business-mode", businessMode);
  }, [businessMode]);

  return (
    <BusinessModeContext.Provider value={{ businessMode, setBusinessMode }}>{children}</BusinessModeContext.Provider>
  );
}
