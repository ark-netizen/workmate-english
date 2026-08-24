import { useCallback, useEffect, useRef, useState } from "react";

interface UseResizableOptions {
  storageKey: string;
  defaultSize: number;
  min: number;
  max: number;
  axis: "x" | "y";
  /** When true, moving the pointer in the positive direction shrinks the size instead of growing it. */
  reverse?: boolean;
}

function readStoredSize(storageKey: string, defaultSize: number, min: number, max: number): number {
  if (typeof window === "undefined") return defaultSize;
  const stored = Number(window.localStorage.getItem(storageKey));
  if (!Number.isFinite(stored) || stored <= 0) return defaultSize;
  // 저장된 값이 예전(더 넉넉했던) min/max 기준으로 남아있을 수 있어서, 지금 기준으로 다시 clamp —
  // 안 그러면 UI를 더 작게 조정해도 예전에 크게 드래그해둔 값이 그대로 남아 계속 커 보인다
  return Math.min(max, Math.max(min, stored));
}

export function useResizable({ storageKey, defaultSize, min, max, axis, reverse = false }: UseResizableOptions) {
  const [size, setSize] = useState(() => readStoredSize(storageKey, defaultSize, min, max));
  const sizeRef = useRef(size);
  sizeRef.current = size;
  const dragRef = useRef<{ pos: number; size: number } | null>(null);

  const clamp = useCallback((value: number) => Math.min(max, Math.max(min, value)), [min, max]);

  useEffect(() => {
    function handleMove(e: MouseEvent) {
      if (!dragRef.current) return;
      const pos = axis === "x" ? e.clientX : e.clientY;
      const delta = pos - dragRef.current.pos;
      setSize(clamp(dragRef.current.size + (reverse ? -delta : delta)));
    }
    function handleUp() {
      if (!dragRef.current) return;
      dragRef.current = null;
      document.body.style.cursor = "";
      document.body.style.userSelect = "";
      window.localStorage.setItem(storageKey, String(sizeRef.current));
    }
    window.addEventListener("mousemove", handleMove);
    window.addEventListener("mouseup", handleUp);
    return () => {
      window.removeEventListener("mousemove", handleMove);
      window.removeEventListener("mouseup", handleUp);
    };
  }, [axis, clamp, reverse, storageKey]);

  const onDragStart = useCallback(
    (e: React.MouseEvent) => {
      e.preventDefault();
      dragRef.current = { pos: axis === "x" ? e.clientX : e.clientY, size: sizeRef.current };
      document.body.style.cursor = axis === "x" ? "col-resize" : "row-resize";
      document.body.style.userSelect = "none";
    },
    [axis],
  );

  const onResetToDefault = useCallback(() => {
    setSize(defaultSize);
    window.localStorage.setItem(storageKey, String(defaultSize));
  }, [defaultSize, storageKey]);

  return { size, onDragStart, onResetToDefault };
}
