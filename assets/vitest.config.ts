import { defineConfig, mergeConfig } from "vitest/config";
import viteConfig from "./vite.config";

export default mergeConfig(
  viteConfig,
  defineConfig({
    test: {
      globals: true,
      environment: "jsdom",
      setupFiles: ["./js/test/setup.ts"],
      css: false,
      include: ["js/**/*.{test,spec}.{ts,tsx}"],
      exclude: ["node_modules", "../priv/static", "e2e/**"],
    },
  }),
);
