import tailwindcss from "@tailwindcss/vite";
import react from "@vitejs/plugin-react";
import { defineConfig } from "vite";
import pkg from "./package.json" with { type: "json" };

// Versão que aparece na observabilidade: commit da Vercel ou versão do package.json.
process.env.VITE_APP_VERSION ??= process.env.VERCEL_GIT_COMMIT_SHA?.slice(0, 7) || pkg.version;
process.env.VITE_APP_ENV ??= process.env.VERCEL_ENV || undefined;

export default defineConfig({
  plugins: [react(), tailwindcss()],
  build: { sourcemap: "hidden", chunkSizeWarningLimit: 700 },
  test: {
    environment: "jsdom",
    globals: false,
    setupFiles: ["./src/test/setup.ts"],
    include: ["src/**/*.test.{ts,tsx}"],
    css: false,
    testTimeout: 30000,
    // Testes nunca falam com o Supabase de verdade: rodam no backend de memória.
    env: { VITE_SUPABASE_URL: "", VITE_SUPABASE_PUBLISHABLE_KEY: "" },
    coverage: {
      provider: "v8",
      reporter: ["text-summary", "lcov", "json-summary"],
      include: ["src/**/*.{ts,tsx}"],
      exclude: [
        "src/**/*.test.{js,jsx}",
        "src/test/**",
        "src/main.jsx",
        "src/observability/{sentry,datadog,newrelic,otel}.js",
        "src/data/backend-supabase.js",
        "src/data/supabase.js",
        "src/data/auth.js",
      ],
      thresholds: { "src/domain/**": { lines: 90, functions: 90, branches: 80 } },
    },
  },
});
