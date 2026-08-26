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
    todayItems,
    sendingIds,
    highlightedMessageId,
    clearHighlightedMessage,
    trialHintSignal,
    pendingReplies,
  } = useWorkday();
  const contact = getContactById(conversation.contactId);
  const isVent = conversation.kind === "vent";
  const isReview = conversation.kind === "review";
  const trialPreset = isTrial && !isVent && contact ? TRIAL_REPLY_TEXT[contact.role] : undefined;
  const alreadyReplied = conversation.messages.some((m) => m.from === "user");
  const isHintGatedRole = isTrial && contact?.role === "manager";
  const hintRevealed = trialHintSignal > 0;
  const shouldPrefillTrial = !isHintGatedRole || hintRevealed;
  // 체험판 예시 답장은 직접 타이핑해서 덮어쓰지 못하게 잠근다 — 지우지 않고 이어 치면
  // 예시 문구 뒤에 그대로 붙어 보내져버리는 문제가 있었음
  const isLockedTrialReply = isTrial && !!trialPreset && !alreadyReplied && shouldPrefillTrial;
  // 체험판의 기본 업무 3건을 모두 처리한 뒤에도 실제 버튼은 평소와 같은 모습으로 둔다.
  // 반복 외근 2회 시연은 우측 TrialGuideBar의 "다음" 버튼이 대신 처리한다.
  const allTrialTasksDone =
    isTrial && todayItems.length > 0 && todayItems.every((item) => item.status !== "pending");

  useEffect(() => {
    if (conversation.unreadCount > 0) {
      markRead(conversation.id);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [conversation.id, conversation.unreadCount]);

  useEffect(() => {
    if (!highlightedMessageId) return;
    if (!conversation.messages.some((m) => m.id === highlightedMessageId)) return;
    const timer = setTimeout(clearHighlightedMessage, 2500);
    return () => clearTimeout(timer);
  }, [highlightedMessageId, conversation.messages, clearHighlightedMessage]);

  const [text, setText] = useState(() => (trialPreset && !alreadyReplied && shouldPrefillTrial ? trialPreset : ""));
  useEffect(() => {
    if (!isTrial) return;
    setText(shouldPrefillTrial && trialPreset && !alreadyReplied ? trialPreset : "");
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [conversation.id, isTrial, shouldPrefillTrial]);

  const [sending, setSending] = useState(false);
  const showSending = sending || sendingIds.has(conversation.id);

  // 일반 대화/고함항아리 모두 같은 높이와 저장 키를 사용한다.
  // 이전 120px 설정이 localStorage에 남아 새 기본값이 반영되지 않는 문제를 막기 위해 v2 키로 올렸다.
  const { size: inputHeight, onDragStart: onInputResizeStart, onResetToDefault: onInputResizeReset } = useResizable({
    storageKey: "messenger-input-height-v2",
    defaultSize: 150,
    min: 80,
    max: 240,
    axis: "y",
    reverse: true,
  });

  const [fieldWorkPending, setFieldWorkPending] = useState(false);
  const [fieldWorkMessage, setFieldWorkMessage] = useState<string | null>(null);
  const [trialFieldWorkClicks, setTrialFieldWorkClicks] = useState(0);
  const [ventPendingMessage, setVentPendingMessage] = useState<{ id: string; body: string; timestamp: string } | null>(
    null,
  );
  const [sendError, setSendError] = useState<string | null>(null);
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
        setVentPendingMessage({ id: `pending-${Date.now()}`, body: trimmed, timestamp: new Date().toISOString() });
        setSending(true);
        await sendVent(trimmed);
      } else {
        setSending(true);
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

      if (allTrialTasksDone) {
        const nextCount = trialFieldWorkClicks + 1;
        setTrialFieldWorkClicks(nextCount);
        setFieldWorkMessage(
          nextCount < 2
            ? "외근 신호가 기록됐어요. 체험판에서는 오른쪽 ‘다음’ 버튼으로 반복 감지를 한 번에 시연할 수 있어요."
            : "반복된 바쁨을 감지했어요. 동료가 먼저 말을 걸어오는 중이에요...",
        );
      } else {
        setFieldWorkMessage(
          result.skipped
            ? result.reason === "nothing-pending"
              ? "외근 상태를 기록했어요. 지금 미룰 예정 연락은 없습니다."
              : result.reason ?? "지금은 미룰 연락이 없습니다."
            : "외근 모드로 전환했습니다. 30분 후 같은 알림이 다시 도착합니다.",
        );
      }
    } finally {
      setFieldWorkPending(false);
    }
  };

  return (
    <div className="flex h-full min-h-0 w-full flex-col overflow-hidden">
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

      {/* 메신저 안쪽 스크롤 영역을 명확히 분리. 바깥 페이지는 MessengerLayout에서 overflow를 막는다. */}
      <div className="min-h-0 flex-1 space-y-3 overflow-y-scroll border-r-4 border-r-background px-4 py-4 [scrollbar-gutter:stable]">
        {displayMessages.map((message) => (
          <div
            key={message.id}
            className={`flex ${message.from === "user" ? "justify-end" : "justify-start"}`}
          >
            <div
              className={`max-w-[75%] rounded-2xl px-4 py-2 text-sm transition-shadow ${
                message.from === "user"
                  ? "bg-accent text-white"
                  : "border border-border bg-surface text-foreground shadow-sm"
              } ${message.id === highlightedMessageId ? "ring-2 ring-accent ring-offset-2 animate-pulse" : ""}`}
            >
              <p>{message.body}</p>
              <p
                className={`mt-1 text-[10px] ${
                  message.from === "user" ? "text-white/70" : "text-foreground/50"
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
            <div className="max-w-[75%] rounded-2xl border border-border bg-surface px-4 py-2 text-sm text-foreground/60 shadow-sm">
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
              externalOpenSignal={isHintGatedRole ? trialHintSignal : undefined}
              onLevelChange={setHintLevel}
            />
          )}
          <div className="flex items-end gap-2 rounded-2xl border border-border bg-surface px-4 py-2">
            <textarea
              style={{ height: inputHeight }}
              className={`flex-1 resize-none bg-transparent py-1 text-sm outline-none placeholder:text-foreground/40 ${
                isLockedTrialReply ? "cursor-default" : ""
              }`}
              placeholder="메시지를 입력하세요 (Shift+Enter로 줄바꿈)"
              value={text}
              readOnly={isLockedTrialReply}
              onChange={(e) => {
                if (isLockedTrialReply) return;
                setText(e.target.value);
              }}
              onKeyDown={(e) => {
                if (e.key === "Enter" && !e.shiftKey) {
                  e.preventDefault();
                  handleSend();
                }
              }}
            />
            {!isLockedTrialReply && (
              <VoiceInputButton
                onTranscript={(spoken) => setText((prev) => (prev.trim() ? `${prev.trim()} ${spoken}` : spoken))}
              />
            )}
            {!isVent && (
              <button
                type="button"
                onClick={handleFieldWork}
                disabled={fieldWorkPending}
                title={
                  allTrialTasksDone
                    ? "실서비스에서는 이 버튼을 눌러 외근 상태로 미룰 수 있어요. 체험판의 반복 감지 시연은 오른쪽 ‘다음’ 버튼으로 진행합니다."
                    : "지금 답장하기 어려우면 눌러보세요. 30분 뒤에 같은 연락이 다시 와요."
                }
                className="shrink-0 rounded-full border border-border px-3 py-1 text-xs text-foreground/60 hover:bg-black/[.03] disabled:opacity-60"
              >
                지금 외근 중
              </button>
            )}
            {!isLockedTrialReply && <SpellFixButton text={text} onFixed={setText} />}
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
