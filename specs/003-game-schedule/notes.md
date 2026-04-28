# Feature 003 — Phase 12 Polish Notes

This file records the manual / out-of-band Polish tasks (T156–T160).
Automated polish (T154.5 perf benchmark, T155 size-limit, T159 sobelow,
T162 codegen) is enforced via the gate.

## T154 — Lighthouse CI budgets

**Status**: deferred. The repo has no Lighthouse CI configuration in the
tree at this time. When `lhci` is wired in (likely as a cross-feature
infra item), add budget entries for:

- `/games/$gameId/schedules/$scheduleId` (GM Schedule Detail)
- `/characters/$id/schedules/$scheduleId` (Player Schedule View)

Targets per `plan.md §VI`: TBT ≤ 200 ms, LCP ≤ 2.5 s on emulated
mobile.

## T155 — size-limit budgets

**Status**: ✅ committed in `assets/.size-limit.cjs`. Four route-chunk
budgets added per the Phase 12 task description:

| Route | Budget |
| --- | --- |
| GM schedule detail | 22 KB |
| GM schedules list | 8 KB |
| Character schedules list | 12 KB |
| Character schedule detail | 16 KB |

The harness is forgiving: `maybeRouteChunkFile` returns `null` and
`size-limit` skips the budget when the chunk is missing from the
manifest, so this pre-lands cleanly even before a fresh `bun run build`.

## T156 — axe-core/playwright on every new route

**Status**: deferred. Vitest-level axe coverage (`expectNoAxeViolations`)
already runs against the calendar / dialog / table components. The
playwright sweep against the four new routes (`/games/$gameId/schedules`,
`/games/$gameId/schedules/$scheduleId`, `/characters/$id/schedules`,
`/characters/$id/schedules/$scheduleId`) belongs with the broader e2e
infrastructure pass — no playwright runner is configured for this
feature's gate.

## T157 — manual keyboard-only audit (`<MonthCalendar>` and `<DayMatrixTable>`)

**Status**: pending — record below when run.

Checklist (Constitution Principle IV, WCAG 2.2 AA):

- [ ] All interactive cells reachable with Tab / Shift-Tab.
- [ ] Roving tabindex moves focus correctly with Arrow / Home / End.
- [ ] Locked NA cells are skipped by arrow-key traversal.
- [ ] Enter / Space triggers `onCycle` on focused cells.
- [ ] Visible focus ring on every focusable element.

## T158 — manual screen-reader smoke test

**Status**: pending — record below when run.

Tools: VoiceOver on macOS or NVDA on Windows.

Routes:

- [ ] `/games/$gameId/schedules/$scheduleId` (GM Schedule Detail).
- [ ] `/characters/$id/schedules/$scheduleId` (Player Schedule View).

Coverage:

- [ ] Heading announces correctly on route change (`data-route-heading`).
- [ ] Calendar cells announce date + status.
- [ ] Locked NA cells announce as "Host Unavailable", not "Not Available".
- [ ] Status badges announce schedule state without leaking colour-only signal.

## T159 — sobelow `--strict` review for new senders

**Status**: ✅ pass. `mix sobelow --strict` flags only the pre-existing
router-level findings (`Config.CSRF` on `:json_api_browser`,
`Config.CSP` on the four browser pipelines). None of the four new
schedule senders (`SendScheduleReadyEmail`, `SendSchedulePostedEmail`,
`SendScheduleReminderEmail`, `SendScheduleUpdatedEmail`) are flagged.
HTML-injection clearance: each sender wraps GM-supplied strings in
`Phoenix.HTML.html_escape/1` before splicing into the body.

## T160 — quickstart walkthrough

**Status**: pending — run on a clean dev DB and tick boxes in
[quickstart.md](./quickstart.md).

## T161 — dev_seed extension

**Status**: deferred. `priv/repo/dev_seed.exs` is not yet authored;
the existing `priv/repo/seeds.exs` is empty. Extending the dev seed
to materialise a sample schedule per game will land alongside the
broader dev-seed authoring task.
