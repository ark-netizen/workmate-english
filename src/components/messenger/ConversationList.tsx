import { Link, useLocation } from "react-router-dom";
import { useWorkday } from "@/context/useWorkday";
import { formatDateTime } from "@/lib/format";
import { Avatar } from "@/components/ui/Avatar";
import { ResizeHandle } from "@/components/ui/ResizeHandle";
import { useResizable } from "@/hooks/useResizable";

// 다른 대화처럼 클릭하면 바로 메신저 안(오른쪽 패널)에서 대화가 열림 —
// 아직 시작 전이면 /messenger/vent(첫 메시지 작성 화면)로, 있으면 실제 대화방으로.
function ShoutJarRow() {
  const { pathname } = useLocation();
  const { conversations } = useWorkday();

  const ventConversation = conversations.find((c) => c.kind === "vent");
  const to = ventConversation ? `/messenger/${ventConversation.id}` : "/messenger/vent";
  const active = pathname === to;
  const lastMessage = ventConversation?.messages[ventConversation.messages.length - 1];

  return (
    <li>
      <Link
        to={to}
        className={`flex items-start gap-3 border-b border-border px-4 py-3 ${
          active ? "bg-violet-50" : "hover:bg-black/[.02]"
        }`}
      >
        <span className="flex size-9 shrink-0 items-center justify-center rounded-full bg-violet-100 text-base">
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
  const { conversations, getContactById } = useWorkday();
  const scenarioConversations = conversations.filter((c) => c.kind !== "vent");
  const { size, onDragStart, onResetToDefault } = useResizable({
    storageKey: "messenger-list-width",
    defaultSize: 320,
    min: 260,
    max: 520,
    axis: "x",
  });

  return (
    <div className="flex h-full w-full md:w-auto">
      <div
        className="resizable-pane flex h-full flex-col"
        style={{ "--pane-width": `${size}px` } as React.CSSProperties}
      >
        <div className="flex h-16 shrink-0 items-center border-b border-border bg-[#36454F] px-4">
          <h1 className="text-sm font-semibold text-white">Messenger</h1>
        </div>
        <ul className="flex-1 overflow-y-auto">
          {scenarioConversations.length === 0 && (
            <li className="px-4 py-6 text-center text-sm text-foreground/40">
              아직 대화가 없습니다.
            </li>
          )}
          {scenarioConversations.map((conversation) => {
            const contact = getContactById(conversation.contactId);
            const lastMessage = conversation.messages[conversation.messages.length - 1];
            const active = pathname === `/messenger/${conversation.id}`;

            return (
              <li key={conversation.id}>
                <Link
                  to={`/messenger/${conversation.id}`}
                  className={`flex items-start gap-3 border-b border-border px-4 py-3 ${
                    active ? "bg-accent/5" : "hover:bg-black/[.02]"
                  }`}
                >
                  <Avatar name={contact?.name ?? "?"} size="md" />
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
          <ShoutJarRow />
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
