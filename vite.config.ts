import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import tailwindcss from "@tailwindcss/vite";
import path from "path";

export default defineConfig({
  // GitHub Pages에 커스텀 도메인(enmate.co.kr)으로 배포 — 루트 경로에서 서빙되므로 base는 항상 "/"
  base: "/",
  plugins: [react(), tailwindcss()],
  resolve: {
    alias: {
      "@": path.resolve(__dirname, "./src"),
    },
  },
  server: {
    port: Number(process.env.PORT) || 5173,
    strictPort: false,
    // 백엔드는 Vercel이 아니라 Supabase Edge Function(supabase/functions/api)이라, VITE_API_BASE_URL로
    // 직접 가리킨다(.env.local). 로컬 검증은 `supabase functions serve`로 함께 띄워서 확인.
  },
});
