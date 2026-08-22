import { useState } from "react";
import { SquarePen } from "lucide-react";
import { useWorkday } from "@/context/useWorkday";
import { Avatar } from "@/components/ui/Avatar";
import { VoiceInputButton } from "@/components/reply/VoiceInputButton";
import { SpellFixButton } from "@/components/reply/SpellFixButton";
import type { Contact } from "@/types/domain";

const ROLE_LABELS: Record<Contact["role"], string> = {
  colleague: "동료",
  manager: "상사",
  client: "거래처",
  hr: "인사팀",
};

interface SentPreview {
  contact: Contact;
  subject: string;
  body: string;
}

// 상대를 지정해 새 이메일 스레드를 만드는 백엔드 API가 아직 없어(고함항아리의 sendVent와
// 달리 이메일 채널·임의 상대를 지원하는 경로가 서버에 없음), 실제 발송 없이 화면에서만
// "보낸 것처럼" 보여주는 임시 구현. 백엔드 API가 생기면 handleSend를 실제 호출로 교체.
export function ComposeEmailPage() {
  const { contacts } = useWorkday();
  // 채팅방/메일함이 최근 7일치를 함께 보여주면서, 같은 사람이 날짜별로 다른 대화방 id를 가져
  // 여러 번 나타날 수 있어 이름·역할 기준으로 한 번씩만 보여줌
  const uniqueContacts = Array.from(new Map(contacts.map((c) => [`${c.role}:${c.name}`, c])).values());
  const [contactId, setContactId] = useState<string | null>(null);
  const [subject, setSubject] = useState("");
  const [body, setBody] = useState("");
  const [sent, setSent] = useState<SentPreview | null>(null);

  const selectedContact = contacts.find((c) => c.id === contactId) ?? null;
  const canSend = Boolean(selectedContact && subject.trim() && body.trim());

  const handleSend = () => {
    if (!canSend || !selectedContact) return;
    setSent({ contact: selectedContact, subject: subject.trim(), body: body.trim() });
  };

  const handleReset = () => {
    setSent(null);
    setContactId(null);
    setSubject("");
    setBody("");
  };

  if (sent) {
    return (
      <div className="mx-auto flex h-full max-w-lg flex-col items-center justify-center gap-4 px-4 py-10 text-center">
        <div className="flex h-12 w-12 items-center justify-center rounded-full bg-accent/10 text-2xl">✉️</div>
        <div>
          <h1 className="text-base font-semibold">{sent.contact.name}님에게 보냈어요</h1>
          <p className="mt-1 text-sm text-foreground/60">
            아직 실제 발송 서버가 연결되지 않아 미리보기로만 표시돼요.
          </p>
        </div>
        <div className="w-full space-y-1 rounded-xl border border-border bg-surface p-4 text-left">
          <p className="text-sm font-medium">{sent.subject}</p>
          <p className="whitespace-pre-wrap text-xs text-foreground/50">{sent.body}</p>
        </div>
        <button
          type="button"
          onClick={handleReset}
          className="rounded-md border border-border px-3 py-1.5 text-sm text-foreground/70 hover:bg-black/[.03]"
        >
          새 메일 쓰기
        </button>
      </div>
    );
  }

  return (
    <div className="mx-auto flex h-full max-w-lg flex-col gap-5 overflow-y-auto px-4 py-6">
      <div className="flex items-center gap-2">
        <SquarePen className="size-4 text-foreground/50" strokeWidth={2} />
        <h1 className="text-sm font-semibold">새 메일 쓰기</h1>
      </div>

      {uniqueContacts.length === 0 ? (
        <p className="text-sm text-foreground/50">오늘 메일을 보낼 수 있는 상대가 아직 없어요.</p>
      ) : (
        <div className="space-y-2">
          <p className="text-sm font-medium">받는 사람</p>
          <div className="flex flex-wrap gap-2">
            {uniqueContacts.map((contact) => (
              <button
                key={contact.id}
                type="button"
                onClick={() => setContactId(contact.id)}
                className={`flex items-center gap-2 rounded-full border px-3 py-1.5 text-sm ${
                  contactId === contact.id
                    ? "border-accent bg-accent/10 text-accent"
                    : "border-border text-foreground/70 hover:bg-black/[.03]"
                }`}
              >
                <Avatar name={contact.name} size="sm" />
                {contact.name}
                <span className="text-xs text-foreground/40">· {ROLE_LABELS[contact.role]}</span>
              </button>
            ))}
          </div>
        </div>
      )}

      <label className="block space-y-1">
        <span className="text-sm font-medium">제목</span>
        <input
          className="w-full rounded-md border border-border bg-transparent px-3 py-2 text-sm outline-none"
          placeholder="메일 제목을 입력하세요"
          value={subject}
          onChange={(e) => setSubject(e.target.value)}
        />
      </label>

      <label className="flex flex-1 flex-col space-y-1">
        <span className="text-sm font-medium">내용</span>
        <div className="flex items-end gap-2">
          <textarea
            className="h-40 w-full flex-1 resize-none rounded-md border border-border bg-transparent px-3 py-2 text-sm outline-none"
            placeholder="영어로 자유롭게 써보세요"
            value={body}
            onChange={(e) => setBody(e.target.value)}
          />
          <VoiceInputButton
            onTranscript={(spoken) => setBody((prev) => (prev.trim() ? `${prev.trim()} ${spoken}` : spoken))}
          />
        </div>
      </label>

      <div className="flex items-center justify-between gap-2">
        <SpellFixButton text={body} onFixed={setBody} />
        <button
          type="button"
          onClick={handleSend}
          disabled={!canSend}
          className="flex-1 rounded-md bg-accent px-4 py-2 text-sm font-medium text-white hover:opacity-90 disabled:opacity-50"
        >
          보내기
        </button>
      </div>
    </div>
  );
}
