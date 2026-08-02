import { useContext } from "react";
import { BusinessModeContext } from "./business-mode-context-value";

export function useBusinessMode() {
  const ctx = useContext(BusinessModeContext);
  if (!ctx) {
    throw new Error("useBusinessMode must be used within a BusinessModeProvider");
  }
  return ctx;
}
