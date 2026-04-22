import { defineConfig } from "vite";
import { phoenixVitePlugin } from "phoenix_vite";
import react from "@vitejs/plugin-react";
import { TanStackRouterVite } from "@tanstack/router-plugin/vite";
import tailwindcss from "@tailwindcss/vite";

export default defineConfig({
  server: {
    port: 5173,
    strictPort: true,
    cors: { origin: "http://localhost:4000" },
  },
  optimizeDeps: {
    include: ["phoenix", "phoenix_html", "phoenix_live_view"],
  },
  build: {
    manifest: true,
    rollupOptions: {
      input: ["js/app.js", "js/index.tsx", "css/app.css"],
    },
    outDir: "../priv/static",
    emptyOutDir: true,
  },
  resolve: {
    alias: {
      "@": "/js",
      // phoenix-colocated is only resolvable when Phoenix orchestrates Vite
      // via mix assets.build (which sets MIX_BUILD_PATH). When running the
      // Vite dev server standalone (e.g. Playwright Phase 2), the alias is
      // pointed at a harmless placeholder; the SPA entry doesn't import it.
      "phoenix-colocated": process.env.MIX_BUILD_PATH
        ? `${process.env.MIX_BUILD_PATH}/phoenix-colocated`
        : "/tmp/phoenix-colocated-unused",
    },
  },
  plugins: [
    tailwindcss(),
    TanStackRouterVite({
      routesDirectory: "./js/routes",
      generatedRouteTree: "./js/routeTree.gen.ts",
      autoCodeSplitting: true,
      routeFileIgnorePattern: "\\.(test|spec)\\.(ts|tsx)$",
    }),
    react({
      babel: {
        plugins: [["babel-plugin-react-compiler", {}]],
      },
    }),
    phoenixVitePlugin({
      pattern: /\.(ex|heex)$/,
    }),
  ],
});
