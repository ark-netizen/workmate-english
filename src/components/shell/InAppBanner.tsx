import { useEffect } from "react";
import { Link } from "react-router-dom";
import { useWorkday } from "@/context/useWorkday";

export function InAppBanner() {
  const { banner, dismissBanner } = useWorkday();

  useEffect(() => {
    if (!banner) return;
    const timer = setTimeout(dismissBanner, 8000);
    return () => clearTimeout(timer);
  }, [banner, dismissBanner]);

  if (!banner) return null;

  return (
    <div className="fixed bottom-20 right-4 z-30 w-80 max-w-[calc(100vw-2rem)] md:bottom-4">
      <Link
        to={banner.to}
        onClick={dismissBanner}
        className="flex items-start gap-3 rounded-lg border border-border bg-surface p-4 shadow-lg hover:border-accent/40"
      >
        <div className="min-w-0 flex-1">
          <p className="text-sm font-medium">{banner.title}</p>
          <p className="mt-0.5 truncate text-xs text-foreground/60">{banner.body}</p>
        </div>
        <button
          type="button"
          onClick={(e) => {
            e.preventDefault();
            e.stopPropagation();
            dismissBanner();
          }}
          aria-label="닫기"
          className="shrink-0 text-foreground/40 hover:text-foreground/70"
        >
          ✕
        </button>
      </Link>
    </div>
  );
}
