import { Mic, MicOff } from "lucide-react";
import { useSpeechRecognition } from "@/hooks/useSpeechRecognition";

// 답장/메일 입력창에 붙는 음성 입력 버튼 — 누르는 동안 듣고, 인식된 영어 문장을 onTranscript로 넘김
export function VoiceInputButton({ onTranscript }: { onTranscript: (text: string) => void }) {
  const { supported, listening, start, stop } = useSpeechRecognition({ lang: "en-US" });

  // 테두리 있는 원이라 옆의 텍스트 버튼들 사이에서 혼자 도드라져 보였다 — 테두리를 빼고 아이콘만
  // 남겨서 툴 버튼처럼 가라앉히고, 호버/듣는 중에만 배경을 준다.
  const baseClass =
    "inline-flex h-8 w-8 min-h-8 min-w-8 shrink-0 items-center justify-center overflow-hidden rounded-full p-0 leading-none";

  if (!supported) {
    return (
      <span
        title="이 브라우저는 음성 입력을 지원하지 않아요 (Chrome/Edge 권장)"
        className={`${baseClass} text-foreground/20`}
      >
        <MicOff className="block size-4 shrink-0" />
      </span>
    );
  }

  return (
    <button
      type="button"
      onClick={() => (listening ? stop() : start(onTranscript))}
      title={listening ? "음성 입력 중지" : "음성으로 입력"}
      className={`${baseClass} transition-colors ${
        listening
          ? "animate-pulse bg-red-50 text-red-600"
          : "text-foreground/40 hover:bg-black/[.05]"
      }`}
    >
      <Mic className="block size-4 shrink-0" />
    </button>
  );
}
