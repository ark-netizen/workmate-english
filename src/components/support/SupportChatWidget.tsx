import { useState } from "react";
import { MessageCircleQuestion, X } from "lucide-react";
import * as api from "@/lib/api";
import { useWorkday } from "@/context/useWorkday";
import { SurveyModal } from "./SurveyModal";
import type { SurveySource } from "@/types/api";

interface ChatEntry {
  id: string;
  from: "user" | "bot";
  text: string;
}

type Stage = "start" | "preset" | "freeform" | "inquiry";

// 자주 묻는 질문 — 탭하면 LLM 호출 없이 바로 답변(사전 제공된 답변 우선 노출)
const FAQ_PRESETS: { question: string; answer: string }[] = [
  {
    question: "힌트는 어떻게 써요?",
    answer: "메시지 아래 단어 힌트 → 한국어 힌트 → 문장 힌트 순서로 눌러서 열 수 있어요. 이전 단계를 한 번 열어야 다음 힌트가 풀려요.",
  },
  {
    question: "외근 중 버튼은 뭐예요?",
    answer: "지금 답장하기 어려우면 '지금 외근 중' 버튼을 눌러보세요. 남은 연락이 90분 뒤로 미뤄져요.",
  },
  {
    question: "반차/연차는 어떻게 써요?",
    answer: "홈 화면 상단 '근무 상태'를 눌러서 반차/연차를 선택할 수 있어요. 오늘 남은 연락은 건너뛰어요.",
  },
  {
    question: "고함항아리가 뭐예요?",
    answer: "메신저에 있는 '고함항아리'는 업무 시나리오와 별개로, 동료에게 편하게 영어로 스트레스를 풀 수 있는 채팅이에요. 채점이나 교정 없어요.",
  },
  {
    question: "퇴근하면 뭐가 나와요?",
    answer: "퇴근하면 오늘의 답변을 바탕으로 잘한 표현·교정·필수 암기·총평이 담긴 리포트가 생성돼요. 리포트 페이지에서 확인할 수 있어요.",
  },
];

const STAGE_PLACEHOLDER: Record<Stage, string> = {
  start: "",
  preset: "",
  freeform: "궁금한 점을 자유롭게 물어보세요",
  inquiry: "문의 내용을 남겨주세요",
};

const STAGE_TO_SOURCE: Record<Exclude<Stage, "start">, SurveySource> = {
  preset: "chat_preset",
  freeform: "chat_freeform",
  inquiry: "chat_inquiry",
};

export function SupportChatWidget({
  open,
  onOpenChange,
  showTrigger,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  showTrigger: boolean;
}) {
  const { survey, refresh } = useWorkday();
  const [stage, setStage] = useState<Stage>("start");
  const [text, setText] = useState("");
  const [sending, setSending] = useState(false);
  const [entries, setEntries] = useState<ChatEntry[]>([]);
  const [inquirySent, setInquirySent] = useState(false);
  const [surveySource, setSurveySource] = useState<SurveySource | null>(null);

  const resetChat = () => {
    setStage("start");
    setText("");
    setEntries([]);
    setInquirySent(false);
  };

  // 종료하기 — 어느 단계에서든 챗봇을 닫고, 실제로 뭔가 물어봤다면(대화 있었으면) 이어서 설문조사로.
  // 챗봇발 응답은 배너와 달리 매번 다시 물어봐도 됨(불만 상태에서 쓰는 경우가 많아 배너와 분리 집계).
  const handleEnd = () => {
    onOpenChange(false);
    const hadRealChat = entries.length > 0;
    const endedStage = stage;
    resetChat();
    if (survey && hadRealChat && endedStage !== "start") {
      setSurveySource(STAGE_TO_SOURCE[endedStage]);
    }
  };

  const handlePreset = (preset: { question: string; answer: string }) => {
    setEntries((prev) => [
      ...prev,
      { id: `u-${Date.now()}`, from: "user", text: preset.question },
      { id: `b-${Date.now() + 1}`, from: "bot", text: preset.answer },
    ]);
  };

  const handleSend = async () => {
    const trimmed = text.trim();
    if (!trimmed || sending) return;
    const userEntry: ChatEntry = { id: `u-${Date.now()}`, from: "user", text: trimmed };
    setEntries((prev) => [...prev, userEntry]);
    setText("");
    setSending(true);
    try {
      if (stage === "freeform") {
        const res = await api.askSupportBot(trimmed);
        setEntries((prev) => [...prev, { id: `b-${Date.now()}`, from: "bot", text: res.answer }]);
      } else if (stage === "inquiry") {
        await api.submitSupportInquiry(trimmed);
        setInquirySent(true);
        setEntries((prev) => [
          ...prev,
          { id: `b-${Date.now()}`, from: "bot", text: "문의가 접수됐어요. 확인 후 답변드릴게요!" },
        ]);
      }
    } finally {
      setSending(false);
    }
  };

  if (!open) {
    return (
      <>
        {showTrigger && (
          <button
            type="button"
            onClick={() => onOpenChange(true)}
            aria-label="도움말 챗봇 열기"
            className="fixed bottom-20 right-5 z-40 flex h-14 w-14 items-center justify-center rounded-full bg-accent text-white shadow-lg hover:opacity-90 md:bottom-5"
          >
            <MessageCircleQuestion className="size-6" strokeWidth={2} />
          </button>
        )}
        {surveySource && survey && (
          <SurveyModal
            survey={survey}
            source={surveySource}
            onClose={() => setSurveySource(null)}
            onSubmitted={async () => {
              setSurveySource(null);
              await refresh();
            }}
          />
        )}
      </>
    );
  }

  return (
    <div className="fixed bottom-20 right-5 z-40 flex h-[480px] w-[340px] max-w-[calc(100vw-2.5rem)] flex-col overflow-hidden rounded-2xl border border-border bg-surface shadow-2xl md:bottom-5">
      <div className="flex items-center justify-between bg-[#36454F] px-4 py-3">
        <span className="text-sm font-medium text-white">도움이 필요하신가요?</span>
        <button
          type="button"
          onClick={() => onOpenChange(false)}
          className="rounded p-1 text-white/70 hover:bg-white/10 hover:text-white"
          aria-label="닫기"
        >
          <X className="size-4" />
        </button>
      </div>

      <div className="flex-1 space-y-2 overflow-y-auto p-3">
        {entries.length === 0 && (
          <div className="rounded-2xl bg-black/[.03] px-3 py-2 text-xs leading-relaxed text-foreground">
            안녕하세요! 부캐영어 이용 중 궁금한 점을 도와드릴게요.
          </div>
        )}
        {entries.map((entry) => (
          <div key={entry.id} className={`flex ${entry.from === "user" ? "justify-end" : "justify-start"}`}>
            <div
              className={`max-w-[85%] rounded-2xl px-3 py-2 text-xs leading-relaxed ${
                entry.from === "user" ? "bg-accent text-white" : "bg-black/[.03] text-foreground"
              }`}
            >
              {entry.text}
            </div>
          </div>
        ))}
        {sending && <p className="text-xs text-foreground/40">답변 작성 중...</p>}
      </div>

      {stage === "start" && (
        <div className="border-t border-border p-3">
          <button
            type="button"
            onClick={() => setStage("preset")}
            className="w-full rounded-full bg-accent px-3 py-2 text-xs font-medium text-white hover:opacity-90"
          >
            질문 시작하기
          </button>
        </div>
      )}

      {stage === "preset" && (
        <div className="space-y-2 border-t border-border p-3">
          <div className="flex flex-wrap gap-1.5">
            {FAQ_PRESETS.map((preset) => (
              <button
                key={preset.question}
                type="button"
                onClick={() => handlePreset(preset)}
                className="rounded-full border border-border px-2.5 py-1 text-[11px] text-foreground/60 hover:bg-black/[.03]"
              >
                {preset.question}
              </button>
            ))}
          </div>
          <div className="flex gap-2">
            <button
              type="button"
              onClick={handleEnd}
              className="flex-1 rounded-full border border-border px-3 py-1.5 text-xs text-foreground/60 hover:bg-black/[.03]"
            >
              종료하기
            </button>
            <button
              type="button"
              onClick={() => setStage("freeform")}
              className="flex-1 rounded-full bg-accent px-3 py-1.5 text-xs font-medium text-white hover:opacity-90"
            >
              이외에 질문이 있으신가요?
            </button>
          </div>
        </div>
      )}

      {(stage === "freeform" || stage === "inquiry") && (
        <div className="space-y-2 border-t border-border p-3">
          <div className="flex items-end gap-2">
            <textarea
              rows={1}
              className="flex-1 resize-none rounded-lg border border-border bg-transparent px-3 py-1.5 text-sm outline-none placeholder:text-foreground/40"
              placeholder={STAGE_PLACEHOLDER[stage]}
              value={text}
              onChange={(e) => setText(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter" && !e.shiftKey) {
                  e.preventDefault();
                  handleSend();
                }
              }}
            />
            <button
              type="button"
              onClick={handleSend}
              disabled={sending || !text.trim()}
              className="shrink-0 rounded-full bg-accent px-3 py-1.5 text-xs font-medium text-white disabled:opacity-50"
            >
              {stage === "freeform" ? "질문" : inquirySent ? "추가 전송" : "문의 전송"}
            </button>
          </div>
          <div className="flex gap-2">
            <button
              type="button"
              onClick={handleEnd}
              className="flex-1 rounded-full border border-border px-3 py-1.5 text-xs text-foreground/60 hover:bg-black/[.03]"
            >
              종료하기
            </button>
            {stage === "freeform" && (
              <button
                type="button"
                onClick={() => setStage("inquiry")}
                className="flex-1 rounded-full border border-border px-3 py-1.5 text-xs text-foreground/60 hover:bg-black/[.03]"
              >
                담당자에게 문의 남기기
              </button>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
