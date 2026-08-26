import { useState } from "react";
import { useWorkday } from "@/context/useWorkday";
import { ConversationView } from "@/components/messenger/ConversationView";
import { ResizeHandle } from "@/components/ui/ResizeHandle";
import { useResizable } from "@/hooks/useResizable";

const TRIAL_VENT_TEXT = "Ugh, today was so busy. I just want to scream!";

// 고함항아리는 항상 /messenger/vent라는 고정 경로에서 처리한다.
// 대화가 이미 있으면 별도 conversation id로 리다이렉트하지 않고 이 자리에서 그대로 렌더링한다.
// 이렇게 해야 refresh 시점에 vent id가 잠깐 달라지거나 사라져도 NotFound로 튀지 않는다.
export function VentStartPage() {
  const { conversations, sendVent, isTrial } = useWorkday();
  // 1분 무료체험에서는 시연자가 타이핑에 시간을 쓰지 않고 바로 기능을 보여줄 수 있도록
  // 짧은 예시 문장을 미리 채운다. 일반 사용자는 기존처럼 빈 입력창에서 시작한다.
  const [text, setText] = useState(() => (isTrial ? TRIAL_VENT_TEXT : ""));
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
    return <ConversationView conversation={ventConversation} />;
  }

  const handleSend = async () => {
    const trimmed = text.trim();
    if (!trimmed || sending) return;
    setSending(true);
    try {
      await sendVent(trimmed);
      // sendVent가 refresh까지 끝내므로 conversations에 vent가 들어오고,
      // 이 컴포넌트가 그대로 ConversationView로 전환된다. URL 이동은 하지 않는다.
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
        {isTrial && (
          <p className="mx-auto mt-4 max-w-md rounded-lg border border-border bg-surface px-3 py-2 text-xs leading-relaxed text-foreground/60">
            체험용 문장을 미리 넣어뒀어요. 그대로 보내거나 원하는 말로 바꿔보세요.
          </p>
        )}
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
