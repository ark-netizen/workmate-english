import { useState } from "react";
import { Navigate, useNavigate } from "react-router-dom";
import { useWorkday } from "@/context/useWorkday";
import { ResizeHandle } from "@/components/ui/ResizeHandle";
import { useResizable } from "@/hooks/useResizable";

// "고함항아리" 첫 메시지 작성 화면 — 아직 오늘의 vent 대화가 없을 때만 보임.
// 이미 있으면 실제 대화방으로 바로 넘어감(다른 대화처럼 메신저 안에서 열리도록).
export function VentStartPage() {
  const { conversations, sendVent } = useWorkday();
  const navigate = useNavigate();
  const [text, setText] = useState("");
  const [sending, setSending] = useState(false);
  const { size: inputHeight, onDragStart: onInputResizeStart, onResetToDefault: onInputResizeReset } = useResizable({
    storageKey: "messenger-input-height-v2",
    defaultSize: 150,
    min: 80,
    max: 240,
    axis: "y",
    reverse: true,
  });

  const ventConversation = conversations.find((c) => c.kind === "vent");
  if (ventConversation) {
    return <Navigate to={`/messenger/${ventConversation.id}`} replace />;
  }

  const handleSend = async () => {
    const trimmed = text.trim();
    if (!trimmed || sending) return;
    setSending(true);
    try {
      const { conversationId } = await sendVent(trimmed);
      navigate(`/messenger/${conversationId}`);
    } finally {
      setSending(false);
    }
  };

  return (
    <div className="flex h-full w-full flex-col overflow-hidden">
      <div className="flex h-12 shrink-0 items-center gap-3 border-b border-border bg-[#36454F] px-4">
        <p className="text-sm font-medium text-white">🫙 고함항아리</p>
        <p className="text-xs text-white/60">스트레스 받을 때 소리질러보세요!</p>
      </div>

      <div className="min-h-0 flex-1 space-y-2 overflow-y-auto px-4 py-6 text-center text-sm text-foreground/50 [scrollbar-gutter:stable]">
        <p>업무 얘기가 아니어도 괜찮아요.</p>
        <p>편하게 영어로, 하고 싶은 말을 동료에게 먼저 걸어보세요.</p>
      </div>

      <div className="flex shrink-0 flex-col border-t border-border">
        <ResizeHandle axis="y" onMouseDown={onInputResizeStart} onDoubleClick={onInputResizeReset} />
        <div className="px-3 pt-3">
          <div className="flex items-end gap-2 rounded-2xl border border-border bg-surface px-4 py-2">
            <textarea
              autoFocus
              style={{ height: inputHeight }}
              className="flex-1 resize-none bg-transparent py-1 text-sm outline-none placeholder:text-foreground/40"
              placeholder="예: Ugh, today was so busy... 오늘 진짜 바빴어"
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
              className="shrink-0 rounded-full bg-accent px-3 py-1 text-xs font-medium text-white disabled:opacity-50"
            >
              {sending ? "보내는 중..." : "말 걸기"}
            </button>
          </div>
        </div>
        <p className="shrink-0 px-4 py-2 text-[11px] text-foreground/35">
          실명·연락처 등 개인정보나 실제 회사 기밀은 입력하지 마세요.
        </p>
      </div>
    </div>
  );
}
