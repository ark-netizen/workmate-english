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
  // 세로 크기 조절 바는 부모 섹션의 경계선과 겹치면 두 줄처럼 보여 산만해진다.
  // 위치/여백 관련 커스텀 클래스는 유지하되, y축 핸들에 추가된 border 계열만 제거한다.
  const handleClassName = isX
    ? className
    : className
        .split(/\s+/)
        .filter((token) => !["border-b", "border-t", "border-border"].includes(token))
        .join(" ");

  return (
    <div
      role="separator"
      aria-orientation={isX ? "vertical" : "horizontal"}
      onMouseDown={onMouseDown}
      onDoubleClick={onDoubleClick}
      title="드래그해서 크기 조절 (더블클릭: 원래 크기)"
      className={`group relative shrink-0 select-none ${isX ? "w-3 cursor-col-resize" : "h-3 cursor-row-resize"} ${handleClassName}`}
    >
      {isX ? (
        <div className="absolute left-1/2 top-1/2 flex h-9 w-3 -translate-x-1/2 -translate-y-1/2 items-center justify-center rounded-full border border-border/80 bg-surface/95 shadow-sm transition-colors group-hover:border-accent/55 group-hover:bg-surface group-active:border-accent">
          <span className="flex flex-col gap-0.5" aria-hidden="true">
            <span className="h-1 w-[2px] rounded-full bg-foreground/25 group-hover:bg-accent/65" />
            <span className="h-1 w-[2px] rounded-full bg-foreground/25 group-hover:bg-accent/65" />
            <span className="h-1 w-[2px] rounded-full bg-foreground/25 group-hover:bg-accent/65" />
          </span>
        </div>
      ) : (
        <div className="absolute left-1/2 top-1/2 flex h-3 w-14 -translate-x-1/2 -translate-y-1/2 items-center justify-center rounded-full border border-border/80 bg-surface/95 shadow-sm transition-colors group-hover:border-accent/55 group-hover:bg-surface group-active:border-accent">
          <span className="flex gap-1" aria-hidden="true">
            <span className="h-[2px] w-2 rounded-full bg-foreground/25 group-hover:bg-accent/65" />
            <span className="h-[2px] w-2 rounded-full bg-foreground/25 group-hover:bg-accent/65" />
            <span className="h-[2px] w-2 rounded-full bg-foreground/25 group-hover:bg-accent/65" />
          </span>
        </div>
      )}
    </div>
  );
}
