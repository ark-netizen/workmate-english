import { useState } from "react";
import { Link } from "react-router-dom";
import { useWorkday } from "@/context/useWorkday";
import { Avatar } from "@/components/ui/Avatar";
import { formatDateTime } from "@/lib/format";

const channelStyle = {
  messenger: { label: "Messenger", className: "bg-accent/10 text-accent" },
  email: { label: "Email", className: "bg-slate-500/10 text-slate-600" },
} as const;

type Filter = "all" | "unread";

export function NotificationsPage() {
  const { conversations, emailThreads, getContactById } = useWorkday();
  const [filter, setFilter] = useState<Filter>("all");

  const items = [
    ...conversations.map((conversation) => {
      const contact = getContactById(conversation.contactId);
      const lastMessage = conversation.messages[conversation.messages.length - 1];
      return {
        id: conversation.id,
        to: `/messenger/${conversation.id}`,
        channel: "messenger" as const,
        name: contact?.name,
        preview: lastMessage?.body ?? "",
        createdAt: conversation.updatedAt,
        read: conversation.unreadCount === 0,
      };
    }),
    ...emailThreads.map((thread) => {
      const contact = getContactById(thread.contactId);
      return {
        id: thread.id,
        to: `/email/${thread.id}`,
        channel: "email" as const,
        name: contact?.name,
        preview: thread.subject,
        createdAt: thread.updatedAt,
        read: thread.unreadCount === 0,
      };
    }),
  ].sort((a, b) => (a.createdAt < b.createdAt ? 1 : -1));

  const unreadCount = items.filter((item) => !item.read).length;
  const visibleItems = filter === "unread" ? items.filter((item) => !item.read) : items;

  return (
    <div className="mx-auto max-w-[1600px] space-y-4 px-4 py-6 md:px-8 md:py-8">
      <div>
        <h1 className="text-lg font-semibold">알림센터</h1>
        <p className="mt-1 text-sm text-foreground/60">
          {unreadCount > 0 ? `읽지 않은 알림 ${unreadCount}건` : "모든 알림을 확인했습니다."}
        </p>
      </div>

      <div className="flex gap-1.5">
        {(["all", "unread"] as const).map((key) => (
          <button
            key={key}
            type="button"
            onClick={() => setFilter(key)}
            className={`rounded-full border px-3 py-1.5 text-xs font-medium ${
              filter === key
                ? "border-accent bg-accent/10 text-accent"
                : "border-border text-foreground/60 hover:bg-black/[.03]"
            }`}
          >
            {key === "all" ? "전체" : `안읽음${unreadCount > 0 ? ` ${unreadCount}` : ""}`}
          </button>
        ))}
      </div>

      <div className="space-y-2">
        {visibleItems.length === 0 && (
          <p className="rounded-lg border border-dashed border-border px-4 py-6 text-center text-sm text-foreground/40">
            {filter === "unread" ? "읽지 않은 알림이 없습니다." : "아직 도착한 연락이 없습니다."}
          </p>
        )}
        {visibleItems.map((item) => {
          const channel = channelStyle[item.channel];
          return (
            <Link
              key={item.id}
              to={item.to}
              className="flex items-center gap-3 rounded-lg border border-border bg-surface px-4 py-3 hover:bg-black/[.02]"
            >
              <Avatar name={item.name ?? "?"} />
              <div className="min-w-0 flex-1">
                <div className="flex items-center gap-2">
                  <span
                    className={`inline-flex shrink-0 items-center rounded-full px-2 py-0.5 text-[10px] font-medium ${channel.className}`}
                  >
                    {channel.label}
                  </span>
                  <p
                    className={`truncate text-sm ${
                      item.read ? "font-medium text-foreground/70" : "font-semibold text-foreground"
                    }`}
                  >
                    {item.name}
                  </p>
                </div>
                <p
                  className={`truncate text-sm ${item.read ? "text-foreground/40" : "text-foreground/60"}`}
                >
                  {item.preview}
                </p>
              </div>
              <div className="flex shrink-0 flex-col items-end gap-1">
                <span className="text-xs text-foreground/40">{formatDateTime(item.createdAt)}</span>
                {!item.read && <span className="h-2 w-2 rounded-full bg-accent" aria-hidden="true" />}
              </div>
            </Link>
          );
        })}
      </div>
    </div>
  );
}
