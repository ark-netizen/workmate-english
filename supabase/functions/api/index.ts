// Vercel 서버리스 함수(api/*.js) 전부를 하나의 Supabase Edge Function으로 라우팅한다.
// 프론트는 여전히 `${VITE_API_BASE_URL}/api/워크데이/today` 같은 경로로 호출하고,
// 여기서 "/api" 접두어를 떼고 남은 경로로 기존 핸들러 파일에 그대로 넘긴다.
// deno-lint-ignore-file no-explicit-any
import "../_shared/env.ts";
import { corsHeaders, toNodeRequest, makeNodeResponse, toWebResponse } from "../_shared/compat.ts";

import replyHandler from "../../../api/reply.js";
import consentHandler from "../../../api/consent.js";
import pushHandler from "../../../api/push.js";
import profileHandler from "../../../api/profile.js";
import todayHandler from "../../../api/workday/today.js";
import fieldWorkHandler from "../../../api/workday/field-work.js";
import leaveHandler from "../../../api/workday/leave.js";
import closeHandler from "../../../api/workday/close.js";
import deliverNextHandler from "../../../api/workday/deliver-next.js";
import periodHandler from "../../../api/workday/report/period.js";
import adminDashboardHandler from "../../../api/admin/dashboard.js";
import cronDispatchHandler from "../../../api/cron/dispatch.js";

const routes: Record<string, (req: any, res: any) => Promise<void>> = {
  "/reply": replyHandler,
  "/consent": consentHandler,
  "/push": pushHandler,
  "/profile": profileHandler,
  "/workday/today": todayHandler,
  "/workday/field-work": fieldWorkHandler,
  "/workday/leave": leaveHandler,
  "/workday/close": closeHandler,
  "/workday/deliver-next": deliverNextHandler,
  "/workday/report/period": periodHandler,
  "/admin/dashboard": adminDashboardHandler,
  "/cron/dispatch": cronDispatchHandler,
};

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  const url = new URL(req.url);
  // 호출 방식에 따라 "/functions/v1/api/워크데이/today" 또는 "/api/워크데이/today"로 들어올 수 있어 둘 다 정규화
  const pathname = url.pathname.replace(/^\/functions\/v1/, "").replace(/^\/api/, "") || "/";

  const handler = routes[pathname];
  if (!handler) {
    return new Response(JSON.stringify({ error: "Not Found" }), {
      status: 404,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }

  const nodeReq = await toNodeRequest(req, url);
  const { res, state } = makeNodeResponse();
  await handler(nodeReq, res);
  return toWebResponse(state);
});
