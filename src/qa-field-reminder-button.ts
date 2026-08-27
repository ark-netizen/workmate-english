import { supabase, supabaseReady } from "./lib/supabaseClient.js";

const BUTTON_ID = "qa-field-work-reminder-now";
const API_BASE_URL = import.meta.env.VITE_API_BASE_URL ?? "";

type QaReminderResult = {
  sent?: boolean;
  reason?: string;
  remaining?: number;
};

function reasonMessage(reason?: string) {
  if (reason === "no-workday") return "오늘 근무 기록이 없어요.";
  if (reason === "workday-closed") return "이미 마감된 근무일이라 재알림을 보낼 수 없어요.";
  if (reason === "no-awaiting-conversation") return "현재 답장을 기다리는 연락이 없어요.";
  if (reason === "no-field-work-reminder") return "예약된 외근 재알림이 없어요. 먼저 연락에서 ‘외근 중’을 눌러주세요.";
  if (reason === "no-push-subscription") return "이 계정의 Web Push 구독이 없어요. 알림을 다시 켜주세요.";
  if (reason === "push-delivery-failed") return "Web Push 전송에 실패했어요. 구독 상태를 확인해주세요.";
  return `재알림을 보내지 못했어요${reason ? ` (${reason})` : ""}.`;
}

async function forceFieldWorkReminder(): Promise<QaReminderResult> {
  if (!supabaseReady || !supabase) throw new Error("Supabase 세션을 사용할 수 없어요.");
  const { data } = await supabase.auth.getSession();
  const token = data.session?.access_token;
  if (!token) throw new Error("로그인 세션이 없어요.");

  const res = await fetch(`${API_BASE_URL}/api/workday/field-work`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${token}`,
    },
    body: JSON.stringify({ qaDeliverReminder: true }),
  });

  if (!res.ok) {
    const body = await res.text().catch(() => "");
    throw new Error(body || `재알림 QA 요청 실패 (${res.status})`);
  }
  return res.json();
}

function findQaPanel(): HTMLElement | null {
  const candidates = document.querySelectorAll<HTMLElement>(".fixed.right-3.top-20.z-40");
  for (const element of candidates) {
    if ((element.textContent ?? "").includes("QA 도구")) return element;
  }
  return null;
}

function installButton() {
  if (document.getElementById(BUTTON_ID)) return;
  const panel = findQaPanel();
  if (!panel) return;

  const existingButtons = Array.from(panel.querySelectorAll<HTMLButtonElement>("button"));
  const deliverButton = existingButtons.find((button) =>
    (button.textContent ?? "").includes("연락 바로 받기"),
  );
  if (!deliverButton) return;

  const button = document.createElement("button");
  button.id = BUTTON_ID;
  button.type = "button";
  // 기존 QA 버튼의 실제 스타일을 그대로 복제해 Tailwind 동적 클래스 누락 위험을 없앤다.
  button.className = deliverButton.className;
  button.title = "실제 30분을 기다리지 않고, 예약된 외근 재알림 중 가장 이른 1건을 즉시 Web Push로 보냅니다";
  button.textContent = "외근 재알림 바로 받기";

  button.addEventListener("click", async () => {
    if (button.disabled) return;
    button.disabled = true;
    button.textContent = "재알림 보내는 중...";
    try {
      const result = await forceFieldWorkReminder();
      if (result.sent) {
        const remaining = result.remaining ?? 0;
        button.textContent = remaining > 0 ? `재알림 발송됨 · ${remaining}건 남음` : "재알림 발송됨";
        window.setTimeout(() => {
          button.textContent = "외근 재알림 바로 받기";
        }, 1600);
      } else {
        button.textContent = "외근 재알림 바로 받기";
        window.alert(reasonMessage(result.reason));
      }
    } catch (error) {
      button.textContent = "외근 재알림 바로 받기";
      window.alert(error instanceof Error ? error.message : "외근 재알림 QA 요청에 실패했어요.");
    } finally {
      button.disabled = false;
    }
  });

  deliverButton.insertAdjacentElement("afterend", button);
}

if (typeof window !== "undefined" && typeof document !== "undefined") {
  const start = () => {
    installButton();
    const root = document.getElementById("root") ?? document.body;
    const observer = new MutationObserver(installButton);
    observer.observe(root, { childList: true, subtree: true });
  };

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", start, { once: true });
  } else {
    start();
  }
}
