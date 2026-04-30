<!-- SPECKIT START -->
Current feature plan: [specs/004-full-calendar/plan.md](specs/004-full-calendar/plan.md)
Supporting artifacts: [spec.md](specs/004-full-calendar/spec.md),
[research.md](specs/004-full-calendar/research.md),
[data-model.md](specs/004-full-calendar/data-model.md),
[contracts/](specs/004-full-calendar/contracts/),
[quickstart.md](specs/004-full-calendar/quickstart.md).
<!-- SPECKIT END -->

## Design source of truth

Designs and the Adventurer's Journal design system live in **Stitch**:

- **Project**: `Game Night Inventory PRD` (id `7276677696696946035`)
- **Active design system**: `Game Night` (asset
  `assets/677c99224d364385990e49810f4c2a94`) — parchment surface,
  forest-green primary, burnt-orange secondary, gold tertiary;
  Noto Serif headlines + Be Vietnam Pro body.

When asked to surface designs, screens, or design-system tokens for
this app, use the Stitch MCP tools against that project id.
Component tokens consumed by the SPA live in
[`assets/css/app.css`](assets/css/app.css); the M3-flavoured palette
is captured under `--gn-*` custom properties with shadcn's semantic
tokens (`--background`, `--primary`, …) routed onto the right slot.
