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

function readStoredSize(storageKey: string, defaultSize: number): number {
  if (typeof window === "undefined") return defaultSize;
  const stored = Number(window.localStorage.getItem(storageKey));
  return Number.isFinite(stored) && stored > 0 ? stored : defaultSize;
}

export function useResizable({ storageKey, defaultSize, min, max, axis, reverse = false }: UseResizableOptions) {
  const [size, setSize] = useState(() => readStoredSize(storageKey, defaultSize));
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
