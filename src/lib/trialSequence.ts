import { useCallback, useEffect, useState } from "react";

export type TrialStep =
  | "home-tour"
  | "colleague"
  | "colleague-review"
  | "manager-hint"
  | "manager-reply"
  | "manager-review"
  | "client"
  | "client-review"
  | "fieldwork-push"
  | "comfort"
  | "checkout"
  | "report"
  | "kakao";

const STORAGE_KEY = "go:trial-sequence-step";
const CHANGE_EVENT = "go:trial-sequence-change";
const INITIAL_STEP: TrialStep = "home-tour";

const VALID_STEPS = new Set<TrialStep>([
  "home-tour",
  "colleague",
  "colleague-review",
  "manager-hint",
  "manager-reply",
  "manager-review",
  "client",
  "client-review",
  "fieldwork-push",
  "comfort",
  "checkout",
  "report",
  "kakao",
]);

export function getTrialStep(): TrialStep {
  if (typeof window === "undefined") return INITIAL_STEP;
  try {
    const stored = sessionStorage.getItem(STORAGE_KEY) as TrialStep | null;
    return stored && VALID_STEPS.has(stored) ? stored : INITIAL_STEP;
  } catch {
    return INITIAL_STEP;
  }
}

export function setTrialStep(step: TrialStep) {
  if (typeof window === "undefined") return;
  try {
    sessionStorage.setItem(STORAGE_KEY, step);
  } catch {
    // sessionStorage를 쓸 수 없어도 현재 탭의 이벤트로는 상태를 이어간다.
  }
  window.dispatchEvent(new CustomEvent<TrialStep>(CHANGE_EVENT, { detail: step }));
}

export function resetTrialSequence() {
  setTrialStep(INITIAL_STEP);
}

export function useTrialSequence() {
  const [step, setStepState] = useState<TrialStep>(() => getTrialStep());

  useEffect(() => {
    const onChange = (event: Event) => {
      const next = (event as CustomEvent<TrialStep>).detail;
      if (next && VALID_STEPS.has(next)) setStepState(next);
    };
    window.addEventListener(CHANGE_EVENT, onChange);
    return () => window.removeEventListener(CHANGE_EVENT, onChange);
  }, []);

  const setStep = useCallback((next: TrialStep) => {
    setStepState(next);
    setTrialStep(next);
  }, []);

  return { step, setStep };
}
