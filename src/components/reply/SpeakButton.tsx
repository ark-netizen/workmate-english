import { useState } from "react";
import { Volume2, VolumeX } from "lucide-react";

// 상대(동료/상사/거래처)가 보낸 메시지 옆에 붙는 "듣기" 버튼 — 브라우저 내장 음성합성(TTS)으로 읽어줌
export function SpeakButton({ text, lang = "en-US" }: { text: string; lang?: string }) {
  const [speaking, setSpeaking] = useState(false);
  const supported = typeof window !== "undefined" && "speechSynthesis" in window;

  if (!supported) return null;

  const handleClick = () => {
    if (speaking) {
      window.speechSynthesis.cancel();
      setSpeaking(false);
      return;
    }
    window.speechSynthesis.cancel(); // 이전에 읽던 게 겹쳐 재생되지 않도록 먼저 정리
    const utterance = new SpeechSynthesisUtterance(text);
    utterance.lang = lang;
    utterance.onend = () => setSpeaking(false);
    utterance.onerror = () => setSpeaking(false);
    setSpeaking(true);
    window.speechSynthesis.speak(utterance);
  };

  return (
    <button
      type="button"
      onClick={handleClick}
      title={speaking ? "재생 중지" : "듣기"}
      className={`ml-1 inline-flex items-center text-[11px] underline-offset-2 ${
        speaking ? "text-accent" : "text-foreground/40 hover:text-foreground/70"
      }`}
    >
      {speaking ? <VolumeX className="size-3.5" /> : <Volume2 className="size-3.5" />}
    </button>
  );
}
