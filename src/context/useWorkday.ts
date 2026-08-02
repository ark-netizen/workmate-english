import { useContext } from "react";
import { WorkdayContext } from "./workday-context-value";

export function useWorkday() {
  const ctx = useContext(WorkdayContext);
  if (!ctx) {
    throw new Error("useWorkday must be used within a WorkdayProvider");
  }
  return ctx;
}
