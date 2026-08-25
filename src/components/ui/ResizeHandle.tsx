export function ResizeHandle({
  axis,
  onMouseDown,
  onDoubleClick,
  className = "",
}: {
  axis: "x" | "y";
  onMouseDown: (e: React.MouseEvent) => void;
  onDoubleClick?: () => void;
  className?: string;
}) {
  const isX = axis === "x";
  return (
    <div
      role="separator"
      aria-orientation={isX ? "vertical" : "horizontal"}
      onMouseDown={onMouseDown}
      onDoubleClick={onDoubleClick}
      title="드래그해서 크기 조절 (더블클릭: 원래 크기)"
      className={`group relative shrink-0 ${isX ? "w-3 cursor-col-resize" : "h-3 cursor-row-resize"} ${className}`}
    >
      {isX ? (
        <>
          <div className="absolute inset-y-0 left-1/2 w-px -translate-x-1/2 bg-border transition-colors group-hover:bg-accent/50 group-active:bg-accent" />
          <div className="absolute left-1/2 top-1/2 flex h-8 w-3 -translate-x-1/2 -translate-y-1/2 items-center justify-center rounded-full border border-border bg-surface shadow-sm transition-colors group-hover:border-accent/50">
            <span className="h-4 w-[2px] rounded-full bg-foreground/25 group-hover:bg-accent/70" />
          </div>
        </>
      ) : (
        <>
          <div className="absolute inset-x-0 top-1/2 h-px -translate-y-1/2 bg-border transition-colors group-hover:bg-accent/50 group-active:bg-accent" />
          <div className="absolute left-1/2 top-1/2 flex h-3 w-12 -translate-x-1/2 -translate-y-1/2 items-center justify-center gap-1 rounded-full border border-border bg-surface shadow-sm transition-colors group-hover:border-accent/50">
            <span className="h-[2px] w-3 rounded-full bg-foreground/25 group-hover:bg-accent/70" />
            <span className="h-[2px] w-3 rounded-full bg-foreground/25 group-hover:bg-accent/70" />
          </div>
        </>
      )}
    </div>
  );
}
