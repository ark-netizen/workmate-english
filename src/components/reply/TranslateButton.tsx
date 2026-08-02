import { useState } from "react";
import * as api from "@/lib/api";

// 받은 메시지/이메일에 붙는 "번역" 버튼 — 누르면 그 자리에서 한국어 번역을 가져와 보여줌(한 번 가져오면 캐시)
export function TranslateButton({
  text,
  tone = "light",
  role,
}: {
  text: string;
  tone?: "light" | "dark";
  role?: string;
}) {
  const [translation, setTranslation] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [open, setOpen] = useState(false);

  const handleClick = async () => {
    if (translation) {
      setOpen((v) => !v);
      return;
    }
    setLoading(true);
    try {
      const res = await api.translateText(text, role);
      setTranslation(res.translation);
      setOpen(true);
    } finally {
      setLoading(false);
    }
  };

  const linkClass =
    tone === "dark"
      ? "text-white/60 hover:text-white"
      : "text-foreground/40 hover:text-foreground/70";

  return (
    <div className="mt-1">
      <button
        type="button"
        onClick={handleClick}
        disabled={loading}
        className={`text-[11px] underline underline-offset-2 disabled:opacity-50 ${linkClass}`}
      >
        {loading ? "번역 중..." : open && translation ? "번역 숨기기" : "번역"}
      </button>
      {open && translation && (
        <p className={`mt-1 text-xs leading-relaxed ${tone === "dark" ? "text-white/80" : "text-foreground/60"}`}>
          {translation}
        </p>
      )}
    </div>
  );
}
