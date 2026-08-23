// 백엔드가 GitHub Pages(이 서비스워커의 origin)가 아니라 Supabase Edge Function이라, 상대경로("/api/...")로
// fetch하면 안 되고 이 주소로 절대경로를 만들어 호출해야 한다.
const API_BASE_URL = "https://zchagwujhqjfteehexmp.functions.supabase.co";

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

// 듀얼 모니터 시연 녹화용으로 따로 띄운 QA 도구 창(/qa)은 같은 origin의 클라이언트라서
// matchAll에 같이 잡히는데, 여기로 알림을 열면 녹화 화면(메인 창)이 아니라 QA 창에
// 대화가 떠버린다 — 알림 이동 대상에서는 항상 제외한다
function isQaPopup(clientUrl) {
  try {
    return new URL(clientUrl).pathname === "/qa";
  } catch {
    return false;
  }
}

function focusOrOpen(url) {
  return self.clients.matchAll({ type: "window", includeUncontrolled: true }).then((clientList) => {
    for (const client of clientList) {
      if (client.url.startsWith(self.location.origin) && !isQaPopup(client.url) && "focus" in client) {
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
      if (!subscription) return Promise.reject(new Error("구독 정보 없음"));
      return fetch(`${API_BASE_URL}/api/push`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ endpoint: subscription.endpoint, action: "field-work" }),
      });
    })
    .then((response) => {
      if (!response.ok) throw new Error(`외근 처리 실패: ${response.status}`);
      return self.registration.showNotification("외근 처리됐습니다", {
        body: "30분 후 다시 알려드릴게요.",
        icon: "/brand/logo-mark.png",
        tag: "field-work-ack",
      });
    })
    .catch(() =>
      self.registration.showNotification("외근 처리 실패", {
        body: "네트워크 문제로 처리가 안 됐어요. 앱에서 다시 시도해주세요.",
        icon: "/brand/logo-mark.png",
        tag: "field-work-ack",
      }),
    );
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
