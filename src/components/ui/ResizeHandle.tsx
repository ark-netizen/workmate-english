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

  // 핸들 자체가 별도 폭/높이를 차지하면 두 패널 사이에 빈 띠가 생기고,
  // 소비자에서 준 border와 내부 그립 중심이 서로 어긋나 보인다.
  // 실제 클릭 영역은 absolute로 넉넉하게 유지하고, 레이아웃상 x축 핸들은 0폭으로 겹쳐 둔다.
  const blockedBorderTokens = isX
    ? ["border-l", "border-r", "border-border"]
    : ["border-b", "border-t", "border-border"];
  const handleClassName = className
    .split(/\s+/)
    .filter((token) => !blockedBorderTokens.includes(token))
    .join(" ");

  return (
    <div
      role="separator"
      aria-orientation={isX ? "vertical" : "horizontal"}
      onMouseDown={onMouseDown}
      onDoubleClick={onDoubleClick}
      title="드래그해서 크기 조절 (더블클릭: 원래 크기)"
      className={`group relative shrink-0 select-none ${isX ? "w-0 cursor-col-resize" : "h-3 cursor-row-resize"} ${handleClassName}`}
    >
      {isX ? (
        <>
          {/* 레이아웃 폭은 0으로 두되 12px 히트영역을 확보해서 드래그는 쉽게 유지 */}
          <div className="absolute inset-y-0 left-1/2 z-10 w-3 -translate-x-1/2" aria-hidden="true" />
          {/* 패널 경계는 한 줄만 표시 — 제목바까지 빈 띠가 생기지 않음 */}
          <div className="pointer-events-none absolute inset-y-0 left-1/2 z-10 w-px -translate-x-1/2 bg-border/80 transition-colors group-hover:bg-accent/45 group-active:bg-accent" />
          <div className="pointer-events-none absolute left-1/2 top-1/2 z-20 flex h-9 w-3 -translate-x-1/2 -translate-y-1/2 items-center justify-center rounded-full border border-border/80 bg-surface/95 shadow-sm transition-colors group-hover:border-accent/55 group-hover:bg-surface group-active:border-accent">
            <span className="flex flex-col gap-0.5" aria-hidden="true">
              <span className="h-1 w-[2px] rounded-full bg-foreground/25 group-hover:bg-accent/65" />
              <span className="h-1 w-[2px] rounded-full bg-foreground/25 group-hover:bg-accent/65" />
              <span className="h-1 w-[2px] rounded-full bg-foreground/25 group-hover:bg-accent/65" />
            </span>
          </div>
        </>
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
