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
      className={`group shrink-0 ${isX ? "w-1.5 cursor-col-resize" : "h-1.5 cursor-row-resize"} ${className}`}
    >
      <div className="h-full w-full transition-colors group-hover:bg-accent/30 group-active:bg-accent/50" />
    </div>
  );
}
