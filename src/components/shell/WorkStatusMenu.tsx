import { useEffect, useRef, useState } from "react";
import { ChevronDown } from "lucide-react";
import { useWorkday } from "@/context/useWorkday";
import { PresenceDot } from "@/components/ui/PresenceDot";
import { StatusBadge } from "@/components/ui/StatusBadge";
import { ConfirmDialog } from "@/components/ui/ConfirmDialog";
import { workStatusLabel, workStatusPresence, workStatusTone } from "@/lib/work-status";
import type { WorkStatus } from "@/types/domain";

export function WorkStatusMenu({ workStatus }: { workStatus: WorkStatus }) {
  const { takeLeave, finishWorkday, leaveBalance } = useWorkday();
  const [open, setOpen] = useState(false);
  const [busy, setBusy] = useState(false);
  const [confirmFinish, setConfirmFinish] = useState(false);
  const [pendingLeave, setPendingLeave] = useState(false);
  const [leaveError, setLeaveError] = useState<string | null>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const hasLeave = (leaveBalance?.total ?? 0) > 0;

  useEffect(() => {
    if (!open) return;
    function handleClickOutside(e: MouseEvent) {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        setOpen(false);
      }
    }
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, [open]);

  const isOffWork = workStatus === "off-work";
  const isLeave = workStatus === "leave";
  const isWorking = workStatus === "working";

  const handleReturnToWork = async () => {
    setOpen(false);
    setBusy(true);
    try {
      await takeLeave("cancel");
    } finally {
      setBusy(false);
    }
  };

  const handleLeave = async () => {
    setPendingLeave(false);
    setBusy(true);
    try {
      const result = await takeLeave("annual");
      if (result.skipped) {
        setLeaveError(
          result.reason === "no-leave-balance" ? "사용 가능한 연차가 없어요." : "연차를 사용할 수 없어요.",
        );
      }
    } finally {
      setBusy(false);
    }
  };

  const handleFinish = async () => {
    setConfirmFinish(false);
    setBusy(true);
    try {
      await finishWorkday();
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="relative shrink-0" ref={containerRef}>
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        disabled={busy}
        className="flex items-center gap-1.5 rounded-full hover:opacity-80 disabled:opacity-60"
      >
        <PresenceDot tone={workStatusPresence[workStatus]} />
        <StatusBadge tone={workStatusTone[workStatus]}>{workStatusLabel[workStatus]}</StatusBadge>
        <ChevronDown className="size-3.5 text-foreground/40" strokeWidth={2} />
      </button>

      {open && (
        <div className="absolute left-0 top-full z-30 mt-2 w-44 overflow-hidden rounded-lg border border-border bg-surface py-1 shadow-lg">
          <button
            type="button"
            onClick={isLeave ? handleReturnToWork : () => setOpen(false)}
            disabled={isWorking || isOffWork}
            className="flex w-full items-center justify-between px-3 py-2 text-left text-sm text-foreground/80 hover:bg-black/[.03] disabled:cursor-default disabled:text-foreground/40 disabled:hover:bg-transparent"
          >
            근무 중
            {isWorking && <span className="text-xs text-accent">현재</span>}
          </button>
          <button
            type="button"
            onClick={() => {
              setOpen(false);
              setPendingLeave(true);
            }}
            disabled={isOffWork || isLeave || !hasLeave}
            className="flex w-full items-center justify-between px-3 py-2 text-left text-sm text-foreground/80 hover:bg-black/[.03] disabled:cursor-default disabled:text-foreground/40 disabled:hover:bg-transparent"
          >
            연차 사용
            <span className="text-xs text-foreground/40">{leaveBalance?.total ?? 0}개</span>
          </button>
          <button
            type="button"
            onClick={() => {
              setOpen(false);
              setConfirmFinish(true);
            }}
            disabled={isOffWork}
            className="flex w-full items-center px-3 py-2 text-left text-sm text-foreground/80 hover:bg-black/[.03] disabled:cursor-default disabled:text-foreground/40 disabled:hover:bg-transparent"
          >
            퇴근 하기
          </button>
        </div>
      )}

      <ConfirmDialog
        open={confirmFinish}
        title="퇴근하시겠어요?"
        description="퇴근하면 오늘 남은 연락은 처리할 수 없고, 지금까지의 답변을 기준으로 업무일지가 생성됩니다."
        confirmLabel="퇴근하기"
        onConfirm={handleFinish}
        onCancel={() => setConfirmFinish(false)}
      />

      <ConfirmDialog
        open={pendingLeave}
        title="연차를 사용하시겠어요?"
        description="아직 도착하지 않은 오늘 남은 연락은 건너뛰고, 이미 답변한 대화는 그대로 남습니다."
        confirmLabel="연차 사용"
        onConfirm={handleLeave}
        onCancel={() => setPendingLeave(false)}
      />

      {leaveError && (
        <div className="fixed inset-x-0 bottom-4 z-50 flex justify-center px-4">
          <div className="flex items-center gap-3 rounded-lg border border-border bg-surface px-4 py-2.5 text-sm text-foreground/80 shadow-lg">
            {leaveError}
            <button type="button" onClick={() => setLeaveError(null)} className="text-xs text-foreground/40 hover:text-foreground/60">
              닫기
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
