# Feature Specification: Landing Page

**Feature Branch**: `006-landing-page`
**Created**: 2026-05-05
**Status**: Draft
**Input**: User description: "Landing Page: As a potential user I want to see an appealing landing page that describes the purpose of the application and how to use it."

## User Scenarios & Testing *(mandatory)*

### User Story 1 - First-time visitor understands the product and signs up (Priority: P1)

A prospective Game Master arrives at the site for the first time, having heard
about GameNight from a peer or a search result. Within seconds of landing on
`/`, they understand what the app does (organize tabletop campaigns: schedule
sessions, manage rosters, coordinate availability), how it fits their workflow,
and what to do next (register an account). They scroll through a short,
scannable narrative — a hero, a three-step "how it works", a few feature
highlights, and a closing call-to-action — and click **Register** to start a
campaign.

**Why this priority**: This is the only path that converts an anonymous
visitor into a registered user. Without it the landing page is decorative.
Every other story is downstream of (or supportive of) this conversion.

**Independent Test**: Open `/` in an incognito browser, scroll the page
top-to-bottom, click the primary CTA, and land on the registration screen.
A visitor with no prior context should be able to articulate (a) what the app
is for and (b) what their first step would be after signing up.

**Acceptance Scenarios**:

1. **Given** an anonymous visitor opens `/`, **When** the page loads, **Then** the hero presents the product name, a one-line tagline, three value-prop bullets, a primary **Register** button, and a secondary **Sign in** link, all visible without scrolling on a standard desktop viewport.
2. **Given** the visitor scrolls past the hero, **When** they reach the "how it works" section, **Then** they see exactly three numbered steps describing the GM workflow (register a game → invite players → schedule the month) in plain language.
3. **Given** the visitor scrolls past "how it works", **When** they reach the feature highlights section, **Then** they see a short list of capabilities (e.g., monthly scheduling, roster & character management, availability tracking, notifications) presented as scannable cards or rows.
4. **Given** the visitor reaches the bottom of the page, **When** they encounter the closing call-to-action, **Then** the primary **Register** button is repeated alongside a brief reinforcing line.
5. **Given** the visitor clicks the primary **Register** CTA at any point on the page, **When** the click is registered, **Then** they navigate to the registration screen.

---

### User Story 2 - Returning authenticated user is gently routed to their dashboard (Priority: P2)

An authenticated user (typically a returning GM) navigates to `/` — perhaps
by clicking the wordmark in the global header, or by typing the bare domain
into the address bar. Instead of being abruptly redirected, they see a slim
banner at the top of the page acknowledging them and offering a single click
through to their dashboard. The marketing content remains scrollable below
the banner so they can revisit the pitch (useful when they're showing the app
to a friend), but the primary path back into the product is one click away.

**Why this priority**: Today the route already shows a context-aware "Go to
dashboard" button. Preserving this behavior in the new design avoids a
regression for existing users and supports the common "show a friend" demo
flow without forcing a sign-out.

**Independent Test**: Sign in, then navigate to `/`. Confirm the slim banner
is present at the top of the page, the "Go to dashboard" affordance works,
and the rest of the marketing page is reachable by scrolling.

**Acceptance Scenarios**:

1. **Given** an authenticated user opens `/`, **When** the page loads, **Then** a slim banner appears above the hero with a welcome message and a "Go to dashboard" link/button.
2. **Given** the authenticated user clicks the banner's "Go to dashboard" affordance, **When** the click is registered, **Then** they navigate to `/dashboard`.
3. **Given** the authenticated user dismisses, ignores, or scrolls past the banner, **When** they continue scrolling, **Then** they see the same marketing content an anonymous visitor sees (hero, how-it-works, features, closing CTA).
4. **Given** the authenticated user's session expires while they are viewing `/`, **When** the page state next reflects auth, **Then** the banner is no longer shown and they see the anonymous experience.

---

### User Story 3 - Link previews well when shared in chat tools (Priority: P3)

A GM pastes the GameNight URL into a Discord channel, Slack DM, or iMessage
thread to recruit a friend. The unfurl shows a recognizable title, a short
description that captures the pitch, and a branded preview image — enough
that the recipient can decide whether to click without opening a tab.

**Why this priority**: GameNight is invitation-driven and word-of-mouth. The
landing page only converts visitors who actually click through, and a generic
or broken unfurl materially reduces click-through. Lower priority than P1/P2
because it's a polish layer on top of an already-functional page.

**Independent Test**: Paste the production URL into Discord, Slack, and
iMessage. Confirm each unfurl shows the correct title, description, and
preview image (no broken thumbnails, no fallback to the URL alone).

**Acceptance Scenarios**:

1. **Given** the URL of `/` is pasted into a chat tool that consumes Open Graph metadata, **When** the unfurl is generated, **Then** it shows the configured page title, description, and preview image.
2. **Given** a search engine or AI agent fetches `/`, **When** it inspects the document head, **Then** it finds a descriptive page title and meta description summarizing the product.

---

### Edge Cases

- **Reduced-motion preference**: If the visitor has `prefers-reduced-motion: reduce`, any decorative animation (hover transitions, scroll reveals) is suppressed in favor of static content.
- **Narrow viewports (mobile)**: All sections reflow to a single column; the hero, how-it-works, feature highlights, footer, and authenticated banner remain legible and tappable; primary CTAs remain visible without horizontal scroll.
- **Wide viewports (≥1440px)**: Content has a sensible max width — measure remains readable and parchment surface is not stretched edge-to-edge.
- **JavaScript disabled / slow first paint**: Core content (hero copy, primary CTA href, footer links) is meaningful and clickable without JavaScript; decorative behavior may be absent.
- **Authenticated user with stale session**: Slim banner gracefully disappears once the client recognizes the session is invalid; visitor sees the anonymous experience without a flash of the wrong state.
- **Visitor arriving with `?invite=...` or other query parameters**: Query params are preserved when navigating to `/sign-in` or `/register` so any downstream invitation flow can pick them up.
- **Brand asset unavailable for share-preview**: If the configured Open Graph image fails to load, the page still renders without layout breakage.
- **Visitor lands directly on `/privacy` or `/terms`**: Each stub page renders standalone, includes the global header, and offers a clear path back to the rest of the site (header wordmark links to `/`).

## Requirements *(mandatory)*

### Functional Requirements

#### Page structure & content

- **FR-001**: The landing page MUST be served at `/` and MUST be reachable by anonymous visitors without authentication.
- **FR-002**: The landing page MUST present, in this order: a hero section, a three-step "how it works" section, a feature highlights section, a closing call-to-action section, and a footer.
- **FR-003**: The hero section MUST include the product wordmark, a single-sentence tagline, exactly three short value-proposition bullets, a primary **Register** call-to-action, and a secondary **Sign in** affordance.
- **FR-004**: The "how it works" section MUST present exactly three numbered steps describing the GM workflow: registering a game, inviting players, and scheduling the month.
- **FR-005**: The feature highlights section MUST surface the app's primary capabilities (monthly scheduling, roster and character management, availability tracking and posting, notifications) as scannable items, with at minimum four highlights.
- **FR-006**: The closing call-to-action section MUST repeat the primary **Register** action with a brief reinforcing line.
- **FR-007**: All copy MUST be addressed to the Game Master persona (the decision-maker who creates a game and invites players); player-side benefits MAY be referenced but MUST NOT compete with the GM-first pitch.

#### Auth-state behavior

- **FR-008**: When the visitor is anonymous, the landing page MUST show the full marketing content with the **Register** primary call-to-action and a **Sign in** secondary affordance.
- **FR-009**: When the visitor is authenticated, the landing page MUST display a slim "welcome back" banner above the hero containing a single affordance that navigates to `/dashboard`. The marketing content MUST remain scrollable below the banner.
- **FR-010**: The page MUST NOT auto-redirect authenticated visitors away from `/`.
- **FR-011**: The Register / Sign in affordances MUST preserve URL query parameters when navigating to `/register` or `/sign-in`.

#### Footer

- **FR-012**: The landing page MUST render a marketing footer containing, at minimum: a copyright line, a Privacy link, a Terms link, a Contact affordance, and at least one social/community link.
- **FR-013**: The footer MUST appear only on the landing page; the rest of the SPA's authenticated chrome MUST remain footer-less.
- **FR-014**: The footer's Privacy link MUST navigate to `/privacy` and the Terms link MUST navigate to `/terms`. Both destinations MUST be served by this feature as draft policy pages whose structure follows industry-standard SaaS privacy / terms-of-service conventions (categorical sections — what is collected / how it's used / your rights for Privacy; acceptance / acceptable use / liability for Terms). Each page MUST display a prominent disclaimer clarifying that the document is a draft for transparency, is not legal advice, and is subject to change before general availability, and MUST include a `mailto:` Contact affordance for questions. Each page MUST use the same global chrome (header) as the rest of the SPA. Production-quality legal review is explicitly out of scope; the goal is a credible, transparent placeholder that is materially better than "coming soon."
- **FR-015**: The footer's Contact affordance MUST be a `mailto:` link to a configured contact address. The address MUST be sourced from a single configuration value (not hard-coded in multiple places) so it can be changed without modifying markup.

#### Share-ready metadata

- **FR-016**: The page MUST set a descriptive document title that includes the product name and a short positioning phrase.
- **FR-017**: The page MUST set a meta description summarizing the product in 160 characters or fewer (typical SERP truncation length).
- **FR-018**: The page MUST set Open Graph and Twitter Card metadata, including a title, description, and a branded preview image suitable for social unfurls (1200×630).

#### Visual & brand

- **FR-019**: The page MUST use the established Adventurer's Journal design system (parchment surface, forest-green primary, burnt-orange secondary, gold tertiary, Noto Serif headlines, Be Vietnam Pro body) and MUST NOT introduce product screenshots, photographic imagery, or stock illustrations. Decorative elements are limited to typography, color, divider/ornament motifs, and the parchment surface.
- **FR-020**: The page MUST be responsive across mobile, tablet, and desktop breakpoints used elsewhere in the SPA, including legibility on the parchment surface at standard contrast ratios.
- **FR-021**: The page MUST honor `prefers-reduced-motion` for any decorative motion or transitions.

#### Accessibility & quality

- **FR-022**: All interactive elements (CTAs, footer links, banner affordance) MUST be reachable and operable via keyboard and announce their purpose to screen readers.
- **FR-023**: Headings MUST follow a single logical document outline (one `h1`, descending levels for sections).
- **FR-024**: Color contrast for text on the parchment surface MUST meet WCAG 2.2 AA at minimum.

### Key Entities

- **Visitor (anonymous)**: A person with no active session arriving at `/`. They consume the marketing content and decide whether to register.
- **Visitor (authenticated)**: A person with an active session arriving at `/`. They are not a conversion target; the page steers them to their dashboard while still allowing them to view the marketing content.
- **Brand assets**: The product name, tagline, color tokens, typography, and the Open Graph share image. Versioned with the design system rather than the spec.

## Success Criteria *(mandatory)*

### Measurable Outcomes

- **SC-001**: A first-time anonymous visitor can correctly state, in their own words, what GameNight is for and who it is for after at most 30 seconds on the page (validated via informal usability checks with at least five non-customer testers).
- **SC-002**: At least 25% of unique anonymous sessions that reach `/` proceed to `/register` (click-through to the registration screen) once the new page is live, measured over a 30-day window.
- **SC-003**: Returning authenticated visitors who land on `/` reach `/dashboard` in one click in at least 95% of sessions where they continue navigation.
- **SC-004**: When the URL is shared in Discord, Slack, and iMessage, the resulting unfurl renders the configured title, description, and preview image with no broken assets in 100% of test pastes across the three platforms.
- **SC-005**: The page meets WCAG 2.2 AA criteria — including 2.4.11 Focus Not Obscured (Minimum), 2.5.7 Dragging Movements, and 2.5.8 Target Size (Minimum, ≥24×24 CSS px) — as verified by an automated accessibility audit (zero violations of severity "serious" or higher) plus the per-release manual audit required by Constitution Principle IV.
- **SC-006**: Largest Contentful Paint on a mid-tier mobile device over a 4G connection completes within 2.5 seconds for a cold visit.

## Assumptions

- **GM-first positioning**: The page is targeted at prospective Game Masters. Players who arrive here without an invitation are treated as a secondary audience (they can sign in if they already have an account); discovery for players is expected to happen via invitation links, not via this page.
- **Open self-serve registration**: Anyone can register an account without an invitation. The primary CTA is **Register** (Q5=A); **Sign in** is the secondary affordance.
- **Authenticated users see a slim welcome banner** rather than an auto-redirect (Q2=C). This preserves the "show the pitch to a friend" use case.
- **Page depth is a scrolling narrative**: hero → three-step how-it-works → feature highlights → closing CTA → footer (Q3=B). Not a single-screen poster, not a multi-page marketing site.
- **No product imagery or stock illustration in v1** (Q4=C). The visual direction relies on the existing Adventurer's Journal design system tokens, typography, and decorative ornamentation. Adding screenshots or illustration is explicitly out of scope and tracked as a separate enhancement.
- **Marketing footer is in scope** (Q6=C), and so are minimal stub pages at `/privacy` and `/terms` (Q1=A). The stubs are intentionally placeholder content; production-quality legal copy is tracked separately. The Contact affordance is a `mailto:` rather than a contact form.
- **Share-ready metadata only** (Q7=B). No sitemap, structured data, or SEO-keyword optimization in v1; OG/Twitter Card + descriptive title/description is sufficient.
- **English only**: Internationalization is out of scope.
- **Existing global header behavior**: The header continues to show the GameNight wordmark, plus **Sign in** / **Register** for anonymous visitors, on this route. No bespoke landing-page chrome is introduced beyond the new footer.
- **Design system tokens**: The page consumes existing `--gn-*` and shadcn semantic tokens defined in `assets/css/app.css`; no new color or typography tokens are required.
