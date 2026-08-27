// Web Push 발송 (서버 전용). 브라우저 종료 상태에서도 도착하는 핵심.
// 필요 env: VAPID_PUBLIC_KEY / VAPID_PRIVATE_KEY / VAPID_SUBJECT(mailto:)
import webpush from 'web-push'
import { admin, unwrap } from './db.js'

let _configured = false
function configure() {
  if (_configured) return
  const { VAPID_PUBLIC_KEY, VAPID_PRIVATE_KEY, VAPID_SUBJECT } = process.env
  if (!VAPID_PUBLIC_KEY || !VAPID_PRIVATE_KEY) throw new Error('VAPID 키 누락')
  webpush.setVapidDetails(VAPID_SUBJECT || 'mailto:admin@example.com', VAPID_PUBLIC_KEY, VAPID_PRIVATE_KEY)
  _configured = true
}

// 푸시 알림의 액션 버튼(외근중 등)은 앱이 안 열려있는 상태에서 Service Worker가 직접 호출하므로
// 로그인 토큰이 없다 — 구독 endpoint 자체를 식별자로 써서 사용자를 역추적한다
export async function getUserIdByEndpoint(endpoint) {
  const sb = admin()
  // push_tokens의 유니크 제약은 (user_id, endpoint)라서 endpoint 하나에 행이 여러 개 있을 수 있다 —
  // 같은 브라우저로 여러 계정(체험/실계정/시연용)에 로그인하면 그때마다 같은 endpoint로 행이 쌓인다.
  // 예전에는 여기서 maybeSingle()을 써서, 그런 브라우저의 알림 액션 버튼(외근중 등)이 항상 500으로
  // 실패했다. endpoint는 "브라우저 하나"를 뜻하므로 가장 최근에 구독한 계정을 그 브라우저의 주인으로 본다.
  const rows = unwrap(
    await sb
      .from('push_tokens')
      .select('user_id')
      .eq('endpoint', endpoint)
      .order('created_at', { ascending: false })
      .limit(1),
  )
  return rows?.[0]?.user_id || null
}

// 구독 해제 — 사용자가 "알림 완전히 끄기"를 눌렀을 때. 브라우저 권한 차단과 달리
// 서버 push_tokens에서 실제로 지워서, 나중에 다시 subscribe()해도 이전 endpoint가 남아있지 않게 한다
export async function deleteSubscription(userId, endpoint) {
  const sb = admin()
  unwrap(await sb.from('push_tokens').delete().eq('user_id', userId).eq('endpoint', endpoint))
}

// 구독 저장 (push_tokens) — 프론트 SW 구독 결과를 받아 저장
export async function saveSubscription(userId, subscription, userAgent) {
  const sb = admin()
  unwrap(
    await sb.from('push_tokens').upsert(
      {
        user_id: userId,
        endpoint: subscription.endpoint,
        p256dh: subscription.keys.p256dh,
        auth: subscription.keys.auth,
        user_agent: userAgent || null,
      },
      { onConflict: 'user_id,endpoint' },
    ),
  )
  // 같은 브라우저(endpoint)가 다른 계정으로 다시 구독하면 이전 계정의 행은 죽은 매핑이다. 남겨두면
  // 알림 액션 버튼이 어느 계정 것인지 모호해지므로, 이 endpoint의 다른 계정 행은 정리한다.
  unwrap(await sb.from('push_tokens').delete().eq('endpoint', subscription.endpoint).neq('user_id', userId))
}

// 사용자의 모든 기기로 발송. payload = { title, body, url }
export async function sendPushToUser(userId, payload) {
  configure()
  const sb = admin()
  const tokens = unwrap(await sb.from('push_tokens').select('*').eq('user_id', userId)) || []
  const body = JSON.stringify(payload)

  const results = await Promise.allSettled(
    tokens.map((t) =>
      webpush.sendNotification(
        { endpoint: t.endpoint, keys: { p256dh: t.p256dh, auth: t.auth } },
        body,
      ),
    ),
  )

  // 만료된 구독(404/410) 정리
  await Promise.all(
    results.map(async (r, i) => {
      if (r.status === 'rejected' && [404, 410].includes(r.reason?.statusCode)) {
        await sb.from('push_tokens').delete().eq('id', tokens[i].id)
      }
    }),
  )

  return { sent: results.filter((r) => r.status === 'fulfilled').length, total: tokens.length }
}
