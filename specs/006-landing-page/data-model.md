# Phase 1 Data Model: Landing Page

This feature has **no persisted entities and no JSON:API resources**. The
"data" the page consumes is build-time configuration plus static
content modules. This document captures those shapes so the
implementation has a single reference.

---

## C1 — Site config (build-time, public)

**Module**: `assets/js/lib/config/site-config.ts`

```ts
interface SiteConfig {
  /**
   * Origin used to construct absolute URLs in OG / Twitter Card
   * meta. Production builds set VITE_SITE_ORIGIN.
   */
  siteOrigin: string;

  /**
   * Public contact address. Rendered as a `mailto:` in the marketing
   * footer and inside the privacy / terms stub disclaimers.
   */
  contactEmail: string;

  /**
   * Single social/community URL surfaced in the marketing footer.
   * The footer only requires one (FR-012 says "at least one").
   */
  socialUrl: string;
}
```

**Validation rules**:

- All three values are `string`. Empty-string fallbacks are not used —
  if an env var is missing, the default literal kicks in.
- `siteOrigin` is treated as a URL origin (no trailing slash). The OG
  URL constructor concatenates `${siteOrigin}/images/og/landing.png`,
  so a trailing slash would produce a double-slash. Test asserts.
- `contactEmail` is rendered into a `mailto:` href as-is. We do not
  validate email format at runtime (it's a developer-set constant),
  but the test suite asserts the build constant matches `/.+@.+/`.
- `socialUrl` is rendered into an `href` as-is and gets
  `rel="noreferrer"` plus `target="_blank"`.

**State transitions**: none — values are immutable per build.

---

## C2 — Per-route head metadata

**Module**: `assets/js/features/landing/content/meta.ts`

```ts
interface RouteMeta {
  /** Document <title>. */
  title: string;
  /** <meta name="description"> content. ≤ 160 chars enforced by test. */
  description: string;
  /** Open Graph / Twitter Card title; usually identical to `title`. */
  ogTitle: string;
  /** Open Graph / Twitter Card description; may differ from description. */
  ogDescription: string;
  /**
   * Path under siteOrigin, NOT a full URL. The route's `head` factory
   * composes the absolute URL from siteConfig.siteOrigin + this path.
   * Same image used by both the `og:image` and `twitter:image` tags.
   */
  ogImagePath: string;
}
```

**Three constants** are exported, one per route:

- `landingMeta` — for `/`. The "marketing" tagline copy.
- `privacyMeta` — for `/privacy`. Title: "Privacy Policy — GameNight".
- `termsMeta` — for `/terms`. Title: "Terms of Service — GameNight".

The exact copy is captured in `contracts/route-contracts.md`.

**Validation rules**:

- `title` length ≤ 70 (typical search-result truncation).
- `description` length ≤ 160 (typical SERP truncation; OG accepts ~200).
- `ogImagePath` MUST start with `/`.

These are asserted in a Vitest unit test against the exported
constants — purely build-time, no DOM.

---

## C3 — Privacy / Terms stub content

**Modules**: `assets/js/features/landing/content/privacy-draft.tsx`,
`terms-draft.tsx`.

These are JSX components, not data. Their structure is the section
list captured in `research.md` R6 and R7, with the actual prose body
drafted in `contracts/privacy-stub.md` and `contracts/terms-stub.md`.

**Required structural elements** (asserted by the route tests so a
future edit cannot silently drop them):

- Each draft renders an `h1` with the page's title (matches the route
  meta `title`, modulo the " — GameNight" suffix).
- Each draft renders a `<DraftDisclaimer />` component near the top
  with `role="status"` and the canonical text: "This document is a
  draft. It is not legal advice. We will publish a final, counsel-
  reviewed version before GameNight reaches general availability."
- Each draft renders a "Last revised" line with an ISO date.
- Each draft ends with a Contact section that includes
  `<a href={\`mailto:${siteConfig.contactEmail}\`}>` and the social URL.

**No state**, no client-side data fetching, no API calls.

---

## C4 — OG image asset

**Path**: `priv/static/images/og/landing.png`
**Dimensions**: 1200×630 px (Open Graph recommended).
**Max size**: ≤ 100 KB after optimization (`pngquant`/`oxipng`).
**Subject**: brand-only mark on parchment surface — wordmark in Noto
Serif, the page tagline below in Be Vietnam Pro, plus the same gold
ornament motif used by `<CornerOrnament>`. No product screenshots, no
photographic imagery (FR-019).

**Versioning**: committed alongside the implementation. Overwriting
the file does not need a path change because the OG tag URL is the
same; chat-platform caches do refresh, but they may take hours/days,
which is acceptable.

---

## Why no entities?

- No new resource is created on the backend (Constitution Check III).
- No persisted user choice or preference is read or written by this
  page (the auth-state and current-user reads are existing, not new).
- The content the page renders is either (a) build-time configuration
  baked into the bundle, or (b) JSX that lives in the source tree.

If a future iteration adds, e.g., a "Get notified when public
launches" form, that would introduce a real entity (a `WaitlistEntry`
Ash resource); it is explicitly out of scope here.
