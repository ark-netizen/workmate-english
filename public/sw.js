self.addEventListener("install", () => {
  self.skipWaiting();
});

self.addEventListener("activate", (event) => {
  event.waitUntil(self.clients.claim());
});

self.addEventListener("push", (event) => {
  if (!event.data) return;

  let payload = {};
  try {
    payload = event.data.json();
  } catch {
    payload = { title: "부캐영어", body: event.data.text() };
  }

  const title = payload.title || "부캐영어";
  const options = {
    body: payload.body,
    icon: "/brand/logo-mark.png",
    data: { url: payload.url || "/" },
    actions: [
      { action: "reply", title: "메시지 작성하기" },
      { action: "field-work", title: "외근 중 (30분 후 재알림)" },
    ],
  };

  event.waitUntil(self.registration.showNotification(title, options));
});

function focusOrOpen(url) {
  return self.clients.matchAll({ type: "window", includeUncontrolled: true }).then((clientList) => {
    for (const client of clientList) {
      if (client.url.startsWith(self.location.origin) && "focus" in client) {
        return client.navigate(url).then((focused) => focused && focused.focus());
      }
    }
    if (self.clients.openWindow) {
      return self.clients.openWindow(url);
    }
  });
}

// 앱을 열지 않고도 "외근중"을 처리 — 로그인 세션이 없으므로 이 기기의 구독 endpoint로 사용자를 식별
function handleFieldWorkAction() {
  return self.registration.pushManager
    .getSubscription()
    .then((subscription) => {
      if (!subscription) return;
      return fetch("/api/push", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ endpoint: subscription.endpoint, action: "field-work" }),
      });
    })
    .then(() =>
      self.registration.showNotification("외근 처리됐습니다", {
        body: "30분 후 다시 알려드릴게요.",
        icon: "/brand/logo-mark.png",
        tag: "field-work-ack",
      }),
    )
    .catch(() => {});
}

self.addEventListener("notificationclick", (event) => {
  event.notification.close();
  const targetUrl = event.notification.data?.url || "/";

  if (event.action === "field-work") {
    event.waitUntil(handleFieldWorkAction());
    return;
  }

  event.waitUntil(focusOrOpen(targetUrl));
});
