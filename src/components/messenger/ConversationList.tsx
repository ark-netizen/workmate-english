import { useState } from "react";
import { Link, useLocation } from "react-router-dom";
import { GripVertical } from "lucide-react";
import { useWorkday } from "@/context/useWorkday";
import { formatDateTime } from "@/lib/format";
import { Avatar } from "@/components/ui/Avatar";
import { ResizeHandle } from "@/components/ui/ResizeHandle";
import { useResizable } from "@/hooks/useResizable";
import { applyCustomOrder, reorder } from "@/lib/listOrder";
import type { Conversation } from "@/types/domain";

const LIST_KEY = "messenger";

type Row =
  | { id: string; kind: "conversation"; conversation: Conversation }
  | { id: "vent"; kind: "vent" };

// 고함항아리도 다른 대화처럼 목록에서 드래그로 순서를 옮길 수 있음 —
// 아직 시작 전이면 /messenger/vent(첫 메시지 작성 화면)로, 있으면 실제 대화방으로.
function ShoutJarRow({
  index,
  dragIndex,
  onDragStart,
  onDragOver,
  onDrop,
  onDragEnd,
}: {
  index: number;
  dragIndex: number | null;
  onDragStart: () => void;
  onDragOver: (e: React.DragEvent) => void;
  onDrop: () => void;
  onDragEnd: () => void;
}) {
  const { pathname } = useLocation();
  const { conversations } = useWorkday();

  const ventConversation = conversations.find((c) => c.kind === "vent");
  const to = ventConversation ? `/messenger/${ventConversation.id}` : "/messenger/vent";
  const active = pathname === to;
  const lastMessage = ventConversation?.messages[ventConversation.messages.length - 1];

  return (
    <li
      draggable
      onDragStart={onDragStart}
      onDragOver={onDragOver}
      onDrop={onDrop}
      onDragEnd={onDragEnd}
      className={dragIndex === index ? "opacity-40" : ""}
    >
      <Link
        to={to}
        className={`flex items-start gap-3 border-b border-border px-4 py-3 ${
          active ? "bg-violet-50" : "hover:bg-black/[.02]"
        }`}
      >
        <GripVertical className="size-3.5 shrink-0 self-center cursor-grab text-foreground/25" />
        <span className="flex size-9 shrink-0 items-center justify-center self-center rounded-full bg-violet-100 text-base">
          🫙
        </span>
        <div className="min-w-0 flex-1">
          <div className="flex items-center justify-between gap-2">
            <span className="truncate text-sm font-medium text-violet-900">고함항아리</span>
            {ventConversation && (
              <div className="flex shrink-0 items-center gap-1.5">
                <span className="text-xs text-foreground/40">{formatDateTime(ventConversation.updatedAt)}</span>
                {ventConversation.unreadCount > 0 && (
                  <span className="inline-flex h-4 min-w-4 items-center justify-center rounded-full bg-red-500 px-1 text-[10px] font-semibold text-white">
                    {ventConversation.unreadCount}
                  </span>
                )}
              </div>
            )}
          </div>
          {ventConversation ? (
            <p
              className={`truncate text-sm ${
                ventConversation.unreadCount > 0 ? "font-medium text-foreground" : "text-foreground/70"
              }`}
            >
              {lastMessage?.body}
            </p>
          ) : (
            <p className="truncate text-sm text-foreground/50">스트레스 받을 때 소리질러보세요!</p>
          )}
        </div>
      </Link>
    </li>
  );
}

export function ConversationList() {
  const { pathname } = useLocation();
  const { conversations: conversationsRaw, getContactById } = useWorkday();
  // 이메일 목록과 같은 이유 — 서버 정렬(scheduled_at) 그대로 쓰면 아직 안 온 미래 연락이
  // 이미 답장한 대화보다 위에 뜨는 경우가 있어 자동 선택 항목과 목록 순서가 어긋남
  const conversations = [...conversationsRaw].sort(
    (a, b) => new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime(),
  );
  // 유저가 드래그로 순서를 바꿔둔 게 있으면 우선 적용(로컬 저장) — 홈 화면 "오늘의 연락"은 안 씀.
  // 고함항아리도 같은 목록 안에서 함께 드래그할 수 있게 "vent"라는 고정 id로 합쳐서 정렬한다
  const [orderVersion, setOrderVersion] = useState(0);
  const baseRows: Row[] = [
    ...conversations
      .filter((c) => c.kind !== "vent")
      .map((c): Row => ({ id: c.id, kind: "conversation", conversation: c })),
    { id: "vent", kind: "vent" },
  ];
  const rows = applyCustomOrder(baseRows, LIST_KEY);
  void orderVersion;
  const [dragIndex, setDragIndex] = useState<number | null>(null);
  const { size, onDragStart, onResetToDefault } = useResizable({
    storageKey: "messenger-list-width",
    defaultSize: 320,
    min: 260,
    max: 520,
    axis: "x",
  });

  const handleDrop = (index: number) => {
    if (dragIndex === null || dragIndex === index) return;
    reorder(rows, dragIndex, index, LIST_KEY);
    setDragIndex(null);
    setOrderVersion((v) => v + 1);
  };

  return (
    <div className="flex h-full w-full md:w-auto">
      <div
        className="resizable-pane flex h-full flex-col"
        style={{ "--pane-width": `${size}px` } as React.CSSProperties}
      >
        <div className="flex h-12 shrink-0 items-center border-b border-border bg-[#36454F] px-4">
          <h1 className="text-sm font-semibold text-white">Messenger</h1>
        </div>
        <ul className="flex-1 overflow-y-auto">
          {rows.map((row, index) => {
            if (row.kind === "vent") {
              return (
                <ShoutJarRow
                  key="vent"
                  index={index}
                  dragIndex={dragIndex}
                  onDragStart={() => setDragIndex(index)}
                  onDragOver={(e) => e.preventDefault()}
                  onDrop={() => handleDrop(index)}
                  onDragEnd={() => setDragIndex(null)}
                />
              );
            }

            const conversation = row.conversation;
            const contact = getContactById(conversation.contactId);
            const lastMessage = conversation.messages[conversation.messages.length - 1];
            const active = pathname === `/messenger/${conversation.id}`;

            return (
              <li
                key={conversation.id}
                draggable
                onDragStart={() => setDragIndex(index)}
                onDragOver={(e) => e.preventDefault()}
                onDrop={() => handleDrop(index)}
                onDragEnd={() => setDragIndex(null)}
                className={dragIndex === index ? "opacity-40" : ""}
              >
                <Link
                  to={`/messenger/${conversation.id}`}
                  className={`flex items-start gap-3 border-b border-border px-4 py-3 ${
                    active ? "bg-accent/5" : "hover:bg-black/[.02]"
                  }`}
                >
                  <GripVertical className="size-3.5 shrink-0 self-center cursor-grab text-foreground/25" />
                  <Avatar name={contact?.name ?? "?"} size="md" className="self-center" />
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center justify-between gap-2">
                      <span className="flex min-w-0 items-center gap-1.5">
                        <span className="truncate text-sm font-medium">{contact?.name}</span>
                        {conversation.kind === "review" && (
                          <span className="shrink-0 rounded-full bg-blue-100 px-1.5 py-0.5 text-[10px] font-medium text-blue-700">
                            복습
                          </span>
                        )}
                        {conversation.kind === "checkin" && (
                          <span className="shrink-0 rounded-full bg-foreground/10 px-1.5 py-0.5 text-[10px] font-medium text-foreground/60">
                            추가 연락
                          </span>
                        )}
                      </span>
                      <div className="flex shrink-0 items-center gap-1.5">
                        <span className="text-xs text-foreground/40">
                          {formatDateTime(conversation.updatedAt)}
                        </span>
                        {conversation.unreadCount > 0 && (
                          <span className="inline-flex h-4 min-w-4 items-center justify-center rounded-full bg-red-500 px-1 text-[10px] font-semibold text-white">
                            {conversation.unreadCount}
                          </span>
                        )}
                      </div>
                    </div>
                    <p className="text-xs text-foreground/50">{contact?.title}</p>
                    <p
                      className={`truncate text-sm ${
                        conversation.unreadCount > 0 ? "font-medium text-foreground" : "text-foreground/70"
                      }`}
                    >
                      {lastMessage?.body}
                    </p>
                  </div>
                </Link>
              </li>
            );
          })}
        </ul>
      </div>
      <ResizeHandle
        axis="x"
        onMouseDown={onDragStart}
        onDoubleClick={onResetToDefault}
        className="hidden border-r border-border md:block"
      />
    </div>
  );
}
