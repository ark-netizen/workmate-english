import { useState } from "react";
import { SpellCheck } from "lucide-react";
import * as api from "@/lib/api";

// 답장 입력창의 "오타 교정" 버튼 — 철자만 고쳐줌(문법은 리포트 교정용으로 남겨둬야 해서 안 건드림)
export function SpellFixButton({ text, onFixed }: { text: string; onFixed: (corrected: string) => void }) {
  const [status, setStatus] = useState<"idle" | "checking" | "nochange">("idle");

  const handleClick = async () => {
    const trimmed = text.trim();
    if (!trimmed || status === "checking") return;
    setStatus("checking");
    try {
      const res = await api.fixSpelling(trimmed);
      if (res.changed && res.corrected) {
        onFixed(res.corrected);
        setStatus("idle");
      } else {
        setStatus("nochange");
        setTimeout(() => setStatus("idle"), 1500);
      }
    } catch {
      setStatus("idle");
    }
  };

  return (
    <button
      type="button"
      onClick={handleClick}
      disabled={!text.trim() || status === "checking"}
      title="오타(철자) 교정"
      className="shrink-0 rounded-full border border-border p-1.5 text-foreground/50 hover:bg-black/[.03] disabled:opacity-40"
    >
      <SpellCheck className={`size-4 ${status === "checking" ? "animate-pulse" : ""}`} />
      {status === "nochange" && <span className="sr-only">오타 없음</span>}
    </button>
  );
}
