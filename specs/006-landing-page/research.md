# Phase 0 Research: Landing Page

This document resolves the open technical questions raised in `plan.md` and
captures the source material for the privacy / terms drafts the user
requested via `/speckit-plan` arguments.

---

## R1 — Per-route document head (title, meta description, OG / Twitter Card)

### Decision

Use the **TanStack Router `head` route option** (available on every
`createFileRoute` instance from `@tanstack/react-router` 1.155+; this
project is on 1.160). Each new route declares its own `head` returning
an object with `meta`, `links`, and (where relevant) `scripts` arrays.
TanStack Router merges these per matched route and writes them to the
document head on navigation.

### Rationale

- **Zero new dependencies** — `react-helmet-async`, `@unhead/react`, etc.
  would all add 2–8 KB gzipped and another lifecycle to reason about.
- **Per-route ownership** — the meta lives next to the route component,
  not in a global context. This matches how every other route owns its
  own concerns (loaders, search-param schemas, error/pending components).
- **Test-friendly** — `Route.options.head?.()` is a pure function we can
  assert against in Vitest without spinning up jsdom; the head config
  test is fast and deterministic.
- **No SSR surprises** — TanStack Router renders the head on the client
  for SPA configurations. We're a pure SPA per the constitution
  (Principle III), so no SEO-side issues from late head injection beyond
  what already exists today.

### Alternatives considered

- **`react-helmet-async`** — well-known but a long-standing maintenance
  story (the "async" fork exists *because* the original is unmaintained).
  Adds dependency surface for no advantage here.
- **`@unhead/react`** — nicer ergonomics than helmet, but again a new
  dep and a separate provider. The router's built-in option is enough.
- **Hand-rolled `useEffect` setting `document.title`** — rejected: easy
  to ship, hard to test, awful for OG/Twitter tags (would require
  manual `<meta>` element CRUD with cleanup).

### Implementation note

The OG image's `content` URL must be **absolute**. We compose it as
`${siteOrigin}/images/og/landing.png` where `siteOrigin` is read from
`import.meta.env.VITE_SITE_ORIGIN` (set in production to
`https://gamenight.example.com` — final domain TBD by the deploy
config) with a `http://localhost:4000` dev fallback. `siteOrigin` is
encapsulated in `assets/js/lib/config/site-config.ts` so route head
factories don't read `import.meta.env` directly.

---

## R2 — Open Graph image creation

### Decision

Ship a **statically committed PNG** at
`priv/static/images/og/landing.png`, 1200×630, brand-only:
parchment background, "GameNight" wordmark in Noto Serif, the page
tagline below in Be Vietnam Pro, plus a small decorative ornament.
Designed once in Stitch (the Adventurer's Journal design system already
covers all the visual ingredients), exported as PNG, optimized via
`pngquant` or `oxipng` to ≤ 100 KB.

### Rationale

- **Build-time generation** would require a satori-style stack
  (`@vercel/og`, `satori`, etc.) which we'd have to install, configure,
  and keep working in CI. Overkill for a single image that changes once
  every few quarters at most.
- **Phoenix-rendered dynamic OG** is a server-side template — it would
  drag the feature out of the pure-SPA boundary and add a route to
  `lib/game_night_web/`.
- The spec (FR-019) forbids product imagery anyway, so the OG image is
  effectively a brand mark. Static is the right call.

### Alternatives considered

- **No OG image (only title/description)** — chat tools like Discord
  and iMessage fall back to a small generic preview that materially
  reduces click-through. Rejected.
- **Reuse `priv/static/images/logo.svg`** — Slack/Discord prefer
  1200×630 raster; SVG OG support is uneven. Rejected.

### Open follow-up

The actual PNG asset is a designer task. The implementation tasks
created by `/speckit-tasks` will reference this asset by path; if the
file doesn't exist when implementation lands, the OG meta still
resolves to a 404-on-fetch but the page itself renders fine
(degradation handled per the edge case "Brand asset unavailable for
share-preview"). The Playwright unfurl smoke is gated on the asset
shipping.

---

## R3 — Welcome-back banner state

### Decision

Read auth state via `useOptionalAuth()` from
`assets/js/lib/auth/auth-context.tsx`. Render the banner when
`auth?.isAuthenticated === true`. No new context, no new hook.

The banner uses `useCurrentUser()` (already exposed by
`assets/js/features/current-user/hooks.ts`, see `routes/dashboard.tsx`
for the established usage) to derive the friendly first-name greeting.
While the user query is pending, the banner shows "Welcome back." with
no personalization. While the user query is in error, the banner still
shows the generic copy and the link to the dashboard — it does not
hide. (The point is to get authenticated users back to their dashboard
quickly; a transient API blip should not erase that affordance.)

### Rationale

- The auth context is already populated synchronously on first paint
  via the `<script id="auth-state">` JSON island, so there is **no
  flash of marketing content** for authed users vs. flash of authed
  content for anonymous users.
- Routing through the existing `useCurrentUser()` matches how
  `dashboard.tsx` does it; we don't fork the pattern.

### Alternatives considered

- **`beforeLoad` redirect to `/dashboard`** — rejected per Q2=C: the
  user explicitly wants authed users to **see the marketing page** so
  they can demo it to a friend.
- **Suspense over the banner** — overkill; a graceful fallback is
  fine because the rest of the page renders independently.

---

## R4 — Site config module

### Decision

Add `assets/js/lib/config/site-config.ts` exporting:

```ts
export const siteConfig = {
  // Origin used to construct absolute URLs for OG meta. Falls back to
  // localhost in dev. In production, set VITE_SITE_ORIGIN at build
  // time so the value is baked into the bundle.
  siteOrigin: import.meta.env.VITE_SITE_ORIGIN ?? "http://localhost:4000",

  // Contact address rendered in the marketing footer + privacy/terms
  // stubs. Public, not a secret. Centralized so a future change is
  // a one-line edit.
  contactEmail: import.meta.env.VITE_CONTACT_EMAIL ?? "hello@example.com",

  // Single social/community link surfaced in the marketing footer.
  // Set to the project's GitHub repo by default; production may
  // override or add additional links in a future revision.
  socialUrl: import.meta.env.VITE_SOCIAL_URL ?? "https://github.com/",
} as const;
```

`vite.config.ts` already loads `.env` files; we add documented entries
to `.env.example` so production deploys can override.

### Rationale

- One module, three constants, zero ceremony. Matches the project's
  existing posture of small, named config helpers under `assets/js/lib/`.
- The fallbacks let dev work without env config; production bakes real
  values via `VITE_*` env vars during the Vite build, which is how the
  project already plumbs build-time config.

### Alternatives considered

- **Hardcode the values in the components** — rejected per FR-015
  (must be sourced from a single configuration value).
- **Read from a Phoenix-rendered config island** — rejected; the
  values don't change per request, baking them at build is simpler.

---

## R5 — Reduced-motion handling

### Decision

If we ship any decorative scroll-reveal or hover animation, gate it
behind a `useReducedMotion()` helper that wraps
`window.matchMedia("(prefers-reduced-motion: reduce)")`. When the
preference is set, the helper returns `true` and components render
their static state.

### Rationale

- **Standard pattern.** No need to invent anything. The helper lives in
  `assets/js/lib/a11y/use-reduced-motion.ts` (a sibling to the
  existing `use-focus-on-route-change.ts`).
- Tests mock `matchMedia` to assert reduced-motion behavior — same
  test pattern used elsewhere in the project.

### Open question

The launch design may not use any motion at all (Q4=C says type-only,
no imagery — motion was never required). If the implementation lands
without animations, the helper may not be necessary. The plan accepts
either outcome; FR-021 is satisfied trivially when there is no motion
to gate.

---

## R6 — Privacy stub: best-practice draft

This research summarizes industry-standard SaaS privacy-policy
structure and produces a drafted body for `/privacy`. The full draft
is captured in `contracts/privacy-stub.md`; this section explains the
shape and the reference points.

### Decision

The `/privacy` page renders, in this order:

1. **Heading** — "Privacy Policy".
2. **Effective date** — "Draft, last revised 2026-05-06."
3. **Disclaimer callout** — prominent (parchment surface with gold
   border, role="status"): "This document is a draft we publish for
   transparency. It is not legal advice. We will publish a final,
   counsel-reviewed policy before GameNight reaches general
   availability. Questions? Email [contact]."
4. **What we collect** — three subsections: account info, content you
   create, automatic technical info (with examples for each).
5. **How we use what we collect** — a short bulleted list.
6. **How we share what we collect** — opens with "We do not sell your
   personal information." Lists narrow categories (subprocessors,
   legal compliance) with examples kept hypothetical.
7. **Cookies and similar technologies** — explains the auth cookie,
   notes the absence of advertising / cross-site tracking cookies.
8. **Your rights** — access, correction, deletion, export. Mentions
   GDPR and CCPA in plain language. Routes the request to the
   contact email.
9. **Data retention** — "We keep your account information until you
   ask us to delete it. We may keep records longer if we are legally
   required to."
10. **Children** — "GameNight is not intended for use by anyone
    under 13."
11. **International transfers** — short paragraph acknowledging the
    service runs in the United States.
12. **Security** — short paragraph: encryption in transit, no plain
    passwords, breach disclosure timeline.
13. **Changes to this policy** — "We will revise this policy. When
    we do, we will update the date at the top and, for material
    changes, notify signed-in users by email."
14. **Contact** — `mailto:` + project social link.

### Rationale

This structure mirrors the de-facto common pattern across modern SaaS
privacy policies (the categorical layout used by Linear, GitHub,
Notion, Basecamp, Cloudflare, et al.). It satisfies the disclosure
points required by the GDPR Art. 13/14 transparency principles and
California's CCPA/CPRA consumer-notice requirements without claiming
to be a final compliance document. The "draft, not legal advice"
callout is repeated at the top in plain English so a regulator,
prospective user, or counsel reading the page is unambiguous about
its status.

### What we deliberately did **not** include

- A list of named subprocessors (e.g., AWS, Postgres host, email
  vendor). That list belongs in the post-counsel final policy and
  changes with infrastructure choices.
- Cookie tables with exact cookie names and lifetimes. Inappropriate
  for a stub; the actual auth-cookie names are an implementation
  detail subject to change.
- Region-by-region rights detail (GDPR vs. UK GDPR vs. CCPA vs.
  state-level US laws). The stub mentions GDPR and CCPA generically
  and routes specifics through the contact email.

### References (industry pattern, not endorsements)

The structural pattern is consistent across publicly viewable privacy
policies including Linear, Notion, Basecamp, GitHub, Cloudflare, and
Stripe. Where SaaS policies differ, they tend to differ on:

- Which transparency report / sub-processor list they publish — out
  of scope for a stub.
- Whether they ship a separate cookie banner / consent UI — out of
  scope for a stub; GameNight uses session cookies for authentication
  only, no consent UI required under standard interpretations.

---

## R7 — Terms of Service stub: best-practice draft

### Decision

The `/terms` page renders, in this order:

1. **Heading** — "Terms of Service".
2. **Effective date** — "Draft, last revised 2026-05-06."
3. **Disclaimer callout** — same shape as the privacy disclaimer.
4. **Agreement** — short paragraph: by creating an account or using
   the service you agree to these terms.
5. **Eligibility** — must be 13 or older.
6. **Your account** — you are responsible for the activity under
   your account; pick a strong password; tell us about any
   unauthorized access.
7. **Acceptable use** — short list: do not abuse other players, do
   not upload illegal content, do not attempt to disrupt the service
   or other players' games, do not attempt to access another user's
   account.
8. **Your content** — you keep ownership of your games, characters,
   schedules, and other content. You grant GameNight the rights it
   needs to host and display that content to people you have invited.
   You are responsible for what you post.
9. **Service availability** — provided "as is"; we will try to keep
   the service running but do not promise uninterrupted access.
10. **Termination** — you can close your account anytime by emailing
    contact. We may suspend or terminate accounts that violate these
    terms, with a brief reason where reasonable.
11. **Disclaimers** — short paragraph in plain English: no warranty
    beyond what the law requires.
12. **Limitation of liability** — short paragraph; references that
    the final terms will set a specific cap.
13. **Changes to these terms** — same notification approach as the
    privacy policy.
14. **Governing law and contact** — placeholder ("United States, with
    specific state TBD") + the contact mailto.

### Rationale

This is the standard "consumer SaaS ToS" skeleton. It hits the
required-by-convention sections (acceptance, eligibility, account
duties, acceptable use, content license, availability, termination,
disclaimers, liability, governing law, contact) without trying to be
a final document. Each section's language is intentionally short and
in plain English; legalese is constrained to the disclaimers /
limitation-of-liability sections where shorthand is unavoidable.

### What we deliberately did **not** include

- An arbitration clause / class-action waiver. These belong in the
  counsel-reviewed final version; including a draft of one in a
  preview document creates the wrong impression.
- A specific jurisdiction or governing-law selection. Marked as
  TBD pending counsel.
- An indemnification clause from the user toward GameNight. This is
  standard in production SaaS terms but is a meaningful obligation
  to surface to a prospective user; we leave it for the final
  counsel-reviewed version rather than draft a placeholder version
  that someone might rely on.

### References (industry pattern, not endorsements)

Same pattern reference set as the privacy policy: Linear, Notion,
Basecamp, GitHub, Cloudflare, Stripe ToS pages all share the section
skeleton above with various levels of legal density. Our draft is at
the lower end of legal density — appropriate for a stub.

---

## Summary of unknowns resolved

| Originally unknown | Resolution |
|---|---|
| Per-route head management approach | TanStack Router `head` option (R1) |
| OG image creation pipeline | Static PNG committed under `priv/static/images/og/` (R2) |
| Welcome-back banner data sourcing | Existing `useOptionalAuth` + `useCurrentUser` (R3) |
| Site config plumbing | New `assets/js/lib/config/site-config.ts` reading `VITE_*` env (R4) |
| Reduced-motion handling | `useReducedMotion` helper if any motion ships; otherwise N/A (R5) |
| Privacy stub structure & content | Industry-standard SaaS section skeleton; draft in `contracts/privacy-stub.md` (R6) |
| Terms stub structure & content | Industry-standard SaaS section skeleton; draft in `contracts/terms-stub.md` (R7) |

No NEEDS CLARIFICATION items remain.
