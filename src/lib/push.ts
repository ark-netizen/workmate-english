import { subscribePushOnServer, unsubscribePushOnServer } from "./api";

export type PushSubscribeResult = "unsupported" | "denied" | "subscribed";

function urlBase64ToUint8Array(base64String: string) {
  const padding = "=".repeat((4 - (base64String.length % 4)) % 4);
  const base64 = (base64String + padding).replace(/-/g, "+").replace(/_/g, "/");
  const rawData = window.atob(base64);
  return Uint8Array.from([...rawData].map((char) => char.charCodeAt(0)));
}

export async function subscribePush(): Promise<PushSubscribeResult> {
  if (!("serviceWorker" in navigator) || !("PushManager" in window)) {
    return "unsupported";
  }

  const permission = await Notification.requestPermission();
  if (permission !== "granted") {
    return "denied";
  }

  const vapidKey = import.meta.env.VITE_VAPID_PUBLIC_KEY as string | undefined;
  if (!vapidKey) {
    console.warn("VITE_VAPID_PUBLIC_KEY가 설정되어 있지 않아 푸시 구독을 진행할 수 없습니다.");
    return "unsupported";
  }

  const registration = await navigator.serviceWorker.register("/sw.js");
  const subscription = await registration.pushManager.subscribe({
    userVisibleOnly: true,
    applicationServerKey: urlBase64ToUint8Array(vapidKey),
  });

  await subscribePushOnServer(subscription.toJSON());
  return "subscribed";
}

// 알림 완전히 끄기 — 이 브라우저의 구독을 해제(unsubscribe)하고 서버 push_tokens에서도 지운다.
// 브라우저 알림 "권한"은 그대로 남을 수 있지만(사용자가 직접 재요청 가능), 실제 발송 대상에서는 빠진다.
export async function unsubscribePush(): Promise<void> {
  if (!("serviceWorker" in navigator)) return;
  const registration = await navigator.serviceWorker.getRegistration("/sw.js");
  const subscription = await registration?.pushManager.getSubscription();
  if (!subscription) return;
  const endpoint = subscription.endpoint;
  await subscription.unsubscribe();
  await unsubscribePushOnServer(endpoint);
}
