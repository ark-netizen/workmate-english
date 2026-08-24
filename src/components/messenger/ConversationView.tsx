import { useEffect, useMemo, useState } from "react";
import { Link } from "react-router-dom";
import type { Conversation } from "@/types/domain";
import { useWorkday } from "@/context/useWorkday";
import { ReplyHints } from "@/components/reply/ReplyHints";
import { TranslateButton } from "@/components/reply/TranslateButton";
import { SpeakButton } from "@/components/reply/SpeakButton";
import { VoiceInputButton } from "@/components/reply/VoiceInputButton";
import { SpellFixButton } from "@/components/reply/SpellFixButton";
import { ResizeHandle } from "@/components/ui/ResizeHandle";
import { useResizable } from "@/hooks/useResizable";
import { formatTime } from "@/lib/format";
import { resolveReplyHints } from "@/lib/hints";
import { TRIAL_REPLY_TEXT } from "@/lib/trialReplies";

export function ConversationView({ conversation }: { conversation: Conversation }) {
  const {
    getContactById,
    sendReply,
    sendVent,
    markRead,
    goOnFieldWork,
    fieldWorkActiveUntil,
    isTrial,
    sendingIds,
    highlightedMessageId,
    clearHighlightedMessage,
    trialHintSignal,
    pendingReplies,
  } = useWorkday();
  const contact = getContactById(conversation.contactId);
  const isVent = conversation.kind === "vent";
  // 복습(review) 대화는 힌트 없이 스스로 다시 써보는 게 목적 — 실제 힌트도 저장돼있지 않으므로,
  // 안 맞는 일반 힌트를 보여주는 대신 힌트 UI 자체를 숨긴다
  const isReview = conversation.kind === "review";
  // "1분 체험하기" 게스트는 실제 화면은 그대로 두고, 답장을 미리 채워주고 보내기 버튼만 반짝이게 안내
  const trialPreset = isTrial && !isVent && contact ? TRIAL_REPLY_TEXT[contact.role] : undefined;
  const alreadyReplied = conversation.messages.some((m) => m.from === "user");
  // "상사" 단계는 힌트 시연 시나리오가 있어서, 힌트를 보여주기 전까지는 정답을 입력창에 미리 채우면 안 됨
  const isHintGatedRole = isTrial && contact?.role === "manager";
  const hintRevealed = trialHintSignal > 0;
  const shouldPrefillTrial = !isHintGatedRole || hintRevealed;

  useEffect(() => {
    if (conversation.unreadCount > 0) {
      markRead(conversation.id);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [conversation.id, conversation.unreadCount]);

  // 하이라이트된 메시지가 이 대화 안에 있으면 = 방금 실제로 봤다는 뜻이니, 잠깐 보여준 뒤 끈다
  useEffect(() => {
    if (!highlightedMessageId) return;
    if (!conversation.messages.some((m) => m.id === highlightedMessageId)) return;
    const timer = setTimeout(clearHighlightedMessage, 2500);
    return () => clearTimeout(timer);
  }, [highlightedMessageId, conversation.messages, clearHighlightedMessage]);
  const [text, setText] = useState(() => (trialPreset && !alreadyReplied && shouldPrefillTrial ? trialPreset : ""));
  useEffect(() => {
    if (!isTrial) return;
    // 힌트 보여주기 전이면 정답을 채우지 않되, 이전 대화(다른 상대)에서 남은 텍스트가 그대로 보이지
    // 않도록 일단 비워둔다 — 힌트가 열리면 이 effect가 다시 돌면서 그때 채워짐
    setText(shouldPrefillTrial && trialPreset && !alreadyReplied ? trialPreset : "");
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [conversation.id, isTrial, shouldPrefillTrial]);
  const [sending, setSending] = useState(false);
  // 이 대화의 답장이 어디서 트리거됐든(본인 화면 또는 체험판 하단 안내 바) "입력 중" 표시가 뜨도록 공유 상태도 함께 반영
  const showSending = sending || sendingIds.has(conversation.id);
  // 메시지는 원래대로 위에서부터 쌓이게 두고(순서 유지), 입력창 패널 자체를 기본값부터
  // 넉넉하게 키워서 시작점이 화면 아래로 멀리 떨어져 보이지 않게 함
  const { size: inputHeight, onDragStart: onInputResizeStart, onResetToDefault: onInputResizeReset } = useResizable({
    storageKey: "messenger-input-height",
    defaultSize: 120,
    min: 40,
    max: 280,
    axis: "y",
    reverse: true,
  });
  const [fieldWorkPending, setFieldWorkPending] = useState(false);
  const [fieldWorkMessage, setFieldWorkMessage] = useState<string | null>(null);
  // "마음 편하게 말 걸기"(vent)는 conversationId가 sendVent 호출 전엔 없어서 공유 상태에 못 실으므로 로컬로 처리
  const [ventPendingMessage, setVentPendingMessage] = useState<{ id: string; body: string; timestamp: string } | null>(
    null,
  );
  const [sendError, setSendError] = useState<string | null>(null);
  // 이번 답변에서 단어/문장 힌트까지 열었는지 — 복습 정책의 난이도 판정에 쓰임
  const [hintLevel, setHintLevel] = useState<"word" | "sentence" | null>(null);
  useEffect(() => {
    setHintLevel(null);
  }, [conversation.id]);
  const lastContactMessage = [...conversation.messages].reverse().find((message) => message.from === "contact");
  const hints = useMemo(
    () => resolveReplyHints(lastContactMessage?.body, lastContactMessage),
    [lastContactMessage],
  );

  const handleSend = async () => {
    const trimmed = text.trim();
    if (!trimmed || showSending) return;
    setSendError(null);
    setText("");
    try {
      if (isVent) {
        // 내가 보낸 메시지를 서버 응답을 기다리지 않고 바로 화면에 표시(로컬 낙관적 표시)
        setVentPendingMessage({ id: `pending-${Date.now()}`, body: trimmed, timestamp: new Date().toISOString() });
        setSending(true);
        await sendVent(trimmed);
      } else {
        setSending(true);
        // 낙관적 표시(pendingReplies)는 sendReply 내부에서 트리거 주체와 무관하게 채워진다
        await sendReply(conversation.id, trimmed, undefined, hintLevel, hintLevel === "sentence" ? hints.sentence : undefined);
      }
    } catch {
      setSendError("전송에 실패했어요. 다시 시도해주세요.");
      setText(trimmed);
    } finally {
      setVentPendingMessage(null);
      setSending(false);
    }
  };

  // 전송 완료 후 refresh()로 진짜 메시지가 conversation.messages에 반영되는 순간과
  // 낙관적 표시가 지워지는 순간 사이에 텀이 있어서, 그 사이엔 낙관적 표시를 걸러 중복(2개→1개) 노출을 막는다
  const pendingMessage = isVent ? ventPendingMessage : pendingReplies.get(conversation.id) ?? null;
  const hasRealPendingMessage =
    !!pendingMessage && conversation.messages.some((m) => m.from === "user" && m.body === pendingMessage.body);
  const displayMessages =
    pendingMessage && !hasRealPendingMessage
      ? [...conversation.messages, { id: pendingMessage.id, from: "user" as const, body: pendingMessage.body, timestamp: pendingMessage.timestamp }]
      : conversation.messages;

  const handleFieldWork = async () => {
    if (fieldWorkPending) return;
    setFieldWorkPending(true);
    try {
      const result = await goOnFieldWork();
      setFieldWorkMessage(
        result.skipped
          ? result.reason ?? "지금은 미룰 연락이 없습니다."
          : "외근 모드로 전환했습니다. 30분 후 같은 알림이 다시 도착합니다.",
      );
    } finally {
      setFieldWorkPending(false);
    }
  };

  return (
    <div className="flex h-full w-full flex-col">
      <div className="flex h-12 shrink-0 items-center justify-between gap-3 border-b border-border bg-[#36454F] px-4">
        <div className="flex items-center gap-3">
          <Link to="/messenger" className="text-sm text-white/60 md:hidden">
            ← 목록
          </Link>
          <div>
            <p className="text-sm font-medium text-white">{isVent ? "🫙 고함항아리" : contact?.name}</p>
            <p className="text-xs text-white/60">{isVent ? "스트레스 받을 때 소리질러보세요!" : contact?.title}</p>
          </div>
        </div>
        {!isVent && fieldWorkActiveUntil && (
          <span className="shrink-0 rounded-full bg-orange-50 px-2.5 py-1 text-xs font-medium text-orange-700">
            외근 중 · 30분 후 재알림
          </span>
        )}
      </div>

      {fieldWorkMessage && (
        <p className="border-b border-border bg-black/[.02] px-4 py-2 text-xs text-foreground/60">
          {fieldWorkMessage}
        </p>
      )}

      <div className="flex-1 space-y-3 overflow-y-auto px-4 py-4">
        {displayMessages.map((message) => (
          <div
            key={message.id}
            className={`flex ${message.from === "user" ? "justify-end" : "justify-start"}`}
          >
            <div
              className={`max-w-[75%] rounded-2xl px-4 py-2 text-sm transition-shadow ${
                message.from === "user"
                  ? "bg-accent text-white"
                  : "bg-black/[.025] text-foreground"
              } ${message.id === highlightedMessageId ? "ring-2 ring-accent ring-offset-2 animate-pulse" : ""}`}
            >
              <p>{message.body}</p>
              <p
                className={`mt-1 text-[10px] ${
                  message.from === "user" ? "text-white/70" : "text-foreground/40"
                }`}
              >
                {formatTime(message.timestamp)}
              </p>
              {message.from === "contact" && (
                <span className="inline-flex items-center gap-1">
                  <TranslateButton text={message.body} role={isVent ? undefined : contact?.role} />
                  <SpeakButton text={message.body} />
                </span>
              )}
            </div>
          </div>
        ))}
        {showSending && (
          <div className="flex justify-start">
            <div className="max-w-[75%] rounded-2xl bg-black/[.025] px-4 py-2 text-sm text-foreground/50">
              {isVent ? "고함항아리" : contact?.name ?? "상대방"}님이 답장을 작성 중...
            </div>
          </div>
        )}
      </div>

      <div className="flex shrink-0 flex-col border-t border-border">
        <ResizeHandle axis="y" onMouseDown={onInputResizeStart} onDoubleClick={onInputResizeReset} />
        <div className="space-y-2 px-3 pt-3">
          {sendError && <p className="text-xs text-red-600">{sendError}</p>}
          {!isReview && (
            <ReplyHints
              key={conversation.id}
              hints={hints}
              externalOpenSignal={isTrial ? trialHintSignal : undefined}
              onLevelChange={setHintLevel}
            />
          )}
          <div className="flex items-end gap-2 rounded-2xl border border-border bg-surface px-4 py-2">
            <textarea
              style={{ height: inputHeight }}
              className="flex-1 resize-none bg-transparent py-1 text-sm outline-none placeholder:text-foreground/40"
              placeholder="메시지를 입력하세요 (Shift+Enter로 줄바꿈)"
              value={text}
              onChange={(e) => setText(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter" && !e.shiftKey) {
                  e.preventDefault();
                  handleSend();
                }
              }}
            />
            <VoiceInputButton
              onTranscript={(spoken) => setText((prev) => (prev.trim() ? `${prev.trim()} ${spoken}` : spoken))}
            />
            {!isVent && (
              <button
                type="button"
                onClick={handleFieldWork}
                disabled={fieldWorkPending}
                title="지금 답장하기 어려우면 눌러보세요. 30분 뒤에 같은 연락이 다시 와요."
                className="shrink-0 rounded-full border border-border px-3 py-1 text-xs text-foreground/60 hover:bg-black/[.03] disabled:opacity-50"
              >
                지금 외근 중
              </button>
            )}
            <SpellFixButton text={text} onFixed={setText} />
            <button
              type="button"
              onClick={handleSend}
              disabled={showSending || !text.trim()}
              className="shrink-0 rounded-full bg-accent px-3 py-1 text-xs font-medium text-white disabled:opacity-50"
            >
              보내기
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
