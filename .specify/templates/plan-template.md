# Implementation Plan: [FEATURE]

**Branch**: `[###-feature-name]` | **Date**: [DATE] | **Spec**: [link]
**Input**: Feature specification from `/specs/[###-feature-name]/spec.md`

**Note**: This template is filled in by the `/speckit.plan` command. See `.specify/templates/plan-template.md` for the execution workflow.

## Summary

[Extract from feature spec: primary requirement + technical approach from research]

## Technical Context

<!--
  ACTION REQUIRED: Replace the content in this section with the technical details
  for the project. The structure here is presented in advisory capacity to guide
  the iteration process.
-->

**Language/Version**: [e.g., Python 3.11, Swift 5.9, Rust 1.75 or NEEDS CLARIFICATION]  
**Primary Dependencies**: [e.g., FastAPI, UIKit, LLVM or NEEDS CLARIFICATION]  
**Storage**: [if applicable, e.g., PostgreSQL, CoreData, files or N/A]  
**Testing**: [e.g., pytest, XCTest, cargo test or NEEDS CLARIFICATION]  
**Target Platform**: [e.g., Linux server, iOS 15+, WASM or NEEDS CLARIFICATION]
**Project Type**: [e.g., library/cli/web-service/mobile-app/compiler/desktop-app or NEEDS CLARIFICATION]  
**Performance Goals**: [domain-specific, e.g., 1000 req/s, 10k lines/sec, 60 fps or NEEDS CLARIFICATION]  
**Constraints**: [domain-specific, e.g., <200ms p95, <100MB memory, offline-capable or NEEDS CLARIFICATION]  
**Scale/Scope**: [domain-specific, e.g., 10k users, 1M LOC, 50 screens or NEEDS CLARIFICATION]

## Constitution Check

*GATE: Must pass before Phase 0 research. Re-check after Phase 1 design.*

Address each principle explicitly. Mark PASS, N/A, or VIOLATION.
Any VIOLATION requires an entry in the Complexity Tracking table below.

- **I. Test-First Development (NON-NEGOTIABLE)**: How will strict
  red-green-refactor be applied? Which specific test frameworks
  (ExUnit, Vitest, Playwright) and test layers (policy, action,
  JSON:API request, component, E2E) are in scope?
- **II. Security & Authorization by Default (NON-NEGOTIABLE)**: Which
  Ash resources are touched? For each, what policies are defined or
  updated? Does this feature introduce new trust boundaries, new
  secrets, or new dependencies (triggering Trivy / Sobelow /
  mix_audit / npm audit / gitleaks attention)? Does any code path
  write via `Ecto.Repo` directly rather than an Ash code interface —
  if so, is the exception justified and marked? Does the feature
  introduce or change authentication flows — if so, are tokens
  delivered via httpOnly cookies with CSRF protection, and are
  access tokens kept in memory only?
- **III. API Contract via JSON:API (NON-NEGOTIABLE)**: Which Ash
  resource `json_api` blocks are added or changed? Are OpenAPI and
  `ash_typescript`-generated frontend types regenerated? Are any
  breaking contract changes called out? Does the feature stay within
  pure-SPA boundaries (no RSC/SSR)?
- **IV. Accessibility — WCAG 2.2 AA (NON-NEGOTIABLE)**: Which routes
  / components are added or changed? How will axe-core run against
  them in CI? For new routes, is route-change focus management
  wired (focus moves to `<h1>`, polite live-region announcement)?
  Are the three WCAG 2.2 new AA criteria (2.4.11 Focus Not Obscured,
  2.5.7 Dragging Movements, 2.5.8 Target Size ≥24×24 CSS px)
  addressed? What manual keyboard / screen-reader checks are
  planned before release?
- **V. UX for Non-Technical Operators**: Are loading, empty, and
  error states specified for every new interaction? Is copy free of
  engineering jargon? Are destructive actions confirmable and
  reversible?
- **VI. Performance Discipline**: What are the target LCP/INP/CLS
  thresholds for new routes? What bundle-size impact is expected?
  Which JSON:API actions emit telemetry, and what is the expected
  p95 latency?

## Project Structure

### Documentation (this feature)

```text
specs/[###-feature]/
├── plan.md              # This file (/speckit.plan command output)
├── research.md          # Phase 0 output (/speckit.plan command)
├── data-model.md        # Phase 1 output (/speckit.plan command)
├── quickstart.md        # Phase 1 output (/speckit.plan command)
├── contracts/           # Phase 1 output (/speckit.plan command)
└── tasks.md             # Phase 2 output (/speckit.tasks command - NOT created by /speckit.plan)
```

### Source Code (repository root)
<!--
  ACTION REQUIRED: Replace the placeholder tree below with the concrete layout
  for this feature. Delete unused options and expand the chosen structure with
  real paths (e.g., apps/admin, packages/something). The delivered plan must
  not include Option labels.
-->

```text
# [REMOVE IF UNUSED] Option 1: Single project (DEFAULT)
src/
├── models/
├── services/
├── cli/
└── lib/

tests/
├── contract/
├── integration/
└── unit/

# [REMOVE IF UNUSED] Option 2: Web application (when "frontend" + "backend" detected)
backend/
├── src/
│   ├── models/
│   ├── services/
│   └── api/
└── tests/

frontend/
├── src/
│   ├── components/
│   ├── pages/
│   └── services/
└── tests/

# [REMOVE IF UNUSED] Option 3: Mobile + API (when "iOS/Android" detected)
api/
└── [same as backend above]

ios/ or android/
└── [platform-specific structure: feature modules, UI flows, platform tests]
```

**Structure Decision**: [Document the selected structure and reference the real
directories captured above]

## Complexity Tracking

> **Fill ONLY if Constitution Check has violations that must be justified**

| Violation | Why Needed | Simpler Alternative Rejected Because |
|-----------|------------|-------------------------------------|
| [e.g., 4th project] | [current need] | [why 3 projects insufficient] |
| [e.g., Repository pattern] | [specific problem] | [why direct DB access insufficient] |
