export function ConfirmDialog({
  open,
  title,
  description,
  confirmLabel = "확인",
  cancelLabel = "취소",
  dismissLabel,
  onConfirm,
  onCancel,
  onDismiss,
}: {
  open: boolean;
  title: string;
  description?: string;
  confirmLabel?: string;
  cancelLabel?: string;
  // 선택: cancel/confirm 둘 다 어떤 동작을 실행하는 다이얼로그에서, "아무것도 하지 않고 닫기"가 필요할 때만 사용
  dismissLabel?: string;
  onConfirm: () => void;
  onCancel: () => void;
  onDismiss?: () => void;
}) {
  if (!open) return null;

  return (
    <div className="fixed inset-0 z-40 flex items-center justify-center bg-black/30 px-4">
      <div className="w-full max-w-sm rounded-xl border border-border bg-surface p-5 shadow-xl">
        <h2 className="text-sm font-semibold">{title}</h2>
        {description && <p className="mt-2 text-sm text-foreground/60">{description}</p>}
        <div className="mt-5 flex items-center justify-end gap-2">
          {onDismiss && (
            <button
              type="button"
              onClick={onDismiss}
              className="mr-auto text-sm text-foreground/40 hover:text-foreground/60"
            >
              {dismissLabel ?? "취소"}
            </button>
          )}
          <button
            type="button"
            onClick={onCancel}
            className="rounded-md border border-border px-3 py-1.5 text-sm text-foreground/70 hover:bg-black/[.03]"
          >
            {cancelLabel}
          </button>
          <button
            type="button"
            onClick={onConfirm}
            className="rounded-md bg-accent px-3 py-1.5 text-sm font-medium text-white hover:opacity-90"
          >
            {confirmLabel}
          </button>
        </div>
      </div>
    </div>
  );
}
