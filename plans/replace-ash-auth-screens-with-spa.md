# Plan: Replace Ash Authentication Screens with SPA Routes

> No source PRD — this is a follow-on to
> [bootstrap-react-spa-toolchain.md](./bootstrap-react-spa-toolchain.md),
> which explicitly kept `ash_authentication_phoenix` at its existing
> mounts. This plan finishes that migration so auth lives in the SPA
> alongside `/dashboard`.

## Architectural decisions

Durable decisions that apply across all phases. These were settled via
a design grill-out and should not be relitigated during implementation
without a new conversation.

### Transport: direct POST, one controller, one round trip

The SPA forms POST straight to the `auth_routes`-generated controller
endpoints — no `/rpc/run` involvement for auth, no intermediate
`sign_in_with_password` → `sign_in_with_token` handoff.

| SPA route | POSTs to | Strategy / phase |
| --- | --- | --- |
| `/sign-in` | `POST /auth/user/password/sign_in` | `{:password, :sign_in}` |
| `/register` | `POST /auth/user/password/register` | `{:password, :register}` |
| `/reset` | `POST /auth/user/password/reset_request` | `{:password, :reset_request}` |
| `/password-reset/:token` | `POST /auth/user/password/reset` | `{:password, :reset}` |
| `/magic-link` | `POST /auth/user/magic_link/request` | `{:magic_link, :request}` |
| `/magic_link/:token` | `POST /auth/user/magic_link` | `{:magic_link, :sign_in}` |
| `/confirm_new_user/:token` | `POST /auth/user/confirm_new_user` | `{:confirm_new_user, :confirm}` |

Every request carries `Accept: application/json` and the existing
`X-CSRF-Token` meta-tag header (via `buildCSRFHeaders()`). Every
response is JSON. The two-step token exchange the old LiveView did
is dead — we removed its only consumer.

### Controller: one `AuthController`, content-negotiated

`AuthController.success/4` and `failure/3` branch on
`get_format(conn)` (or the `Accept` header). JSON mode covers every
SPA flow; the HTML branch is defensive-only (fires if someone
bookmarks or navigates directly to an auth endpoint from a non-SPA
context — shouldn't happen in steady state).

**JSON success (200):** uniform `{user: {id, email}}` for every
activity that produces a user. The SPA — which knows which route it's
on — handles navigation and the success toast.

**JSON failure:**
```json
{
  "errors": [
    { "field": "email", "message": "has already been taken", "code": "taken" },
    { "field": null, "message": "Incorrect email or password", "code": "invalid_credentials" }
  ]
}
```

Status mapping:
- `AshAuthentication.Errors.AuthenticationFailed` → 401, `field: null`,
  `code: "invalid_credentials"`. Deliberately single form-level
  message — the library does not distinguish "wrong email" from
  "wrong password", and the SPA shouldn't either.
- `Ash.Error.Invalid` with field-level errors → 422, per-field.
- Rate-limit trip → 429, set by the plug before `failure/3` fires.

**HTML mode:** bare `redirect(to: "/")` for success, `redirect(to:
"/sign-in?error=generic")` for failure. No Phoenix flash — we are not
rendering the flash layout anymore.

### Email landing URLs: SPA-owned, unchanged senders

Email senders keep pointing at `/confirm_new_user/:token`,
`/magic_link/:token`, `/password-reset/:token`. After the
`confirm_route` / `magic_sign_in_route` / `reset_route` macros are
removed, the SPA catch-all serves those paths. Each SPA route
extracts `:token` from URL params, renders a Shadcn form (or a
"confirm" button for `require_interaction? true` strategies), and
fetch-POSTs the token to the corresponding `/auth/user/...` endpoint.

The reset token lives in the URL for the duration of the visit; this
is accepted. Mitigations: set `Referrer-Policy: strict-origin-when-cross-origin`
(verify current endpoint config), keep reset TTL short, rely on
single-use invalidation. No cookie handoff.

### SPA post-auth handling

On a successful POST the auth hook:

1. Reads `{user}` from the JSON body.
2. Calls `setUser(user)` on the auth context
   ([auth-context.tsx:33-40](../assets/js/lib/auth/auth-context.tsx#L33-L40)).
3. Primes the TanStack Query cache with
   `queryClient.setQueryData(currentUserKeys.detail("self"), user)`
   so `useCurrentUser()` hits the cache without a refetch.
4. Calls `router.navigate({to: parseRedirectTarget(search.redirect) ?? "/dashboard"})`.

`parseRedirectTarget(raw)` returns `raw` only if it starts with a single
`/`, does not start with `//` or `/\`, and contains no scheme. Anything
else falls back to `/dashboard`. Unit-tested. Lives next to the sign-in
route; reused by every flow that honors `?redirect=`.

No full-document navigation — we preserve the SPA's in-memory state and
the cache we just primed.

### Register flow: auto-sign-in, confirmation is housekeeping

Registration returns a session cookie and `{user}` immediately
(current behavior). The confirmation email is a "confirm when you get
a chance" follow-up. Unconfirmed users can use the app; policies on
specific actions (e.g., sending invite emails) can later require
`confirmed_at != nil` — that's a separate conversation, not this plan.

### Email enumeration on register: leak + link-back UX

We accept that `register_with_password` leaks "email already taken"
(same behavior as GitHub, Linear, Stripe dashboard, and the Ash/Phoenix
defaults). The register form translates the `{field: "email", code:
"taken"}` response into *"That email is already registered. [Sign
in](/sign-in?email=…) or [reset your password](/reset?email=…) instead."*
— a useful signpost rather than a dead-end error.

Reset and magic-link continue to hide enumeration (Ash default: both
endpoints succeed whether or not the email exists; only the email
owner learns the outcome).

Revisit trigger: if the product adds a public directory, paid tier
with real email verification, or any feature where "does X have an
account here" becomes sensitive.

### Rate limiting: dedicated pipeline, per-endpoint keys

New `GameNightWeb.Plugs.AuthRateLimiter` (PlugAttack + ETS, same
pattern as [vitals_rate_limiter.ex](../lib/game_night_web/plugs/vitals_rate_limiter.ex)).
New `:auth_browser` pipeline = `:browser` + `AuthRateLimiter`. Wraps
the `auth_routes` scope.

| Endpoint | Key | Limit |
| --- | --- | --- |
| `POST /auth/user/password/sign_in` | `auth:sign_in:ip:<ip>:email:<norm_email>` | 5 / min |
| `POST /auth/user/password/register` | `auth:register:ip:<ip>` | 3 / min |
| `POST /auth/user/password/reset_request` | `auth:reset_request:email:<norm_email>` + `auth:reset_request:ip:<ip>` | 3 / 15min per email; 20 / min per IP |
| `POST /auth/user/password/reset` | `auth:reset:ip:<ip>` | 10 / min |
| `POST /auth/user/magic_link/request` | same as `reset_request` | 3 / 15min per email; 20 / min per IP |
| `POST /auth/user/magic_link` | `auth:magic_sign_in:ip:<ip>` | 10 / min |
| `POST /auth/user/confirm_new_user` | `auth:confirm:ip:<ip>` | 10 / min |

- Endpoint-name-prefixed keys so a flood on one endpoint does not
  starve another (mirrors the `vitals:` prefix).
- Email keys are normalized with `String.downcase() |> String.trim()`
  to prevent case/whitespace evasion.
- 429 body matches the JSON failure shape: `{errors: [{field: null,
  message: "Too many attempts. Try again in Ns.", code: "rate_limited"}]}`
  plus the `retry-after` header.

### Sign-out

`sign_out_route AuthController` is replaced with a hand-written
`delete "/sign-out", AuthController, :sign_out` — the macro also
generates a GET LiveView confirmation page that would break once
`AuthOverrides` / DaisyUI come out. The DELETE is all we need.

SPA sign-out is a fetch `DELETE /sign-out` with
`Accept: application/json`. Accept-header branch:
- JSON: `conn |> clear_session(:game_night) |> json(%{ok: true})`.
  The SPA calls `clearAuth()` and `router.navigate({to: "/"})`.
- HTML: existing flash + redirect (defensive).

Audit: `clear_session/2` (two-arg form from
`AshAuthentication.Phoenix.Controller`) revokes bearer + session
tokens. The current [auth_controller.ex:52](../lib/game_night_web/controllers/auth_controller.ex#L52)
call — `clear_session(:game_night)` — pipes the conn in as the first
arg, so it's already the two-arg form via the imported function. Verify
during phase 1; if it's the deprecated one-arg form, fix it there.

CSRF: the SPA's auth hook wraps fetch with `buildCSRFHeaders()`. The
existing `createAuthedFetch` wrapper is RPC-focused and does not
attach CSRF — the auth hook's fetch path needs to include it
explicitly.

### Remember-me

Mirror existing: the sign-in and magic-link forms render an unchecked
"Keep me signed in on this device" checkbox. The form submits
`remember_me: true|false` alongside the credentials. The library's
`maybe_put_remember_me_cookies` step in the dispatcher handles the
cookie — no controller changes, no `skip_remember_me_token_generation`
flag (that was a LiveView-specific hack for the two-step handoff
we're not doing).

### Already-authenticated email-link clicks

Library default behavior: clicking a confirm/magic-link email while
signed in as a different user switches accounts on success. We accept
this. The SPA confirm landing page shows an informational banner
*"Confirming email for `<email-from-token>`"* so the user sees what
they're about to do. No forced sign-out, no special auth-state
branching.

Documented edge case: signed-in user A clicks user B's reset-password
link → reset succeeds and the SPA's `setUser()` replaces A with B.
This is correct: access to B's email implies authorization to reset
B's password.

### SPA shell and route guards

- **Unauthenticated routes** (`/sign-in`, `/register`, `/reset`,
  `/password-reset/:token`, `/magic-link`, `/magic_link/:token`,
  `/confirm_new_user/:token`) have `beforeLoad` guards that redirect
  authenticated users to `/dashboard`. Exception: the token-bearing
  routes still render for an authenticated user because the landing
  banner (above) tells them what's happening and the action may
  legitimately target a different user.
- **`/dashboard`** redirect in
  [dashboard.tsx:11-14](../assets/js/routes/dashboard.tsx#L11-L14)
  is rewritten from `href:` (full-document nav to Phoenix's old
  `/sign-in`) to `to: "/sign-in"` with a typed internal redirect.
- Every SPA auth route renders `<h1 data-route-heading>` per the
  route-change a11y contract.

### What stays, what goes

Stays:
- `auth_routes AuthController, User, path: "/auth"` — the token-exchange
  surface. All seven SPA POSTs land here.
- `delete "/sign-out", AuthController, :sign_out` (hand-written).
- `AshAuthentication.Plug.Helpers` imports — `store_in_session`,
  `clear_session/2`, etc.
- The `ash_authentication_phoenix` hex dep — the
  `AshAuthentication.Phoenix.Controller` + `AshAuthentication.Phoenix.Router`
  macros we rely on live there, even after deleting the LiveView macros.

Goes:
- `sign_in_route`, `reset_route`, `confirm_route`,
  `magic_sign_in_route`, `sign_out_route` macros at
  [router.ex:87-112](../lib/game_night_web/router.ex#L87-L112).
- [auth_overrides.ex](../lib/game_night_web/auth_overrides.ex).
- `Elixir.AshAuthentication.Phoenix.Overrides.DaisyUI` from the
  override lists.
- `ash_authentication_live_session :authenticated_routes` block
  ([router.ex:55-66](../lib/game_night_web/router.ex#L55-L66)) — it's
  currently empty and the LiveView-auth mounts it documents become
  moot.
- `live_user_auth.ex` — after phase 4, grep confirms nothing imports
  it.

### Testing

- **Vitest component tests** colocated: one per form, happy path +
  primary error branch, with `expectNoAxeViolations(container)`.
- **Playwright E2E** in `assets/e2e/`: one spec per user-visible
  flow (sign-in, register, confirm, reset, magic-link).
- **E2E mailbox access:** new dev_routes-guarded
  `GameNightWeb.TestMailboxController` with `GET /test/mailbox?to=<email>`
  (returns `{emails: [{to, subject, text_body, html_body, inserted_at}]}`)
  and `DELETE /test/mailbox` (clears storage). Reads from
  `Swoosh.Adapters.Local.Storage.Memory`. `assets/e2e/fixtures.ts`
  grows `latestEmailTo(page, email)` and `extractLinkFromEmail(email,
  hrefPrefix)` helpers.
- **MIX_ENV check:** Playwright currently runs against dev (confirmed
  via existing `/test/sign-in-as` usage). Phase 1 adds a boot-time
  assertion that `Swoosh.Adapters.Local` is the configured adapter
  whenever `:dev_routes` is enabled; if we later shift Playwright to
  `MIX_ENV=test`, the test config needs the Local adapter too.

### Bundle budget

Four new lazy-loaded route chunks (`sign-in`, `register`, `reset`,
`magic-link`) plus three token-bearing landing chunks
(`password-reset`, `magic_link`, `confirm_new_user`). TanStack Router's
`autoCodeSplitting` keeps them out of the initial bundle. Total auth
chunks ≤ 60 KB gzipped, individual form chunks ≤ 25 KB. Initial
bundle (`/`, `/dashboard`) unchanged from today's budget.

### Security posture summary

- httpOnly session cookie is the only persistent auth artifact. No
  tokens in `localStorage` / `sessionStorage`.
- CSRF on every state-changing POST via the existing meta-tag flow.
- Rate limiting on the full `auth_routes` scope.
- Open-redirect guard on `?redirect=`.
- Enumeration hidden on reset/magic-link; accepted on register with
  link-back UX.
- Tokens in URL (reset/magic-link/confirm landings) accepted; mitigated
  by short TTL, single-use, and `Referrer-Policy`.
- Deny-by-default policies unchanged. The seven auth actions remain
  reachable via `AshAuthentication.Checks.AshAuthenticationInteraction`
  ([user.ex:283-285](../lib/game_night/accounts/user.ex#L283-L285)) —
  verify in phase 1 before depending on it.

---

## Phase 1: Password sign-in + sign-out + the shared machinery

**Goal.** A user can sign in at SPA `/sign-in` and sign out via a fetch
DELETE, end to end, with rate limiting and the JSON contract in place.
Register and the email-landing flows still go through the old LiveView
screens — those come out in later phases.

### What to build

**Backend**

- `GameNightWeb.Plugs.AuthRateLimiter` (PlugAttack + ETS), rules for
  all seven auth endpoints per the table above.
- New `:auth_browser` pipeline in [router.ex](../lib/game_night_web/router.ex)
  = `:browser` + `AuthRateLimiter`. The existing `auth_routes` scope
  moves into a block that pipes through `:auth_browser`.
- `AuthController.success/4` + `failure/3` rewritten around a `case
  get_format(conn)`:
  - JSON success: `store_in_session(user) |> json(%{user: %{id: …,
    email: …}})`.
  - JSON failure: error-term → `{errors: [...]}` mapper (~30 LOC),
    status based on reason.
  - HTML success: `redirect(to: "/")`.
  - HTML failure: `redirect(to: "/sign-in?error=generic")`.
- `AuthController.sign_out/2` gains the same accept-header branch.
  Replace the `sign_out_route` macro at
  [router.ex](../lib/game_night_web/router.ex) with `delete
  "/sign-out", AuthController, :sign_out`. Verify `clear_session/2`
  is the two-arg form.
- Delete the `sign_in_route` macro at
  [router.ex:87-94](../lib/game_night_web/router.ex#L87-L94). Leave
  `reset_route`, `confirm_route`, `magic_sign_in_route` in place.
- Verify `AshAuthentication.Checks.AshAuthenticationInteraction`
  bypass still covers `sign_in_with_password` (runtime check via a
  failing test that passes post-phase).

**Frontend**

- `assets/js/features/auth/hooks.ts` — new module with `useSignIn`,
  `useSignOut` hooks. Each wraps `fetch` with `buildCSRFHeaders()` +
  `credentials: "same-origin"` + `Accept: application/json`. Error
  parsing returns a discriminated union shaped around
  `{errors: [{field, message, code}]}`.
- `assets/js/lib/auth/redirect.ts` — `parseRedirectTarget(raw)` with
  `redirect.test.ts` (same-origin, `//`, `/\`, scheme cases).
- `assets/js/routes/sign-in.tsx` — Shadcn `Form` + `Input` with
  React Hook Form + Zod. Remember-me checkbox, unchecked default.
  `beforeLoad` redirects authenticated users to
  `parseRedirectTarget(search.redirect) ?? "/dashboard"`. On submit,
  `useSignIn` → `setUser` → `queryClient.setQueryData` →
  `router.navigate`. `<h1 data-route-heading>` for a11y.
- Sign-out button in the dashboard header (single button, user menu
  is a later UX polish). Calls `useSignOut`.
- Update [dashboard.tsx:11-14](../assets/js/routes/dashboard.tsx#L11-L14)
  to use `to: "/sign-in"` typed redirect.

### Acceptance criteria

- [ ] `sign-in.test.tsx`: happy path + invalid credentials + rate-limit
      banner; `expectNoAxeViolations` called.
- [ ] `redirect.test.ts`: covers `"/foo"`, `"//evil.com"`,
      `"/\\evil.com"`, `"https://evil.com"`, `""`, `null`.
- [ ] `auth-password-sign-in.spec.ts` (Playwright): bad password →
      inline error; good password → `/dashboard`; authenticated
      `/sign-in` visit → `/dashboard`; rate-limit after 5 bad attempts.
- [ ] `auth-sign-out.spec.ts` (Playwright): signed-in user clicks sign
      out → lands on `/` unauthenticated, session cookie cleared,
      subsequent `/rpc/run` call returns 401.
- [ ] `mix ash.codegen --check` + `ash_typescript` drift check clean.
- [ ] `/sign-in` chunk < 25 KB gzipped; initial bundle unchanged.
- [ ] Axe scan on `/sign-in` returns zero violations.
- [ ] `mix precommit` + frontend gates pass.

---

## Phase 2: Register + confirmation landing

**Goal.** New users register in the SPA and land on `/dashboard`
signed in. The confirmation email's landing URL is served by the SPA
and posts to `/auth/user/confirm_new_user` to flip `confirmed_at`.

### What to build

**Backend**

- `AuthController.success/4` JSON branch for
  `{:confirm_new_user, :confirm}`: unchanged — returns `{user}`. The
  SPA handles the "email confirmed" toast based on the route it's on.
- Delete the `confirm_route` macro at
  [router.ex:104-106](../lib/game_night_web/router.ex#L104-L106).
- Verify `Referrer-Policy` header on the `/confirm_new_user/:token`
  SPA route. If the endpoint doesn't set it, add it via a targeted
  plug or the root layout.

**Frontend**

- `useRegister` hook in `features/auth/hooks.ts`. Same shape as
  `useSignIn`.
- `assets/js/routes/register.tsx`: email, password, password
  confirmation, submit. On `code: "taken"` response, show
  *"That email is already registered. [Sign in](/sign-in?email=…)
  or [reset your password](/reset?email=…) instead."* with real
  React Router links. Other validation errors mapped via the shared
  error → `react-hook-form` `setError` helper.
- `assets/js/routes/confirm_new_user.$token.tsx`: reads `params.token`,
  renders the informational banner (*"Confirming email for
  `<email-from-token-claim>`"*), shows a single "Confirm email
  address" button, posts `{confirm: params.token}` to
  `/auth/user/confirm_new_user`. On success, `setUser`, navigate to
  `/dashboard?toast=email_confirmed`. On invalid-token, show an
  error state with links back to `/sign-in` and `/register`.
- SPA toast provider: one-shot "consume whitelisted query-param toast
  keys on mount" hook (`email_confirmed`, `password_reset`,
  `signed_in`). Lives in `features/toasts/`.

**Decoding the confirmation token for the banner** — the token is a
JWT; the SPA can decode the payload (not verify — that's the
server's job) to display the email claim. A tiny `decodeJwtPayload`
helper in `lib/auth/` with a unit test. If decoding fails, fall
back to a generic *"Confirming your email address."* banner.

### Acceptance criteria

- [ ] `register.test.tsx`: happy path, mismatched passwords, taken
      email → link-back UI, server validation errors; axe clean.
- [ ] `confirm_new_user.$token.test.tsx`: rendered banner with
      decoded email; button click flow; invalid-token state; axe
      clean.
- [ ] `auth-register.spec.ts` (Playwright): register new email →
      `/dashboard`, `useCurrentUser()` resolves to the new user →
      `latestEmailTo` fetches the confirmation email → navigate to
      the link → land on `/dashboard?toast=email_confirmed` with the
      toast visible → `confirmed_at` non-null.
- [ ] Double-clicking the confirmation link: first click succeeds,
      second click shows the invalid-token state without a 500.
- [ ] Register with a taken email → link-back UI rendered with
      correct `email` query param pre-fill.
- [ ] `/register` and `/confirm_new_user/:token` chunks < 25 KB
      gzipped each.

---

## Phase 3: Password reset (request + complete)

**Goal.** Users can request a password reset at `/reset` and complete
it at the SPA-owned `/password-reset/:token`.

### What to build

**Backend**

- Delete the `reset_route` macro at
  [router.ex:97-101](../lib/game_night_web/router.ex#L97-L101).
- `AuthController.success/4` JSON branch for `{:password, :reset}`:
  returns `{user}` (user is signed in after reset — same pattern as
  sign-in). The SPA's `/password-reset/:token` route handles the
  "password reset" toast.

**Frontend**

- `useRequestPasswordReset` + `useResetPassword` hooks.
- `assets/js/routes/reset.tsx`: single-field email form. Always
  renders *"If that email has an account, we've sent reset
  instructions."* after submit — matches Ash's enumeration-hiding
  behavior. Reads `?email=` to pre-fill from the register
  link-back.
- `assets/js/routes/password-reset.$token.tsx`: new password +
  confirmation form. On submit, POSTs `{reset_token, password,
  password_confirmation}` to `/auth/user/password/reset`. Success
  → `setUser` → navigate to `/dashboard?toast=password_reset`.
  Expired-token branch: inline error + link back to `/reset`.

### Acceptance criteria

- [ ] Both route tests call `expectNoAxeViolations`.
- [ ] `auth-reset.spec.ts` (Playwright): request → email captured by
      `latestEmailTo` → navigate to link → submit new password → land
      on `/dashboard?toast=password_reset` signed in.
- [ ] Expired-token spec: request → wait past token TTL (or craft a
      stale token in a helper) → submit → inline error + recovery
      link works.
- [ ] Unknown-email `/reset` submit returns the same success message
      as a known email (no enumeration).
- [ ] Rate-limit: 3 requests in 15 min per email → 429.

---

## Phase 4: Magic link + cleanup

**Goal.** Magic link works end-to-end through the SPA; every
LiveView-shaped remnant of auth UI is deleted.

### What to build

**Backend**

- Delete the `magic_sign_in_route` macro at
  [router.ex:109-112](../lib/game_night_web/router.ex#L109-L112).
- Delete [auth_overrides.ex](../lib/game_night_web/auth_overrides.ex)
  and the `GameNightWeb.AuthOverrides` / DaisyUI override references.
- Drop the `ash_authentication_live_session :authenticated_routes`
  block at
  [router.ex:55-66](../lib/game_night_web/router.ex#L55-L66).
- Drop `live_user_auth.ex` after confirming nothing imports it.
- Keep `use AshAuthentication.Phoenix.Router` — `auth_routes` still
  expands from it.
- Keep `use AshAuthentication.Phoenix.Controller` on `AuthController`
  — `handle_success`/`handle_failure` dispatch comes from there.

**Frontend**

- `useRequestMagicLink` hook.
- `assets/js/routes/magic-link.tsx`: single-field email form. Same
  enumeration-hiding success message as `/reset`.
- `assets/js/routes/magic_link.$token.tsx`: reads token, renders
  informational banner (same JWT-decode approach as the confirm
  landing), "Sign in to Game Night" button, POSTs `{token}` to
  `/auth/user/magic_link`. Success → `setUser` → navigate to
  `/dashboard?toast=signed_in`.
- Remove any lingering DaisyUI imports from `assets/js`.

**Documentation**

- Update [AGENTS.md](../AGENTS.md) auth section to reflect the new
  flow (if a section exists).
- Update the `project_overview.md` memory to note SPA auth as the
  default.

### Acceptance criteria

- [ ] `auth-magic-link.spec.ts` (Playwright): request → email
      captured → click link → confirm informational banner visible
      → click button → `/dashboard?toast=signed_in`.
- [ ] `grep` finds no references to `AuthOverrides`,
      `DaisyUI`, `sign_in_route`, `reset_route`, `confirm_route`,
      `magic_sign_in_route`, `live_user_auth` outside the plan and
      the memory archive.
- [ ] `mix compile --warnings-as-errors` clean.
- [ ] Total auth chunks ≤ 60 KB gzipped.
- [ ] Manual accessibility audit (constitution's release gate) run
      against `/sign-in`, `/register`, `/reset`,
      `/password-reset/:token`, `/magic-link`, `/magic_link/:token`,
      `/confirm_new_user/:token`. Results logged.
- [ ] `/test/sign-in-as` continues to work — existing Playwright
      fixtures for non-auth specs do not regress.

---

## Phase 0 prep: E2E mailbox infrastructure

Landed ahead of phase 2 (which is the first phase that needs it).
Small enough to slot anywhere between phase 1 and phase 2; listed
separately so it doesn't clutter phase 2's acceptance criteria.

### What to build

- `GameNightWeb.TestMailboxController` with:
  - `GET /test/mailbox?to=<email>` →
    `{emails: [{to, subject, text_body, html_body, inserted_at}]}`,
    newest first. Reads `Swoosh.Adapters.Local.Storage.Memory.all/0`.
  - `DELETE /test/mailbox` →
    `Swoosh.Adapters.Local.Storage.Memory.delete_all/0`.
- Router entry inside the existing
  `if Application.compile_env(:game_night, :dev_routes)` block, next
  to `TestAuthController`.
- Boot-time assertion: when `:dev_routes` is enabled, the configured
  Swoosh adapter must be `Swoosh.Adapters.Local`; otherwise log a
  warning that the mailbox helpers will return empty.
- Extend [fixtures.ts](../assets/e2e/fixtures.ts) with
  `latestEmailTo(page, email)` and
  `extractLinkFromEmail(email, hrefPrefix)` helpers.

### Acceptance criteria

- [ ] `test_mailbox_controller_test.exs`: GET returns emails
      filtered by recipient, newest first; DELETE clears; only
      mounted under `:dev_routes`.
- [ ] Fixture unit smoke-test ensures the helpers work against a
      seeded email.

---

## Risks

- **`clear_session` arity.** [auth_controller.ex:52](../lib/game_night_web/controllers/auth_controller.ex#L52)
  calls `clear_session(:game_night)` piped from the conn, which is
  the imported two-arg form — but confirm under phase 1 before
  trusting. If it's silently the deprecated `Plug.Conn.clear_session/1`,
  bearer tokens aren't being revoked on sign-out today.
- **Referrer-Policy.** The token-landing routes should set a
  same-origin or strict-origin policy header. Verify the current
  endpoint config and add if missing.
- **`AshAuthentication.Phoenix.Controller` coupling.** We depend on
  `handle_success`/`handle_failure` being generated by `use
  AshAuthentication.Phoenix.Controller`. Confirmed via
  [controller.ex:186-229](../deps/ash_authentication_phoenix/lib/ash_authentication_phoenix/controller.ex#L186-L229).
  Keep the `use` line.
- **Rate-limit false positives in dev.** A developer hammering
  `/sign-in` in a tight loop will trip 429. Consider a dev-only
  bypass keyed on `remote_ip in [{127,0,0,1}, {0,0,0,0,0,0,0,1}]`
  or a higher limit for dev. Decide during phase 1.
- **Swoosh adapter mismatch.** If Playwright later runs under
  `MIX_ENV=test`, the test config's `Swoosh.Adapters.Test` has no
  `/test/mailbox`-compatible storage. Swap to `Adapters.Local` in
  test config at that point.

---

## Out of scope

- OAuth / social sign-in — no strategy configured today.
- Two-factor auth — not in the current strategy list.
- Account-settings page (change password, change email, delete
  account) — separate plan.
- Admin auth — `ash_admin` at `/admin` keeps its own session flow.
- Migrating `ash_admin` itself to the SPA.
- Email template design (the current inline HTML bodies in
  [senders/](../lib/game_night/accounts/user/senders/) stay as-is
  until a branding pass).
