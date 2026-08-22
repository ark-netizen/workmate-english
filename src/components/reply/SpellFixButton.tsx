import { useState } from "react";
import * as api from "@/lib/api";

// 답장 입력창 위 힌트 칩들(한국어 힌트/단어 힌트/문장 힌트)과 같은 자리·같은 스타일로 두는
// "오타 교정" 칩 — 철자만 고쳐줌(문법은 리포트 교정용으로 남겨둬야 해서 안 건드림)
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

  const label = status === "checking" ? "확인 중..." : status === "nochange" ? "오타 없어요" : "오타 교정";

  return (
    <button
      type="button"
      onClick={handleClick}
      disabled={!text.trim() || status === "checking"}
      title="단어 철자만 확인해서 고쳐줘요 (문법은 그대로 둬요)"
      className="rounded-full border border-border px-2.5 py-1 text-xs font-medium text-foreground/60 hover:bg-black/[.03] disabled:cursor-not-allowed disabled:opacity-40"
    >
      {label}
    </button>
  );
}
