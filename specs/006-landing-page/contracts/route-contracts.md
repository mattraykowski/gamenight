# Route & head metadata contracts

This file is the source of truth for the visible copy that the routes
emit into the document head and onto the page surface. The
implementation (and its tests) refer to these constants.

---

## `/` — Landing page

**Document head**:

| Tag | Value |
|---|---|
| `<title>` | `GameNight — Run your tabletop campaign with confidence` |
| `<meta name="description">` | `GameNight helps Game Masters organize tabletop campaigns: register games, invite players, schedule the month, and keep your fellowship in sync.` |
| `<meta property="og:title">` | `GameNight — Run your tabletop campaign with confidence` |
| `<meta property="og:description">` | `Register your game, invite your players, and schedule the month. GameNight keeps every campaign on the same page.` |
| `<meta property="og:type">` | `website` |
| `<meta property="og:url">` | `${siteOrigin}/` |
| `<meta property="og:image">` | `${siteOrigin}/images/og/landing.png` |
| `<meta property="og:image:width">` | `1200` |
| `<meta property="og:image:height">` | `630` |
| `<meta name="twitter:card">` | `summary_large_image` |
| `<meta name="twitter:title">` | `GameNight — Run your tabletop campaign with confidence` |
| `<meta name="twitter:description">` | (same as `og:description`) |
| `<meta name="twitter:image">` | `${siteOrigin}/images/og/landing.png` |

**Hero copy**:

- Wordmark: `GameNight`
- Tagline (`<p>` directly under `<h1>`):
  `Run your tabletop campaign with confidence. Register a game, invite your players, and schedule the month — together.`
- Three value-prop bullets (FR-003):
  1. **Schedule the month, together.** Set your availability, your players set theirs, you publish the final game-on days.
  2. **Keep the roster organized.** Track every player, every character, across every campaign you run.
  3. **No more messy group chats.** Notifications, invitations, and confirmations all in one place.
- Primary CTA: `Register` → `/register`
- Secondary affordance: `Already have an account? Sign in` → `/sign-in`

**How it works (3 steps, FR-004)**:

1. **Register your game.** Give it a name, set the cadence, and you're the GM.
2. **Invite your players.** Send invitations by email. Players join with a single click and bring their characters.
3. **Schedule the month.** You mark your availability, your players mark theirs, GameNight surfaces the days that work.

**Feature highlights (FR-005, ≥ 4)**:

- **Monthly scheduling.** Plan one month at a time. See everyone's availability at a glance, post the final list when you're ready.
- **Rosters & characters.** Each game has a roster. Each player brings a character. Switch contexts without losing the thread.
- **Player-side availability.** Players submit their availability without seeing each other's, so nobody anchors to the GM's calendar.
- **Notifications.** Players hear about new schedules; you hear about late submissions and changes — without checking twelve different chats.

**Closing CTA (FR-006)**:

- Heading: `Ready to run your next session?`
- One reinforcing line: `Set up your first game in under five minutes — no credit card, no setup fee.`
- Primary CTA: `Register` → `/register`

**Authenticated banner (FR-009)**:

- Visible only when `useOptionalAuth().isAuthenticated === true`.
- Body: `Welcome back{user.email && \`, \${friendlyName(user.email)}\`}. Your dashboard is one click away.`
- CTA: `Go to dashboard` → `/dashboard`. Default-size `<Button>`.

**Marketing footer (FR-012, FR-013, FR-015)**:

- Copyright line: `© ${new Date().getFullYear()} GameNight`
- `Privacy` → `/privacy`
- `Terms` → `/terms`
- `Contact` → `mailto:${siteConfig.contactEmail}`
- One social link → `siteConfig.socialUrl` with `target="_blank" rel="noreferrer"`

---

## `/privacy` — Privacy Policy stub

**Document head**:

| Tag | Value |
|---|---|
| `<title>` | `Privacy Policy — GameNight` |
| `<meta name="description">` | `Draft privacy policy for GameNight. We publish this for transparency; the final version will be counsel-reviewed before general availability.` |

The OG/Twitter Card meta on `/privacy` and `/terms` reuses
`landingMeta`'s OG image and a `og:type=article`. We deliberately do
not optimize these pages for sharing; they exist to back the footer
links.

**Page surface**: see `contracts/privacy-stub.md` for the drafted body.

---

## `/terms` — Terms of Service stub

**Document head**:

| Tag | Value |
|---|---|
| `<title>` | `Terms of Service — GameNight` |
| `<meta name="description">` | `Draft terms of service for GameNight. We publish this for transparency; the final version will be counsel-reviewed before general availability.` |

**Page surface**: see `contracts/terms-stub.md` for the drafted body.

---

## Acceptance contracts (test-asserted)

These are invariants every route test enforces:

1. There is exactly one `<h1>` per route, carrying both
   `data-route-heading` and `tabIndex={-1}` (route-change focus).
2. Clicking the primary `Register` link or the `Sign in` affordance
   navigates to `/register` or `/sign-in` respectively, **preserving
   any existing query parameters** (FR-011). Asserted by mounting
   the route at `/?invite=abc123` and snapshotting the rendered
   `href`.
3. The welcome-back banner is **absent** when no `<AuthProvider>` is
   mounted or when `auth.isAuthenticated === false`, and **present**
   when `auth.isAuthenticated === true`.
4. The marketing footer's Contact `<a>` resolves to
   `mailto:${siteConfig.contactEmail}` exactly.
5. The privacy and terms drafts each render the canonical
   "draft, not legal advice" disclaimer near the top of the page,
   with `role="status"`. The disclaimer text is matched by a regex
   so cosmetic edits remain free but a removal fails.
6. Every rendered DOM tree passes `expectNoAxeViolations(container)`.
