# Phase 0 Research: Register Game

**Feature**: 001-register-game
**Plan**: [plan.md](./plan.md)
**Spec**: [spec.md](./spec.md)

The spec had no `[NEEDS CLARIFICATION]` markers — the three grill
rounds during planning resolved the remaining design branches
(transport, ownership naming, action granularity). This document
consolidates those decisions plus the Ash / Phoenix / React best
practices that shape the rest of the plan, so downstream phases
(`/speckit.tasks`, `/speckit.implement`) have a single reference.

## 1. API transport: JSON:API AND ash_typescript RPC

**Decision**: Expose every Game action on both surfaces. JSON:API is
the canonical contract (constitution Principle III); `AshTypescript.Rpc`
is the fast path that the SPA actually calls via the existing
`createResourceHooks` factory.

**Rationale**:

- The constitution mandates JSON:API as the public contract for every
  user-facing resource. Exempting Game would create a precedent that
  "SPA-only = no JSON:API" and compound with every subsequent feature.
- The existing `readCurrentUser` flow already uses RPC. Replacing it
  with JSON:API for Game would force the SPA's data layer to handle
  envelope normalisation for one resource and raw RPC payloads for
  another. The cost of keeping RPC is one `typescript_rpc do ... end`
  block in the domain; the benefit is zero new SPA infrastructure.
- Both surfaces route through the same Ash actions and therefore the
  same policies. There is no duplication of business logic or
  authorization — only duplication of transport wiring, which
  `ash_json_api` and `ash_typescript` generate from a single source.

**Alternatives considered**:

- **JSON:API only.** Rejected: forces the SPA to reinvent a typed
  client or normalise envelopes by hand; contradicts AGENTS.md's
  "wrap generated functions in feature-level query hooks" guidance.
- **RPC only.** Rejected: constitution violation without a
  justification that would survive the quarterly compliance review.

## 2. Ownership: `owner` / `owner_id`

**Decision**: The belongs-to relationship between Game and User is
named `owner` (FK: `owner_id`). The attribute is immutable after
create (excluded from the `:update` action's `accept` list).

**Rationale**:

- Domain-semantic; reads naturally in policy expressions
  (`expr(owner_id == ^actor(:id))`) and in JSON:API relationship URLs
  (`/games/:id/relationships/owner`).
- Leaves the `user` / `users` naming space free for future
  relationships (players, co-GMs, organizers) that also point at the
  User resource — the spec's parent project overview hints at those.
- Matches standard Ash idiom for "the principal user of a
  user-owned resource".

**Alternatives considered**: `user_id` (framework default, but
collides with future role relationships); `game_master_id` (encodes
a role name in the relationship, obscures that any authenticated
user who owns a game is its GM by definition).

## 3. Action granularity: named actions per read shape

**Decision**: Define distinct named actions for each read shape the
SPA needs, plus a single named write for each mutation.

```elixir
actions do
  defaults [:read]

  read :list_mine_active do
    prepare build(filter: [status: :active], sort: [updated_at: :desc])
  end

  read :list_mine do
    prepare build(sort: [updated_at: :desc])
  end

  read :get_mine do
    get? true
    argument :id, :uuid, allow_nil?: false
    filter expr(id == ^arg(:id))
  end

  create :register do
    accept [:title, :description, :status]
    change relate_actor(:owner)
  end

  update :update do
    accept [:title, :description, :status]
    require_atomic? true
  end

  destroy :destroy
end
```

**Rationale**:

- Each SPA surface maps 1:1 to an action and therefore to a policy
  block. "What can this caller do?" is answered by reading the policy
  section alone.
- `ash_typescript` generates stronger types when actions are named
  and have known filter shapes — `listMineActive()` is typed as
  returning `Game[]` with no accepted filter arguments, while a
  generic `read` accepting arbitrary filter maps is weakly typed.
- Tests map naturally: one policy test per action, with the
  authorized path and the unauthorized (different-owner) path each
  exercised explicitly.
- `require_atomic? true` on update gives us SQL-level atomicity
  without a read-then-write round trip, since all Game fields are
  direct attribute writes.

**Alternatives considered**:

- **Single base `:read` with client-passed filters.** Rejected:
  pushes filter correctness onto the caller, produces weaker types,
  and proliferates policy edge cases ("what if the client passes
  `filter[owner_id]=<other-user>`?").
- **Hybrid (named reads, default writes).** Viable but wastes the
  naming opportunity on `:register` — the word `register` matches
  the feature name and makes the domain read better than `:create`.

## 4. Status as atom with `one_of` constraint (matches existing pattern)

**Decision**:
```elixir
attribute :status, :atom do
  allow_nil? false
  public? true
  default :active
  constraints one_of: [:active, :paused, :cancelled, :completed]
end
```

**Rationale**: Matches the established pattern from `PageMetric`
(`metric_name` and `rating` both use this shape). The shared-module
constant approach (`@statuses [:active, :paused, :cancelled, :completed]`)
means the SPA form's Zod schema can import the list via a generated
TypeScript enum from `ash_typescript`.

**Alternatives considered**:

- **`Ash.Type.Enum` module** (`GameNight.Games.GameStatus`) — cleaner
  long-term home for display labels and i18n, but introduces a new
  pattern this codebase has not used yet. Can be introduced later
  as a refactor if display copy multiplies.

## 5. Policy structure: deny-by-default with per-action expressions

**Decision**:

```elixir
policies do
  policy action_type(:read) do
    authorize_if expr(owner_id == ^actor(:id))
  end

  policy action(:register) do
    authorize_if actor_present()
  end

  policy action_type([:update, :destroy]) do
    authorize_if expr(owner_id == ^actor(:id))
  end
end
```

**Rationale**:

- Deny-by-default: Ash.Policy.Authorizer rejects any action without a
  matching `authorize_if` clause.
- The `:read` policy's `expr(owner_id == ^actor(:id))` is evaluated
  per-row; named reads inherit it because they build on
  `action_type(:read)`.
- `:register` uses `actor_present()` rather than an ownership check
  because the row does not exist yet; `change relate_actor(:owner)`
  sets `owner_id` atomically in the same transaction.
- `:update` and `:destroy` share a policy because both pivot on the
  same ownership check.

**Test shape**: for each action, exactly one authorized test ("the
owner can …") and one forbidden test ("a different user cannot …"),
plus an unauthenticated test ("an anonymous request is rejected").
Constitution Principle I says policy tests must cover both paths
explicitly — this covers the bar.

**Alternatives considered**:

- **Single policy `always()` + per-action filters.** Rejected:
  weaker tests (they can miss a filter gap without failing),
  harder to reason about.
- **Admin bypass via role check.** Out of scope for v1. If/when an
  admin role is introduced, a `bypass Ash.Policy.Check.RoleAdmin do
  authorize_if always() end` added ahead of the per-action policies
  is the canonical extension point.

## 6. Form stack and delete confirmation modal

**Decision**:

- **Form**: React Hook Form + Zod + Shadcn `<Form>` + `FormField`,
  mirroring the auth routes (per AGENTS.md). The shared Zod schema
  lives in `assets/js/features/games/schemas.ts` and is imported by
  both `games.new.tsx` and `games.$id.edit.tsx` so the create and
  edit forms validate identically.
- **Modal**: Shadcn `<Dialog>` (Radix under the hood). Three new
  Shadcn primitives copied into `assets/js/components/ui/` —
  `dialog.tsx`, `table.tsx`, `select.tsx`, and `textarea.tsx`
  (select for the status field, textarea for the description).
- **Typed-confirmation**: the modal owns a controlled input that
  disables the confirm button until the input exactly equals
  `"delete"`. Case-sensitive, no whitespace trimming. Unit-tested in
  `delete-game-dialog.test.tsx` with each near-miss
  (`"Delete"`, `"delete "`, `""`) asserting the button is disabled.

**Rationale**:

- Radix `<Dialog>` handles focus trap, backdrop dismiss, Escape-to-
  close, and focus restoration to the trigger — the four pieces
  constitution Principle IV requires for a confirmation modal.
- Reusing the auth form stack keeps the SPA's forms coherent; the
  mirrored-layout requirement (FR-013) is easy to satisfy because
  the view page renders the same `<Label>` + read-only block with
  identical spacing to the edit form's `<FormField>`.

**Alternatives considered**:

- **Custom modal primitive.** Rejected — Radix-under-Shadcn is the
  established pattern; bespoke modals regress a11y (constitution
  Principle IV explicitly calls out this failure mode).
- **Native `<dialog>` element.** Viable for simple cases but lacks
  the focus-trap management we want and styling is awkward.

## 7. Mirrored view/edit layout technique

**Decision**: The view page renders each field inside a labelled
region identical in position, padding, and typography to the edit
form's corresponding `<FormField>`. The difference is that the view
page shows static text where the form shows an input; no horizontal
shift, no reflowing.

**Implementation hint for `/speckit.tasks`**: factor a
`<GameFieldRow>` primitive that both pages render. In view mode it
renders `<dt>` + `<dd>`; in edit mode it wraps a Shadcn
`<FormField>`. The primitive owns the grid layout.

**Rationale**: FR-013 and SC-004. Mirroring is a concrete
implementation technique; the primitive centralises the layout so
drift between view and edit cannot happen.

## 8. Empty-state copy and the "no Active games but I have Paused ones" edge case

**Decision**: The dashboard empty state is a discriminated component
driven by a single flag:

```tsx
type DashboardGamesState =
  | { kind: "no_games_at_all" }
  | { kind: "no_active_games"; totalCount: number }
  | { kind: "has_active_games"; games: Game[] };
```

The first two variants render different copy and CTAs per
spec Edge Cases:

- `no_games_at_all`: "You haven't registered a game yet." with one
  CTA linking to `/games/new`.
- `no_active_games`: "No Active games — you have N games in other
  statuses." with two CTAs, one to `/games/new` and one to `/games`.
- `has_active_games`: the table.

**Rationale**: computing the flag in the hook (`useDashboardGames`)
rather than the component keeps the component render pure and
easy to test. The hook calls `list_mine_active` for the table rows
and `list_mine` for the total count when the active list is empty.

**Alternatives considered**:

- **Always query `list_mine` and filter client-side.** Rejected:
  grows linearly with the user's history.
- **Expose a dedicated `:count_mine` action.** Rejected: Ash's
  default `list_mine` is already scoped to the owner, so fetching
  all rows when the active set is empty is a known small query
  (per spec Assumption: at most a few dozen games per GM in v1).

## 9. Telemetry and performance instrumentation

**Decision**: The feature emits Ash's standard action telemetry; no
custom spans. The `list_mine_active` action is the hottest path
(dashboard renders on every sign-in) and gets an index to keep its
p95 stable.

- Postgres index (declared in the Ash resource's `postgres do` block):
  `(owner_id, status, updated_at DESC)`. This makes the dashboard
  read index-only for `list_mine_active`.
- Frontend: the new route chunks are tracked by the existing
  `size-limit` config (constitution Principle VI).

**Rationale**: Mirrors the PageMetric resource's minimal-telemetry
posture; the composite index matches the filter + sort shape
exactly, so PostgreSQL can satisfy both the WHERE clause and ORDER
BY without touching the heap.

## 10. Agent context update (CLAUDE.md)

**Decision**: Update the pointer between the `<!-- SPECKIT START -->`
and `<!-- SPECKIT END -->` markers in `CLAUDE.md` to reference this
plan. This is the standard Phase 1 agent-context update per the
speckit plan template.

**Rationale**: Downstream agents invoked by `/speckit.tasks` and
`/speckit.implement` need a canonical pointer to the current feature
plan; the SPECKIT marker block is the agreed location.
