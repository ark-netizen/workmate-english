import { useState } from "react";
import { Link, useLocation } from "react-router-dom";
import { SquarePen, GripVertical } from "lucide-react";
import { useWorkday } from "@/context/useWorkday";
import { Avatar } from "@/components/ui/Avatar";
import { formatDateTime } from "@/lib/format";
import { ResizeHandle } from "@/components/ui/ResizeHandle";
import { useResizable } from "@/hooks/useResizable";
import { applyCustomOrder, reorder } from "@/lib/listOrder";

const LIST_KEY = "email";

export function EmailList() {
  const { pathname } = useLocation();
  const { emailThreads: emailThreadsRaw, getContactById } = useWorkday();
  // 서버는 scheduled_at 기준으로 내려주는데, 이건 아직 안 온 미래 메일이 이미 답장한 메일보다
  // 위에 뜨는 경우를 만들어서 "왜 이게 위에 있지" 헷갈림 + 자동 선택 항목과 리스트 순서가 어긋남을
  // 유발했음. 최근에 실제로 움직인(도착/답장) 순서로 다시 정렬해서 목록 1번=자동 선택 항목이 되게 함
  const defaultSorted = [...emailThreadsRaw].sort(
    (a, b) => new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime(),
  );
  // 유저가 드래그로 순서를 바꿔둔 게 있으면(로컬 저장) 그걸 우선 적용 — 홈 화면 "오늘의 연락"은
  // 이 순서를 안 쓰고 실제 도착 순서를 그대로 보여줌(별개 로직). orderVersion은 드래그 직후
  // localStorage에 막 쓴 값을 바로 반영하기 위한 강제 재계산 트리거일 뿐 값 자체는 안 씀
  const [orderVersion, setOrderVersion] = useState(0);
  const emailThreads = applyCustomOrder(defaultSorted, LIST_KEY);
  void orderVersion;
  const [dragIndex, setDragIndex] = useState<number | null>(null);
  const { size, onDragStart, onResetToDefault } = useResizable({
    storageKey: "email-list-width",
    defaultSize: 384,
    min: 280,
    max: 560,
    axis: "x",
  });

  return (
    <div className="flex h-full w-full md:w-auto">
      <div
        className="resizable-pane flex h-full flex-col"
        style={{ "--pane-width": `${size}px` } as React.CSSProperties}
      >
        <div className="flex h-12 shrink-0 items-center justify-between border-b border-border bg-[#4B5A66] px-4">
          <h1 className="text-sm font-semibold text-white">Email</h1>
          <Link
            to="/email/compose"
            className={`flex items-center gap-1 rounded-full px-2.5 py-1 text-xs font-medium ${
              pathname === "/email/compose"
                ? "bg-white text-[#36454F]"
                : "text-white/80 hover:bg-white/10 hover:text-white"
            }`}
          >
            <SquarePen className="size-3.5" strokeWidth={2} />
            새 메일
          </Link>
        </div>
        <ul className="flex-1 overflow-y-auto">
          {emailThreads.length === 0 && (
            <li className="px-4 py-6 text-center text-sm text-foreground/40">
              아직 메일이 없습니다.
            </li>
          )}
          {emailThreads.map((thread, index) => {
            const contact = getContactById(thread.contactId);
            const lastEmail = thread.emails[thread.emails.length - 1];
            const active = pathname === `/email/${thread.id}`;
            const unread = thread.unreadCount > 0;

            return (
              <li
                key={thread.id}
                draggable
                onDragStart={() => setDragIndex(index)}
                onDragOver={(e) => e.preventDefault()}
                onDrop={() => {
                  if (dragIndex === null || dragIndex === index) return;
                  reorder(emailThreads, dragIndex, index, LIST_KEY);
                  setDragIndex(null);
                  setOrderVersion((v) => v + 1);
                }}
                onDragEnd={() => setDragIndex(null)}
                className={dragIndex === index ? "opacity-40" : ""}
              >
                <Link
                  to={`/email/${thread.id}`}
                  className={`flex items-start gap-3 border-b border-border px-4 py-3 ${
                    active ? "bg-accent/5" : "hover:bg-black/[.02]"
                  }`}
                >
                  <GripVertical className="size-3.5 shrink-0 self-center cursor-grab text-foreground/25" />
                  <Avatar name={contact?.name ?? "?"} className="self-center" />
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center justify-between gap-2">
                      <span
                        className={`truncate text-sm ${
                          unread ? "font-semibold text-foreground" : "font-medium text-foreground/70"
                        }`}
                      >
                        {contact?.name}
                        <span className="ml-1 font-normal text-foreground/40">· {contact?.company}</span>
                        {thread.kind === "review" && (
                          <span className="ml-1.5 rounded-full bg-blue-100 px-1.5 py-0.5 text-[10px] font-medium text-blue-700">
                            복습
                          </span>
                        )}
                        {thread.kind === "checkin" && (
                          <span className="ml-1.5 rounded-full bg-foreground/10 px-1.5 py-0.5 text-[10px] font-medium text-foreground/60">
                            추가 연락
                          </span>
                        )}
                      </span>
                      <span
                        className={`shrink-0 text-xs ${
                          unread ? "font-semibold text-foreground/80" : "text-foreground/40"
                        }`}
                      >
                        {formatDateTime(thread.updatedAt)}
                      </span>
                    </div>
                    <p
                      className={`mt-0.5 truncate text-sm ${
                        unread ? "font-semibold text-foreground" : "text-foreground/60"
                      }`}
                    >
                      {thread.subject}
                    </p>
                    <p className="truncate text-xs text-foreground/40">
                      {lastEmail?.from === "user" ? "나: " : ""}
                      {lastEmail?.body}
                    </p>
                  </div>
                  {unread && (
                    <span className="mt-1.5 h-2 w-2 shrink-0 rounded-full bg-accent" aria-hidden="true" />
                  )}
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
