import { defineConfig } from "vitest/config";
import react from "@vitejs/plugin-react";
import path from "path";

export default defineConfig({
  plugins: [react()],
  test: {
    globals: true,
    projects: [
      {
        extends: true,
        test: {
          name: "node",
          environment: "node",
          include: ["tests/unit/**/*.test.ts"],
        },
      },
      {
        extends: true,
        test: {
          name: "components",
          environment: "jsdom",
          include: ["tests/components/**/*.test.{ts,tsx}"],
          setupFiles: ["tests/components/setup.ts"],
        },
      },
      {
        // Separate from "node" so `pnpm test:ci` can run without a database:
        // tests/rls/helpers.ts refuses to load unless NEXT_PUBLIC_SUPABASE_URL
        // points at a local Supabase stack (roadmap P0-E2a, design §5.6).
        extends: true,
        test: {
          name: "rls",
          environment: "node",
          include: ["tests/rls/**/*.spec.ts"],
        },
      },
    ],
  },
  resolve: {
    alias: {
      "@": path.resolve(__dirname, "./"),
    },
  },
});
