// Vercel 서버리스 함수는 (req, res) 형태(Node http 스타일)를 쓰는데, Edge Function은 Fetch API
// Request/Response를 쓴다. api/*.js, server/*.js를 한 줄도 안 고치고 그대로 재사용하기 위한 어댑터.
// deno-lint-ignore-file no-explicit-any

export const corsHeaders: Record<string, string> = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "GET, POST, DELETE, OPTIONS",
};

export async function toNodeRequest(req: Request, url: URL) {
  const headers: Record<string, string> = {};
  req.headers.forEach((value, key) => {
    headers[key.toLowerCase()] = value;
  });

  const query: Record<string, string> = {};
  url.searchParams.forEach((value, key) => {
    query[key] = value;
  });

  let body: any = undefined;
  if (req.method !== "GET" && req.method !== "HEAD") {
    const text = await req.text();
    if (text) {
      try {
        body = JSON.parse(text);
      } catch {
        body = {};
      }
    }
  }

  return { method: req.method, headers, query, body };
}

export function makeNodeResponse() {
  const state = { status: 200, body: null as unknown };
  const res = {
    status(code: number) {
      state.status = code;
      return res;
    },
    json(obj: unknown) {
      state.body = obj;
      return res;
    },
  };
  return { res, state };
}

export function toWebResponse(state: { status: number; body: unknown }) {
  return new Response(JSON.stringify(state.body ?? null), {
    status: state.status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}
