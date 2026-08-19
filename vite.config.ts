import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import tailwindcss from "@tailwindcss/vite";
import path from "path";

const isGithubPages = process.env.GITHUB_PAGES === "true";

export default defineConfig({
  base: isGithubPages ? "/english/" : "/",
  plugins: [react(), tailwindcss()],
  resolve: {
    alias: {
      "@": path.resolve(__dirname, "./src"),
    },
  },
  server: {
    port: Number(process.env.PORT) || 5173,
    strictPort: false,
    // 순수 `vite` dev(프론트 단독 개발)에서 /api를 프로덕션 백엔드로 프록시.
    // vercel dev로 띄우면 vercel이 /api를 직접 서빙하므로 이 프록시는 안 탐.
    proxy: {
      "/api": {
        target: "https://english-suasua1.vercel.app",
        changeOrigin: true,
      },
    },
  },
});
