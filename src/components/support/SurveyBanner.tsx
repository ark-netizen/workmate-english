import { useState } from "react";
import { useWorkday } from "@/context/useWorkday";
import { SurveyModal } from "./SurveyModal";

const SNOOZE_KEY = "go_survey_snooze_until";
const SNOOZE_DAYS = 14; // "나중에" 누르면 2~3주 뒤 다시 노출 — 2주로 고정

function isSnoozed(): boolean {
  const until = Number(window.localStorage.getItem(SNOOZE_KEY) || 0);
  return Date.now() < until;
}

export function SurveyBanner() {
  const { survey, refresh } = useWorkday();
  const [dismissed, setDismissed] = useState(false);
  const [open, setOpen] = useState(false);

  // 배너는 실계정 + 오늘이 첫 방문이 아닐 때만, 아직 배너로 응답한 적 없을 때만 노출
  if (
    !survey ||
    dismissed ||
    survey.alreadyRespondedViaBanner ||
    !survey.isRealAccount ||
    survey.isFirstVisit ||
    isSnoozed()
  ) {
    return null;
  }

  const handleSnooze = () => {
    window.localStorage.setItem(SNOOZE_KEY, String(Date.now() + SNOOZE_DAYS * 24 * 60 * 60 * 1000));
    setDismissed(true);
  };

  return (
    <>
      <div className="fixed inset-x-0 bottom-0 z-30 border-t border-border bg-surface px-4 py-3 shadow-[0_-2px_8px_rgba(0,0,0,0.04)] md:bottom-4 md:left-1/2 md:right-auto md:w-[420px] md:-translate-x-1/2 md:rounded-xl md:border">
        <div className="flex items-center justify-between gap-3">
          <div className="min-w-0">
            <p className="truncate text-sm font-medium text-foreground">{survey.title}</p>
            {survey.description && <p className="truncate text-xs text-foreground/50">{survey.description}</p>}
          </div>
          <div className="flex shrink-0 items-center gap-2">
            <button
              type="button"
              onClick={handleSnooze}
              className="rounded-md px-2 py-1.5 text-xs text-foreground/40 hover:bg-black/[.03]"
            >
              나중에
            </button>
            <button
              type="button"
              onClick={() => setOpen(true)}
              className="rounded-full bg-accent px-4 py-1.5 text-xs font-medium text-white hover:opacity-90"
            >
              참여하기
            </button>
          </div>
        </div>
      </div>

      {open && (
        <SurveyModal
          survey={survey}
          source="banner"
          onClose={() => setOpen(false)}
          onSubmitted={async () => {
            setOpen(false);
            await refresh();
          }}
        />
      )}
    </>
  );
}
