import { useEffect, useMemo, useRef, useState } from "react";
import { Link } from "react-router-dom";
import { ChevronDown, ChevronUp, Maximize2, Minimize2, Minus, Send } from "lucide-react";
import type { Email, EmailThread } from "@/types/domain";
import { useWorkday } from "@/context/useWorkday";
import { Avatar } from "@/components/ui/Avatar";
import { ReplyHints } from "@/components/reply/ReplyHints";
import { TranslateButton } from "@/components/reply/TranslateButton";
import { SpeakButton } from "@/components/reply/SpeakButton";
import { VoiceInputButton } from "@/components/reply/VoiceInputButton";
import { ResizeHandle } from "@/components/ui/ResizeHandle";
import { useResizable } from "@/hooks/useResizable";
import { formatDateTime } from "@/lib/format";
import { resolveReplyHints } from "@/lib/hints";
import { TRIAL_REPLY_TEXT } from "@/lib/trialReplies";
import * as api from "@/lib/api";

// 회신 작성란 기본값 — 상대 이름/내 이름을 채운 Dear/Best 틀만 미리 채워주고 본문은 직접 쓰게 한다
function buildDefaultReplyText(contactName: string | undefined, displayName: string | undefined): string {
  return `Dear ${contactName ?? ""},\n\n\n\nBest,\n${displayName ?? ""}`;
}

type ComposeState = "normal" | "minimized" | "maximized";

// 회신 제목엔 실제 이메일처럼 "Re: "를 자동으로 붙임(이미 붙어있으면 중복 안 되게)
function withReplyPrefix(subject: string): string {
  if (!subject) return subject;
  return /^re:\s*/i.test(subject) ? subject : `Re: ${subject}`;
}

function EmailMessage({
  email,
  senderName,
  senderRole,
  expanded,
  onToggle,
  highlighted,
}: {
  email: Email;
  senderName: string;
  senderRole?: string;
  expanded: boolean;
  onToggle: () => void;
  highlighted?: boolean;
}) {
  const isUser = email.from === "user";
  const displayName = isUser ? "나" : senderName;
  const highlightClass = highlighted ? "ring-2 ring-accent ring-offset-2 animate-pulse" : "";

  if (!expanded) {
    return (
      <button
        type="button"
        onClick={onToggle}
        className={`flex w-full items-center gap-3 rounded-lg border border-border bg-surface px-4 py-2.5 text-left transition-shadow hover:bg-black/[.02] ${highlightClass}`}
      >
        <Avatar name={displayName} size="sm" />
        <span className="shrink-0 truncate text-sm font-medium text-foreground/80">{displayName}</span>
        <span className="min-w-0 flex-1 truncate text-sm text-foreground/40">{email.body}</span>
        <span className="shrink-0 text-xs text-foreground/40">{formatDateTime(email.timestamp)}</span>
        <ChevronDown className="size-4 shrink-0 text-foreground/30" />
      </button>
    );
  }

  return (
    <div className={`rounded-lg border border-border bg-surface transition-shadow ${highlightClass}`}>
      <button type="button" onClick={onToggle} className="flex w-full items-center gap-3 px-4 py-3 text-left">
        <Avatar name={displayName} />
        <div className="min-w-0 flex-1">
          <p className="truncate text-sm font-medium text-foreground">{displayName}</p>
          <p className="truncate text-xs text-foreground/40">{isUser ? `to ${senderName}` : "to 나"}</p>
        </div>
        <span className="shrink-0 text-xs text-foreground/40">{formatDateTime(email.timestamp)}</span>
        <ChevronUp className="size-4 shrink-0 text-foreground/30" />
      </button>
      <p className="whitespace-pre-line px-4 pb-2 text-sm leading-normal text-foreground/90">
        {email.body.replace(/\n{3,}/g, "\n\n")}
      </p>
      {!isUser && (
        <div className="flex items-center gap-1 px-4 pb-4">
          <TranslateButton text={email.body} role={senderRole} />
          <SpeakButton text={email.body} />
        </div>
      )}
    </div>
  );
}

export function EmailView({ thread }: { thread: EmailThread }) {
  const {
    getContactById,
    sendReply,
    markRead,
    goOnFieldWork,
    fieldWorkActiveUntil,
    isTrial,
    sendingIds,
    highlightedMessageId,
    clearHighlightedMessage,
    pendingReplies,
  } = useWorkday();
  const contact = getContactById(thread.contactId);
  // "1분 체험하기" 게스트는 실제 화면은 그대로 두고, 답장을 미리 채워주고 보내기 버튼만 반짝이게 안내
  const trialPreset = isTrial && contact ? TRIAL_REPLY_TEXT[contact.role] : undefined;
  const alreadyReplied = thread.emails.some((e) => e.from === "user");
  // 복습(review) 메일은 힌트 없이 스스로 다시 써보는 게 목적 — 실제 힌트도 저장돼있지 않으므로 힌트 UI를 숨긴다
  const isReview = thread.kind === "review";

  const [displayName, setDisplayName] = useState<string | undefined>(undefined);
  useEffect(() => {
    api.getProfile().then((p) => setDisplayName(p.display_name ?? undefined)).catch(() => {});
  }, []);
  // 본문을 직접 건드리기 전까지만 Dear/Best 기본틀을 자동으로 채워준다(이미 입력 중인 내용을 덮어쓰지 않기 위해)
  const textIsDefaultRef = useRef(true);

  useEffect(() => {
    if (thread.unreadCount > 0) {
      markRead(thread.id);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [thread.id, thread.unreadCount]);

  // 하이라이트된 메일이 이 스레드 안에 있으면 = 방금 실제로 봤다는 뜻이니, 잠깐 보여준 뒤 끈다
  useEffect(() => {
    if (!highlightedMessageId) return;
    if (!thread.emails.some((e) => e.id === highlightedMessageId)) return;
    const timer = setTimeout(clearHighlightedMessage, 2500);
    return () => clearTimeout(timer);
  }, [highlightedMessageId, thread.emails, clearHighlightedMessage]);
  const [text, setText] = useState(() =>
    trialPreset && !alreadyReplied ? trialPreset : !isTrial && !alreadyReplied ? buildDefaultReplyText(contact?.name, displayName) : "",
  );
  const [subject, setSubject] = useState(withReplyPrefix(thread.subject));
  const [sending, setSending] = useState(false);
  // 이 스레드의 회신이 어디서 트리거됐든(본인 화면 또는 체험판 하단 안내 바) "작성 중" 표시가 뜨도록 공유 상태도 함께 반영
  const showSending = sending || sendingIds.has(thread.id);
  const [composeState, setComposeState] = useState<ComposeState>("normal");

  useEffect(() => {
    textIsDefaultRef.current = true;
    setText(
      trialPreset && !alreadyReplied ? trialPreset : !isTrial && !alreadyReplied ? buildDefaultReplyText(contact?.name, displayName) : "",
    );
    setSubject(withReplyPrefix(thread.subject));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [thread.id]);

  // 프로필 이름이 마운트 이후 늦게 도착하면(비동기 조회), 아직 손대지 않은 기본틀에 한해 이름을 채워 넣는다
  useEffect(() => {
    if (isTrial || alreadyReplied || !textIsDefaultRef.current) return;
    setText(buildDefaultReplyText(contact?.name, displayName));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [contact?.name, displayName]);
  const {
    size: composeHeight,
    onDragStart: onComposeResizeStart,
    onResetToDefault: onComposeResizeReset,
  } = useResizable({
    storageKey: "email-compose-height",
    defaultSize: 300,
    min: 220,
    max: 520,
    axis: "y",
    reverse: true,
  });
  const [fieldWorkPending, setFieldWorkPending] = useState(false);
  const [fieldWorkMessage, setFieldWorkMessage] = useState<string | null>(null);
  // 낙관적 표시(pendingEmail)는 sendReply 내부에서 트리거 주체(본인 화면 vs 체험판 안내 바)와 무관하게 채워진다
  const pendingEmail = pendingReplies.get(thread.id) ?? null;
  const [sendError, setSendError] = useState<string | null>(null);
  const lastEmail = thread.emails[thread.emails.length - 1];
  const [expandedId, setExpandedId] = useState<string | null>(lastEmail?.id ?? null);
  // 내가 보내거나 상대가 회신해서 새 메일이 쌓이면, 이전에 열어둔 메일이 아니라 방금 온 그 메일이 펼쳐진 채로 보여야 함
  const lastEmailIdRef = useRef(lastEmail?.id ?? null);
  useEffect(() => {
    if (lastEmail && lastEmail.id !== lastEmailIdRef.current) {
      lastEmailIdRef.current = lastEmail.id;
      setExpandedId(lastEmail.id);
    }
  }, [lastEmail]);
  // 낙관적 표시가 새로 뜨는 순간에도(트리거 주체 무관) 그 자리를 바로 펼쳐서 보여줌
  useEffect(() => {
    if (pendingEmail) setExpandedId(pendingEmail.id);
  }, [pendingEmail]);
  const lastContactEmail = [...thread.emails].reverse().find((email) => email.from === "contact");
  const hints = useMemo(
    () => resolveReplyHints(lastContactEmail?.body, lastContactEmail),
    [lastContactEmail],
  );

  // 제목은 이미 원본 제목으로 자동 채워져 있어 따로 힌트가 필요 없음 — 본문 힌트 레벨만 복습 난이도 판정에 사용
  const [bodyHintLevel, setBodyHintLevel] = useState<"word" | "sentence" | null>(null);
  useEffect(() => {
    setBodyHintLevel(null);
  }, [thread.id]);
  const hintLevel = bodyHintLevel;

  const handleSend = async () => {
    const trimmed = text.trim();
    if (!trimmed || showSending) return;
    setSendError(null);
    setText("");
    setSending(true);
    try {
      // 낙관적 표시(pendingEmail) + 펼침 처리는 sendReply/그 결과를 지켜보는 effect에서 트리거 주체와
      // 무관하게 일어난다
      await sendReply(
        thread.id,
        trimmed,
        subject.trim() || thread.subject,
        hintLevel,
        hintLevel === "sentence" ? hints.sentence : undefined,
      );
    } catch {
      setSendError("전송에 실패했어요. 다시 시도해주세요.");
      setText(trimmed);
    } finally {
      setSending(false);
    }
  };

  // 전송 완료 후 refresh()로 진짜 메일이 thread.emails에 반영되는 순간과
  // pendingEmail이 지워지는 순간 사이에 텀이 있어서, 그 사이엔 낙관적 표시를 걸러 중복(2개→1개) 노출을 막는다
  const hasRealPendingEmail =
    !!pendingEmail && thread.emails.some((e) => e.from === "user" && e.body === pendingEmail.body);
  const displayEmails =
    pendingEmail && !hasRealPendingEmail
      ? [...thread.emails, { id: pendingEmail.id, from: "user" as const, subject: thread.subject, body: pendingEmail.body, timestamp: pendingEmail.timestamp }]
      : thread.emails;

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

  const isMaximized = composeState === "maximized";

  const composeBody = (
    <>
      <div className="flex items-center gap-2 rounded-t-xl border-b border-border bg-[#4B5A66] px-4 py-2">
        <span className="shrink-0 text-xs text-white/60">제목</span>
        <input
          type="text"
          autoFocus
          className="min-w-0 flex-1 bg-transparent text-sm font-medium text-white outline-none placeholder:text-white/40"
          placeholder="제목을 입력하세요"
          value={subject}
          onChange={(e) => setSubject(e.target.value)}
        />
        <div className="flex shrink-0 items-center gap-1">
          <button
            type="button"
            onClick={() => setComposeState("minimized")}
            className="rounded p-1 text-white/70 hover:bg-white/10 hover:text-white"
            aria-label="최소화"
          >
            <Minus className="size-4" />
          </button>
          <button
            type="button"
            onClick={() => setComposeState(isMaximized ? "normal" : "maximized")}
            className="rounded p-1 text-white/70 hover:bg-white/10 hover:text-white"
            aria-label={isMaximized ? "원래 크기로" : "최대화"}
          >
            {isMaximized ? <Minimize2 className="size-4" /> : <Maximize2 className="size-4" />}
          </button>
        </div>
      </div>

      <div className="flex flex-1 flex-col gap-2 overflow-y-auto p-4">
        {fieldWorkMessage && <p className="text-xs text-foreground/50">{fieldWorkMessage}</p>}
        {sendError && <p className="text-xs text-red-600">{sendError}</p>}

        {!isReview && (
          <div className="shrink-0">
            <p className="mb-1 text-[11px] font-medium text-foreground/40">본문 힌트</p>
            <ReplyHints key={thread.id} hints={hints} onLevelChange={setBodyHintLevel} />
          </div>
        )}

        <div className="flex min-h-0 flex-1 gap-3">
          <Avatar name="나" size="sm" />
          <textarea
            className={`min-h-[110px] min-w-0 flex-1 resize-none border-0 bg-transparent p-0 text-sm leading-relaxed outline-none placeholder:text-foreground/40 ${
              isMaximized ? "min-h-[320px]" : ""
            }`}
            rows={isMaximized ? 16 : 5}
            placeholder="회신 내용을 입력하세요"
            value={text}
            onChange={(e) => {
              textIsDefaultRef.current = false;
              setText(e.target.value);
            }}
          />
          <VoiceInputButton
            onTranscript={(spoken) => {
              textIsDefaultRef.current = false;
              setText((prev) => (prev.trim() ? `${prev.trim()} ${spoken}` : spoken));
            }}
          />
        </div>
      </div>

      <p className="shrink-0 border-t border-border px-4 py-1.5 text-[11px] text-foreground/35">
        실명·연락처 등 개인정보나 실제 회사 기밀은 입력하지 마세요.
      </p>

      <div className="flex items-center justify-end gap-2 rounded-b-xl border-t border-border px-4 py-3">
        <button
          type="button"
          onClick={handleFieldWork}
          disabled={fieldWorkPending}
          className="shrink-0 rounded-full border border-border px-3 py-1.5 text-xs text-foreground/60 hover:bg-black/[.03] disabled:opacity-50"
        >
          지금 외근 중
        </button>
        <button
          type="button"
          onClick={handleSend}
          disabled={showSending || !text.trim()}
          className="flex items-center gap-2 rounded-full bg-accent px-5 py-2 text-sm font-medium text-white transition-opacity hover:opacity-90 disabled:opacity-50"
        >
          보내기
          <Send className="size-3.5" />
        </button>
      </div>
    </>
  );

  return (
    <div className="flex h-full w-full flex-col">
      <div className="flex h-12 shrink-0 items-center justify-between gap-3 border-b border-border bg-[#4B5A66] px-6">
        <div className="flex min-w-0 items-center gap-3">
          <Link to="/email" className="shrink-0 text-sm text-white/60 md:hidden">
            ← 목록
          </Link>
          <div className="min-w-0">
            <h2 className="truncate text-sm font-medium text-white">{thread.subject}</h2>
            <p className="truncate text-xs text-white/60">
              {contact?.title} · {contact?.company}
            </p>
          </div>
        </div>
        {fieldWorkActiveUntil && (
          <span className="shrink-0 rounded-full bg-orange-50 px-2.5 py-1 text-xs font-medium text-orange-700">
            외근 중 · 30분 후 재알림
          </span>
        )}
      </div>

      <div className="flex-1 space-y-2 overflow-y-auto px-6 py-5">
        {displayEmails.map((email) => (
          <EmailMessage
            key={email.id}
            email={email}
            senderName={contact?.name ?? "상대방"}
            senderRole={contact?.role}
            expanded={expandedId === email.id}
            onToggle={() => setExpandedId((current) => (current === email.id ? null : email.id))}
            highlighted={email.id === highlightedMessageId}
          />
        ))}
      </div>

      {composeState === "minimized" ? (
        <button
          type="button"
          onClick={() => setComposeState("normal")}
          className="flex items-center justify-between gap-2 border-t border-border bg-surface px-4 py-2.5 text-left hover:bg-black/[.02]"
        >
          <span className="truncate text-sm font-medium text-foreground/70">회신: {subject}</span>
          <Maximize2 className="size-4 shrink-0 text-foreground/40" />
        </button>
      ) : isMaximized ? (
        <>
          <div className="fixed inset-0 z-20 bg-black/20" onClick={() => setComposeState("normal")} aria-hidden="true" />
          <div className="fixed inset-4 z-30 flex flex-col rounded-xl border border-border bg-surface shadow-2xl md:inset-x-1/4 md:inset-y-10">
            {composeBody}
          </div>
        </>
      ) : (
        <div className="flex flex-col border-t border-border bg-surface">
          <ResizeHandle
            axis="y"
            onMouseDown={onComposeResizeStart}
            onDoubleClick={onComposeResizeReset}
            className="border-b border-border"
          />
          <div style={{ height: composeHeight }} className="flex flex-col overflow-hidden">
            {composeBody}
          </div>
        </div>
      )}
    </div>
  );
}
