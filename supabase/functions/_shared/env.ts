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
  "SUPABASE_SERVICE_ROLE_KEY",
  "VAPID_PUBLIC_KEY",
  "VAPID_PRIVATE_KEY",
  "VAPID_SUBJECT",
  "SOLAR_MODEL",
  "SOLAR_API_KEY",
  "CRON_SECRET",
];

for (const key of KEYS) {
  try {
    const value = Deno.env.get(key);
    if (value !== undefined) g.process.env[key] = value;
  } catch {
    // 이 런타임에서 권한이 없는 키는 건너뜀(전체 함수가 죽지 않게)
  }
}

export {};
