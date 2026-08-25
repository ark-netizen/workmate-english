// server/*.js가 Node 스타일 process.env.X로 환경변수를 읽으므로, Deno(Edge Function) 런타임에서도
// 같은 코드를 그대로 재사용할 수 있게 Deno.env → globalThis.process.env로 미러링한다.
// index.ts의 맨 앞에서 import해서, 다른 핸들러 모듈(process.env를 top-level에서 읽는 llm/client.js 등)이
// 평가되기 전에 먼저 채워지도록 한다.
// deno-lint-ignore-file no-explicit-any
declare const Deno: { env: { get(key: string): string | undefined; toObject(): Record<string, string> } };

const g = globalThis as any;
if (!g.process) g.process = { env: {} };

const KEYS = [
  "SUPABASE_URL",
  "VITE_SUPABASE_URL",
  "VAPID_PUBLIC_KEY",
  "VAPID_PRIVATE_KEY",
  "VAPID_SUBJECT",
  "SOLAR_MODEL",
  "SOLAR_API_KEY",
  "CRON_SECRET",
  "KAKAO_REST_API_KEY",
  "KAKAO_CLIENT_SECRET",
  "APP_BASE_URL",
];

for (const key of KEYS) {
  try {
    const value = Deno.env.get(key);
    if (value !== undefined) g.process.env[key] = value;
  } catch {
    // 이 런타임에서 권한이 없는 키는 건너뜀(전체 함수가 죽지 않게)
  }
}

// service_role(legacy, RLS 우회 admin 키) 대신 새 Secret Key 체계를 우선 사용한다.
// Supabase가 Edge Function에 자동 주입하는 SUPABASE_SECRET_KEYS는 { "default": "sb_secret_..." }
// 형태의 JSON — legacy SUPABASE_SERVICE_ROLE_KEY를 disable하기 전까지는 폴백으로 계속 시도한다.
// server/db.js는 그대로 process.env.SUPABASE_SERVICE_ROLE_KEY만 읽으면 되게 여기서 흡수한다.
try {
  const secretKeysRaw = Deno.env.get("SUPABASE_SECRET_KEYS");
  const newKey = secretKeysRaw ? JSON.parse(secretKeysRaw)?.default : undefined;
  const legacy = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
  const resolved = newKey || legacy;
  if (resolved) g.process.env.SUPABASE_SERVICE_ROLE_KEY = resolved;
} catch {
  // 새 키 파싱 실패 시 legacy로라도 폴백
  try {
    const legacy = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
    if (legacy !== undefined) g.process.env.SUPABASE_SERVICE_ROLE_KEY = legacy;
  } catch {
    // 둘 다 권한 없으면 admin() 호출 시점에 자연스럽게 에러
  }
}

export {};
