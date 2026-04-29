/**
 * Bundle-size budget for the SPA's initial JS payload.
 *
 * Enforced threshold (this file):
 *   - 350 KB gzipped — `bun run size-limit` fails above this.
 *
 * Two additional thresholds from the constitution are enforced at the
 * CI layer (where we can compare against the main branch baseline):
 *   - 250 KB gzipped warn threshold.
 *   - Any single PR adding more than 10 KB vs `main` fails.
 *
 * We resolve the hashed filenames by reading the Vite manifest that
 * `vite build` writes to `priv/static/.vite/manifest.json`. That
 * manifest lists the entry chunk plus its synchronous `imports` — the
 * subset the browser downloads before the first paint. Dynamic
 * imports (per-route splits) are deliberately excluded from the
 * initial-bundle budget: they're what code-splitting buys us.
 */
const fs = require("node:fs");
const path = require("node:path");

const manifestPath = path.resolve(__dirname, "../priv/static/.vite/manifest.json");

function initialBundleFiles() {
  if (!fs.existsSync(manifestPath)) {
    // `vite build` hasn't produced the manifest yet. Return an empty
    // list — size-limit will fail loudly with a useful error message
    // instead of silently passing.
    throw new Error(
      `Vite manifest not found at ${manifestPath}. Run \`bun run build\` first.`,
    );
  }

  const manifest = JSON.parse(fs.readFileSync(manifestPath, "utf8"));
  const entry = manifest["js/index.tsx"];
  if (!entry) {
    throw new Error(
      "Manifest is missing the `js/index.tsx` entry chunk — did the Vite config change?",
    );
  }

  const syncChunks = new Set([entry.file]);
  const visit = (name) => {
    const chunk = manifest[name];
    if (!chunk || syncChunks.has(chunk.file)) return;
    syncChunks.add(chunk.file);
    for (const dep of chunk.imports ?? []) visit(dep);
  };
  for (const dep of entry.imports ?? []) visit(dep);

  return [...syncChunks].map((file) =>
    path.resolve(__dirname, "../priv/static", file),
  );
}

function maybeRouteChunkFile(routeKey) {
  // Resolve a route chunk's hashed file from the Vite manifest, if
  // present. Returns `null` when the chunk is not yet in the manifest
  // — which lets feature-002 per-route entries land in foundational
  // work without breaking `bun run size-limit` before the routes
  // themselves are implemented in later phases. Once the route exists
  // and is built, the corresponding budget kicks in automatically.
  if (!fs.existsSync(manifestPath)) {
    throw new Error(
      `Vite manifest not found at ${manifestPath}. Run \`bun run build\` first.`,
    );
  }

  const manifest = JSON.parse(fs.readFileSync(manifestPath, "utf8"));
  const entry = manifest[routeKey];
  if (!entry) {
    console.warn(
      `[size-limit] Skipping budget for missing chunk \`${routeKey}\` — expected once the corresponding route lands.`,
    );
    return null;
  }

  return path.resolve(__dirname, "../priv/static", entry.file);
}

const featureRouteEntries = [
  {
    name: "Route chunk: /invitations/$token (gzipped)",
    routeKey: "js/routes/invitations.$token.tsx",
    limit: "12 KB",
  },
  {
    name: "Route chunk: /invitations (gzipped)",
    routeKey: "js/routes/invitations.index.tsx",
    limit: "8 KB",
  },
  {
    name: "Route chunk: /characters (gzipped)",
    routeKey: "js/routes/characters.tsx",
    limit: "8 KB",
  },
  {
    name: "Route chunk: /notifications (gzipped)",
    routeKey: "js/routes/notifications.tsx",
    limit: "8 KB",
  },
  // Feature 003 — Schedules. Budgets per plan §VI / T155.
  {
    name: "Route chunk: GM schedule detail (gzipped)",
    routeKey: "js/routes/games.$gameId.schedules.$scheduleId.tsx",
    limit: "22 KB",
  },
  {
    name: "Route chunk: GM schedules list (gzipped)",
    routeKey: "js/routes/games.$gameId.schedules.index.tsx",
    limit: "8 KB",
  },
  {
    name: "Route chunk: character schedules list (gzipped)",
    routeKey: "js/routes/characters.$characterId.schedules.index.tsx",
    limit: "12 KB",
  },
  {
    name: "Route chunk: character schedule detail (gzipped)",
    routeKey: "js/routes/characters.$characterId.schedules.$scheduleId.tsx",
    limit: "16 KB",
  },
]
  .map(({ name, routeKey, limit }) => {
    const filePath = maybeRouteChunkFile(routeKey);
    return filePath === null ? null : { name, path: filePath, gzip: true, limit };
  })
  .filter(Boolean);

module.exports = [
  {
    name: "Initial SPA bundle (gzipped)",
    path: initialBundleFiles(),
    gzip: true,
    limit: "350 KB",
  },
  ...featureRouteEntries,
];
