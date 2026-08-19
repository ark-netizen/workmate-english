import { useCallback, useEffect, useRef, useState } from "react";

// 브라우저 내장 Web Speech API 래퍼 — 별도 STT API 없이 크롬/엣지에서 바로 동작.
// Safari/Firefox는 미지원이라 supported=false로 내려가고, 버튼 쪽에서 비활성 처리.
export function useSpeechRecognition({ lang = "en-US" }: { lang?: string } = {}) {
  const RecognitionCtor =
    typeof window !== "undefined" ? window.SpeechRecognition ?? window.webkitSpeechRecognition : undefined;
  const supported = Boolean(RecognitionCtor);
  const [listening, setListening] = useState(false);
  const recognitionRef = useRef<SpeechRecognition | null>(null);

  useEffect(() => {
    return () => {
      recognitionRef.current?.abort();
    };
  }, []);

  const start = useCallback(
    (onResult: (transcript: string) => void) => {
      if (!RecognitionCtor || recognitionRef.current) return;
      const recognition = new RecognitionCtor();
      recognition.lang = lang;
      recognition.continuous = false;
      recognition.interimResults = false;
      recognition.maxAlternatives = 1;
      recognition.onresult = (event) => {
        const transcript = Array.from({ length: event.results.length })
          .map((_, i) => event.results[i][0].transcript)
          .join(" ")
          .trim();
        if (transcript) onResult(transcript);
      };
      recognition.onerror = () => {
        recognitionRef.current = null;
        setListening(false);
      };
      recognition.onend = () => {
        recognitionRef.current = null;
        setListening(false);
      };
      recognitionRef.current = recognition;
      setListening(true);
      recognition.start();
    },
    [RecognitionCtor, lang],
  );

  const stop = useCallback(() => {
    recognitionRef.current?.stop();
  }, []);

  return { supported, listening, start, stop };
}
