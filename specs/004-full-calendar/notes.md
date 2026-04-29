# Feature 004 — Phase 6 Polish Notes

This file records the manual / out-of-band Polish tasks (T032–T034).
Automated polish (T030 size-limit, T031 a11y assertions, T035 codegen,
T036 full gate) is enforced via the gate.

## T030 — size-limit budget

**Status**: ✅ committed in `assets/.size-limit.cjs`. Budget for the
new `/calendar` route chunk is **8 KB gzipped**. The existing
`maybeRouteChunkFile` guard means the budget pre-lands cleanly even
before a fresh `bun run build`.

## T031 — route-level vitest-axe + WCAG 2.5.8 (target size)

**Status**: ✅ extended in `assets/js/routes/calendar.test.tsx`. The
empty-state test asserts zero serious / critical axe violations. A
separate test pins the prev / next / today buttons to a Tailwind size
class that produces ≥ 24×24 CSS px bounding boxes (WCAG 2.5.8).

## T032 — manual keyboard-only audit (`<EventCalendar>`)

**Status**: pending — record below when run.

Checklist (Constitution Principle IV, WCAG 2.2 AA):

- [ ] Tab into the calendar reaches the first event pill.
- [ ] Tab cycles through every event pill in DOM order.
- [ ] Enter / Space on a focused pill navigates to the right per-role
      page.
- [ ] Tab reaches the prev / next chevron buttons and the Today button.
- [ ] `+N more` chip is reachable by Tab; Enter opens the popover.
- [ ] Inside the popover, Tab cycles through every event row; Enter
      navigates and dismisses the popover.
- [ ] Escape closes the popover and returns focus to the chip.
- [ ] Visible focus ring on every focusable element.

## T033 — manual screen-reader smoke test

**Status**: pending — record below when run.

Tools: VoiceOver on macOS or NVDA on Windows.

- [ ] Heading "October 2026" announces on route change
      (`data-route-heading`).
- [ ] Each event pill announces date + game title + role (e.g.
      "November 5, Curse of Strahd, Game Master").
- [ ] `+N more` chip announces "November 5, 2 more events".
- [ ] Empty-month helper line announces as a paragraph.

## T034 — quickstart walkthrough

**Status**: pending — run on a clean dev DB and tick boxes in
[quickstart.md](./quickstart.md).

## T035 — codegen check

**Status**: ✅ pass. `mix ash.codegen --check` and
`mix ash_typescript.codegen` + `git diff --exit-code` all clean. The
new `list_schedules_for_calendar_month` RPC binding is in
`assets/js/ash_rpc.ts` and matches the contract.

## Out-of-scope (deferred, parity with feature 003)

- **Lighthouse CI run** — no `lhci` infrastructure in the tree; SC-001
  is proxied by the bundle-size budget per plan §VI.
- **Playwright e2e** — no playwright runner wired for this gate.
