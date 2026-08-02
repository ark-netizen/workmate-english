import { hashString } from "@/lib/hash";

/** 실제 사번 DB가 없어, 이름/이메일 기반의 고정된 해시로 사원증에 쓸 사번을 만든다 */
export function deriveEmployeeId(seed: string): string {
  const n = hashString(seed || "guest") % 100000;
  return `GO-${String(n).padStart(5, "0")}`;
}
