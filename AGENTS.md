This is a web application written using the Phoenix web framework.

## Project guidelines

- Use `mix precommit` alias when you are done with all changes and fix any pending issues
- Use the already included and available `:req` (`Req`) library for HTTP requests, **avoid** `:httpoison`, `:tesla`, and `:httpc`. Req is included by default and is the preferred HTTP client for Phoenix apps

### Phoenix v1.8 guidelines

- **Always** begin your LiveView templates with `<Layouts.app flash={@flash} ...>` which wraps all inner content
- The `MyAppWeb.Layouts` module is aliased in the `my_app_web.ex` file, so you can use it without needing to alias it again
- Anytime you run into errors with no `current_scope` assign:
  - You failed to follow the Authenticated Routes guidelines, or you failed to pass `current_scope` to `<Layouts.app>`
  - **Always** fix the `current_scope` error by moving your routes to the proper `live_session` and ensure you pass `current_scope` as needed
- Phoenix v1.8 moved the `<.flash_group>` component to the `Layouts` module. You are **forbidden** from calling `<.flash_group>` outside of the `layouts.ex` module
- Out of the box, `core_components.ex` imports an `<.icon name="hero-x-mark" class="w-5 h-5"/>` component for hero icons. **Always** use the `<.icon>` component for icons, **never** use `Heroicons` modules or similar
- **Always** use the imported `<.input>` component for form inputs from `core_components.ex` when available. `<.input>` is imported and using it will save steps and prevent errors
- If you override the default input classes (`<.input class="myclass px-2 py-1 rounded-lg">)`) class with your own values, no default classes are inherited, so your
custom classes must fully style the input

### JS and CSS guidelines

- **Use Tailwind CSS classes and custom CSS rules** to create polished, responsive, and visually stunning interfaces.
- Tailwindcss v4 **no longer needs a tailwind.config.js** and uses a new import syntax in `app.css`:

      @import "tailwindcss" source(none);
      @source "../css";
      @source "../js";
      @source "../../lib/my_app_web";

- **Always use and maintain this import syntax** in the app.css file for projects generated with `phx.new`
- **Never** use `@apply` when writing raw css
- **Always** manually write your own tailwind-based components instead of using daisyUI for a unique, world-class design
- Out of the box **only the app.js and app.css bundles are supported**
  - You cannot reference an external vendor'd script `src` or link `href` in the layouts
  - You must import the vendor deps into app.js and app.css to use them
  - **Never write inline <script>custom js</script> tags within templates**

### UI/UX & design guidelines

- **Produce world-class UI designs** with a focus on usability, aesthetics, and modern design principles
- Implement **subtle micro-interactions** (e.g., button hover effects, and smooth transitions)
- Ensure **clean typography, spacing, and layout balance** for a refined, premium look
- Focus on **delightful details** like hover effects, loading states, and smooth page transitions

## Constitution

The project constitution at `.specify/memory/constitution.md` governs development standards (TDD, Ash policies, JSON:API, WCAG 2.2 AA, performance, security gates). These runtime guidelines implement it; when the two disagree, the constitution wins.

## Ash runtime guidelines

- **Call code interfaces on the domain, never the data layer directly.** `MyApp.Games.register_player!/1` is correct; `Repo.insert(%Player{...})` bypasses policies, validations, changes, and notifications and is forbidden per the constitution (Principle II) outside data migrations and named reporting modules.
- **Use `Ash.Query.load/2` to prevent N+1.** This is the Ash analog of `Ecto.preload`. Nested loads (`load: [games: [:players, :gm]]`) flatten into efficient queries.
- **Prefer aggregates over calculations** for count/sum/exists over a relationship — aggregates push to SQL and are filterable/sortable. Calculations written with `expr(...)` also push to SQL; Elixir-function calculations run per-record, so know which you wrote.
- **Pagination: keyset over offset.** Declare read actions with `paginate?: true, keyset?: true`. Offset pagination is unstable under concurrent writes.
- **Bulk operations use `Ash.bulk_create/2`, `Ash.bulk_update/2`, `Ash.bulk_destroy/2`** — looping `Ash.create/2` in a `for` is an N-times performance bug.
- **Drop to raw Ecto only for reports, analytics, and bulk reads that don't fit Ash.** Put them in a clearly named read-only module (e.g., `MyApp.Reports.*`); they are exempt from the Ash-only rule but MUST NOT be reachable from user-facing write paths.
- **Policies**: prefer `bypass` blocks over `authorize_if always()` at the top of a policy — `bypass` short-circuits cleanly and is auditable. Prefer `FilterCheck`/`SimpleCheck` modules over inline `expr(...)` once a check is reused.
- **Let actions authorize**; call `Ash.can?/3` only to drive UI affordances (show/hide buttons), never to gate writes in application code.
- **Migrations**: run `mix ash.codegen <name>` — do not write migrations by hand except for data migrations. Commit the updated `priv/resource_snapshots/` along with the migration. CI runs `mix ash.codegen --check` to catch drift.
- **Sobelow false positives** on Ash-generated code are expected. Maintain `.sobelow-conf` allowlists with comments explaining each exemption.

## TanStack Query runtime guidelines

- **Override the default `staleTime`.** The `QueryClient` default (`staleTime: 0`) causes refetch storms. Set a sensible global default (30s–5min) and override per-query as needed. This is TkDodo's most-repeated warning.
- **Query keys via hierarchical factories**, per feature. Example: `const gameKeys = { all: ['games'] as const, lists: () => [...gameKeys.all, 'list'] as const, list: (f: Filters) => [...gameKeys.lists(), f] as const, detail: (id: string) => [...gameKeys.all, 'detail', id] as const }`. Invalidate `gameKeys.lists()` to refresh all lists; `gameKeys.detail(id)` to refresh one.
- **Server state in Query, client state elsewhere.** Do not store server-derived data in Zustand, Jotai, or `useState`. Query is the server-state store.
- **Invalidate rather than `setQueryData`** unless you have the full, authoritative server shape to write. Invalidation is correct by construction; `setQueryData` risks drift.
- **`placeholderData: keepPreviousData`** (v5 API) for pagination and filtering to avoid flicker.
- **Optimistic UI**: for single-screen optimism, read `mutation.variables` in render rather than touching the cache via `onMutate`/rollback. Simpler and drift-proof. Reserve the full `onMutate`/`onError`/`onSettled` dance for multi-screen optimism.
- **Route loaders own fetching**: `loader: ({ context }) => context.queryClient.ensureQueryData(queryOptions)` then `useSuspenseQuery(queryOptions)` in the component. Do not mix `useQuery` and `useSuspenseQuery` for the same key in the same tree.

## TanStack Router runtime guidelines

- **File-based routes** are the default; `routeTree.gen.ts` is committed.
- **Typed navigation only**: `<Link to="/games/$gameId" params={{ gameId }}>`. Do not pass hand-rolled route strings; the type system is the whole point.
- **Search params are state**: declare with `validateSearch: zodSearchValidator(schema)`, read via `useSearch({ from: ... })`. Do not add `nuqs` or similar for router-owned state.
- **Auth guards in `beforeLoad`**, throwing `redirect({ to: '/login', search: { redirect: location.href } })`. Never gate in component render — it flashes protected content.
- **Keep `preload: 'intent'` on.** Free perceived-performance win.
- **Per-route `errorComponent` and `pendingComponent`** for scoped error boundaries and suspense fallbacks. Avoid wrapping the whole app in one global `<ErrorBoundary>`.
- **Route-change focus & announce**: the app provides a single shared focus-on-navigation helper (per constitution Principle IV). Every new route MUST opt into it — do not reinvent the mechanism per route.

## React runtime guidelines

- **React Compiler is on.** Do not hand-roll `useMemo`/`useCallback`/`React.memo` unless the ESLint plugin (`eslint-plugin-react-compiler`) flags that a given file opts out. Trust the compiler first; measure before memoizing manually.
- **Colocate state at the lowest common ancestor.** Reach for Zustand only for genuinely cross-cutting client state (theme, command palette, ephemeral UI).
- **Forms**: React Hook Form + Zod via `@hookform/resolvers/zod`, wrapped in Shadcn's `<Form>` component. Shadcn's `FormField` / `FormMessage` wires `aria-invalid` and `aria-describedby` correctly — do not bypass it.
- **Validation timing**: `mode: 'onTouched'` (validate `onBlur` first, then `onChange` after first error). `onChange` from empty state punishes mid-typing and is a UX defect per constitution Principle V.

## Shadcn UI runtime guidelines

- **Copy-paste, not npm dependency.** Components live in `assets/js/components/ui/` and you own them. Customize by editing the copied file.
- **`cn()` utility** (= `clsx` + `tailwind-merge`) for every conditional class name combination.
- **Theme via CSS custom properties** in `:root` / `.dark` referenced as `hsl(var(--primary))`. Do not fork component files to re-theme.
- **Radix primitives underneath are accessible by default** (Dialog focus trap, Menu roving tabindex). Do not replace Radix parts casually — you will regress a11y.
- **Verify icon-button sizes against WCAG 2.5.8** (≥24×24 CSS px). Shadcn's default is borderline.

## API client integration (ash_typescript)

- **Wrap generated functions in feature-level query hooks** — never call the generated client directly from components. Create `useGame(id)` that calls the generated function inside `useQuery`.
- **Normalize JSON:API envelopes in the `queryFn`** so components see flat objects. Don't leak `data`/`attributes`/`relationships` into the UI.
- **Map errors to a discriminated union** in the `queryFn` so `error` is narrow in components.
- **Never hand-edit generated files.** Regenerate via `mix ash_typescript.codegen`; CI fails on drift.

## Frontend test guidelines

- **Every component test that renders DOM MUST call `expectNoAxeViolations(container)`** at least once on its rendered output (import from `@/test/a11y`). Phase 3's `index.test.tsx` and `dashboard.test.tsx` plus Phase 2's `announcer.test.tsx` are the reference shape. The axe check is how we keep WCAG 2.2 AA a living gate instead of a pre-merge ritual — it fires on every run and surfaces regressions the moment a new component lands. If a test renders markup and skips the helper, reviewers should block the PR.
- **Exempt categories**: tests that only exercise hooks or pure logic (Vitest `renderHook`, MSW-driven reducer tests, the reporter/ash_typescript unit tests) don't render visual DOM and are exempt. If a "hook" test adds a small visual probe component just to read context, add `expectNoAxeViolations(container)` anyway — the cost is negligible and the probe still renders.
- **Enforcement today** is code review + this checklist. A custom ESLint rule is feasible (scan for `render(` without an accompanying `expectNoAxeViolations(`), but we haven't found the upkeep worthwhile yet given the small test surface. Revisit if drift appears.

## Authentication runtime guidelines

- **Session/refresh tokens**: httpOnly + Secure + SameSite=Lax cookies (or stricter). Set via `Plug.Conn.put_resp_cookie/4`.
- **Access tokens**: in memory only (module-level variable in the generated client or an auth context). Never to `localStorage`/`sessionStorage`.
- **401 interceptor** in the client: attempt one silent refresh; on second 401, clear auth state and `router.navigate({ to: '/login', search: { redirect: currentPath } })`.
- **CSRF**: Phoenix's `:protect_from_forgery` plug on mutation pipelines; JSON:API mutation requests MUST send the CSRF token header. Do not disable CSRF to "just make it work" during development.

<!-- usage-rules-start -->

<!-- phoenix:elixir-start -->
## Elixir guidelines

- Elixir lists **do not support index based access via the access syntax**

  **Never do this (invalid)**:

      i = 0
      mylist = ["blue", "green"]
      mylist[i]

  Instead, **always** use `Enum.at`, pattern matching, or `List` for index based list access, ie:

      i = 0
      mylist = ["blue", "green"]
      Enum.at(mylist, i)

- Elixir variables are immutable, but can be rebound, so for block expressions like `if`, `case`, `cond`, etc
  you *must* bind the result of the expression to a variable if you want to use it and you CANNOT rebind the result inside the expression, ie:

      # INVALID: we are rebinding inside the `if` and the result never gets assigned
      if connected?(socket) do
        socket = assign(socket, :val, val)
      end

      # VALID: we rebind the result of the `if` to a new variable
      socket =
        if connected?(socket) do
          assign(socket, :val, val)
        end

- **Never** nest multiple modules in the same file as it can cause cyclic dependencies and compilation errors
- **Never** use map access syntax (`changeset[:field]`) on structs as they do not implement the Access behaviour by default. For regular structs, you **must** access the fields directly, such as `my_struct.field` or use higher level APIs that are available on the struct if they exist, `Ecto.Changeset.get_field/2` for changesets
- Elixir's standard library has everything necessary for date and time manipulation. Familiarize yourself with the common `Time`, `Date`, `DateTime`, and `Calendar` interfaces by accessing their documentation as necessary. **Never** install additional dependencies unless asked or for date/time parsing (which you can use the `date_time_parser` package)
- Don't use `String.to_atom/1` on user input (memory leak risk)
- Predicate function names should not start with `is_` and should end in a question mark. Names like `is_thing` should be reserved for guards
- Elixir's builtin OTP primitives like `DynamicSupervisor` and `Registry`, require names in the child spec, such as `{DynamicSupervisor, name: MyApp.MyDynamicSup}`, then you can use `DynamicSupervisor.start_child(MyApp.MyDynamicSup, child_spec)`
- Use `Task.async_stream(collection, callback, options)` for concurrent enumeration with back-pressure. The majority of times you will want to pass `timeout: :infinity` as option

## Mix guidelines

- Read the docs and options before using tasks (by using `mix help task_name`)
- To debug test failures, run tests in a specific file with `mix test test/my_test.exs` or run all previously failed tests with `mix test --failed`
- `mix deps.clean --all` is **almost never needed**. **Avoid** using it unless you have good reason

## Test guidelines

- **Always use `start_supervised!/1`** to start processes in tests as it guarantees cleanup between tests
- **Avoid** `Process.sleep/1` and `Process.alive?/1` in tests
  - Instead of sleeping to wait for a process to finish, **always** use `Process.monitor/1` and assert on the DOWN message:

      ref = Process.monitor(pid)
      assert_receive {:DOWN, ^ref, :process, ^pid, :normal}

   - Instead of sleeping to synchronize before the next call, **always** use `_ = :sys.get_state/1` to ensure the process has handled prior messages
<!-- phoenix:elixir-end -->

<!-- phoenix:phoenix-start -->
## Phoenix guidelines

- Remember Phoenix router `scope` blocks include an optional alias which is prefixed for all routes within the scope. **Always** be mindful of this when creating routes within a scope to avoid duplicate module prefixes.

- You **never** need to create your own `alias` for route definitions! The `scope` provides the alias, ie:

      scope "/admin", AppWeb.Admin do
        pipe_through :browser

        live "/users", UserLive, :index
      end

  the UserLive route would point to the `AppWeb.Admin.UserLive` module

- `Phoenix.View` no longer is needed or included with Phoenix, don't use it
<!-- phoenix:phoenix-end -->


<!-- phoenix:html-start -->
## Phoenix HTML guidelines

- Phoenix templates **always** use `~H` or .html.heex files (known as HEEx), **never** use `~E`
- **Always** use the imported `Phoenix.Component.form/1` and `Phoenix.Component.inputs_for/1` function to build forms. **Never** use `Phoenix.HTML.form_for` or `Phoenix.HTML.inputs_for` as they are outdated
- When building forms **always** use the already imported `Phoenix.Component.to_form/2` (`assign(socket, form: to_form(...))` and `<.form for={@form} id="msg-form">`), then access those forms in the template via `@form[:field]`
- **Always** add unique DOM IDs to key elements (like forms, buttons, etc) when writing templates, these IDs can later be used in tests (`<.form for={@form} id="product-form">`)
- For "app wide" template imports, you can import/alias into the `my_app_web.ex`'s `html_helpers` block, so they will be available to all LiveViews, LiveComponent's, and all modules that do `use MyAppWeb, :html` (replace "my_app" by the actual app name)

- Elixir supports `if/else` but **does NOT support `if/else if` or `if/elsif`**. **Never use `else if` or `elseif` in Elixir**, **always** use `cond` or `case` for multiple conditionals.

  **Never do this (invalid)**:

      <%= if condition do %>
        ...
      <% else if other_condition %>
        ...
      <% end %>

  Instead **always** do this:

      <%= cond do %>
        <% condition -> %>
          ...
        <% condition2 -> %>
          ...
        <% true -> %>
          ...
      <% end %>

- HEEx require special tag annotation if you want to insert literal curly's like `{` or `}`. If you want to show a textual code snippet on the page in a `<pre>` or `<code>` block you *must* annotate the parent tag with `phx-no-curly-interpolation`:

      <code phx-no-curly-interpolation>
        let obj = {key: "val"}
      </code>

  Within `phx-no-curly-interpolation` annotated tags, you can use `{` and `}` without escaping them, and dynamic Elixir expressions can still be used with `<%= ... %>` syntax

- HEEx class attrs support lists, but you must **always** use list `[...]` syntax. You can use the class list syntax to conditionally add classes, **always do this for multiple class values**:

      <a class={[
        "px-2 text-white",
        @some_flag && "py-5",
        if(@other_condition, do: "border-red-500", else: "border-blue-100"),
        ...
      ]}>Text</a>

  and **always** wrap `if`'s inside `{...}` expressions with parens, like done above (`if(@other_condition, do: "...", else: "...")`)

  and **never** do this, since it's invalid (note the missing `[` and `]`):

      <a class={
        "px-2 text-white",
        @some_flag && "py-5"
      }> ...
      => Raises compile syntax error on invalid HEEx attr syntax

- **Never** use `<% Enum.each %>` or non-for comprehensions for generating template content, instead **always** use `<%= for item <- @collection do %>`
- HEEx HTML comments use `<%!-- comment --%>`. **Always** use the HEEx HTML comment syntax for template comments (`<%!-- comment --%>`)
- HEEx allows interpolation via `{...}` and `<%= ... %>`, but the `<%= %>` **only** works within tag bodies. **Always** use the `{...}` syntax for interpolation within tag attributes, and for interpolation of values within tag bodies. **Always** interpolate block constructs (if, cond, case, for) within tag bodies using `<%= ... %>`.

  **Always** do this:

      <div id={@id}>
        {@my_assign}
        <%= if @some_block_condition do %>
          {@another_assign}
        <% end %>
      </div>

  and **Never** do this – the program will terminate with a syntax error:

      <%!-- THIS IS INVALID NEVER EVER DO THIS --%>
      <div id="<%= @invalid_interpolation %>">
        {if @invalid_block_construct do}
        {end}
      </div>
<!-- phoenix:html-end -->

<!-- phoenix:liveview-start -->
## Phoenix LiveView guidelines

- **Never** use the deprecated `live_redirect` and `live_patch` functions, instead **always** use the `<.link navigate={href}>` and  `<.link patch={href}>` in templates, and `push_navigate` and `push_patch` functions LiveViews
- **Avoid LiveComponent's** unless you have a strong, specific need for them
- LiveViews should be named like `AppWeb.WeatherLive`, with a `Live` suffix. When you go to add LiveView routes to the router, the default `:browser` scope is **already aliased** with the `AppWeb` module, so you can just do `live "/weather", WeatherLive`

### LiveView streams

- **Always** use LiveView streams for collections for assigning regular lists to avoid memory ballooning and runtime termination with the following operations:
  - basic append of N items - `stream(socket, :messages, [new_msg])`
  - resetting stream with new items - `stream(socket, :messages, [new_msg], reset: true)` (e.g. for filtering items)
  - prepend to stream - `stream(socket, :messages, [new_msg], at: -1)`
  - deleting items - `stream_delete(socket, :messages, msg)`

- When using the `stream/3` interfaces in the LiveView, the LiveView template must 1) always set `phx-update="stream"` on the parent element, with a DOM id on the parent element like `id="messages"` and 2) consume the `@streams.stream_name` collection and use the id as the DOM id for each child. For a call like `stream(socket, :messages, [new_msg])` in the LiveView, the template would be:

      <div id="messages" phx-update="stream">
        <div :for={{id, msg} <- @streams.messages} id={id}>
          {msg.text}
        </div>
      </div>

- LiveView streams are *not* enumerable, so you cannot use `Enum.filter/2` or `Enum.reject/2` on them. Instead, if you want to filter, prune, or refresh a list of items on the UI, you **must refetch the data and re-stream the entire stream collection, passing reset: true**:

      def handle_event("filter", %{"filter" => filter}, socket) do
        # re-fetch the messages based on the filter
        messages = list_messages(filter)

        {:noreply,
         socket
         |> assign(:messages_empty?, messages == [])
         # reset the stream with the new messages
         |> stream(:messages, messages, reset: true)}
      end

- LiveView streams *do not support counting or empty states*. If you need to display a count, you must track it using a separate assign. For empty states, you can use Tailwind classes:

      <div id="tasks" phx-update="stream">
        <div class="hidden only:block">No tasks yet</div>
        <div :for={{id, task} <- @streams.tasks} id={id}>
          {task.name}
        </div>
      </div>

  The above only works if the empty state is the only HTML block alongside the stream for-comprehension.

- When updating an assign that should change content inside any streamed item(s), you MUST re-stream the items
  along with the updated assign:

      def handle_event("edit_message", %{"message_id" => message_id}, socket) do
        message = Chat.get_message!(message_id)
        edit_form = to_form(Chat.change_message(message, %{content: message.content}))

        # re-insert message so @editing_message_id toggle logic takes effect for that stream item
        {:noreply,
         socket
         |> stream_insert(:messages, message)
         |> assign(:editing_message_id, String.to_integer(message_id))
         |> assign(:edit_form, edit_form)}
      end

  And in the template:

      <div id="messages" phx-update="stream">
        <div :for={{id, message} <- @streams.messages} id={id} class="flex group">
          {message.username}
          <%= if @editing_message_id == message.id do %>
            <%!-- Edit mode --%>
            <.form for={@edit_form} id="edit-form-#{message.id}" phx-submit="save_edit">
              ...
            </.form>
          <% end %>
        </div>
      </div>

- **Never** use the deprecated `phx-update="append"` or `phx-update="prepend"` for collections

### LiveView JavaScript interop

- Remember anytime you use `phx-hook="MyHook"` and that JS hook manages its own DOM, you **must** also set the `phx-update="ignore"` attribute
- **Always** provide an unique DOM id alongside `phx-hook` otherwise a compiler error will be raised

LiveView hooks come in two flavors, 1) colocated js hooks for "inline" scripts defined inside HEEx,
and 2) external `phx-hook` annotations where JavaScript object literals are defined and passed to the `LiveSocket` constructor.

#### Inline colocated js hooks

**Never** write raw embedded `<script>` tags in heex as they are incompatible with LiveView.
Instead, **always use a colocated js hook script tag (`:type={Phoenix.LiveView.ColocatedHook}`)
when writing scripts inside the template**:

    <input type="text" name="user[phone_number]" id="user-phone-number" phx-hook=".PhoneNumber" />
    <script :type={Phoenix.LiveView.ColocatedHook} name=".PhoneNumber">
      export default {
        mounted() {
          this.el.addEventListener("input", e => {
            let match = this.el.value.replace(/\D/g, "").match(/^(\d{3})(\d{3})(\d{4})$/)
            if(match) {
              this.el.value = `${match[1]}-${match[2]}-${match[3]}`
            }
          })
        }
      }
    </script>

- colocated hooks are automatically integrated into the app.js bundle
- colocated hooks names **MUST ALWAYS** start with a `.` prefix, i.e. `.PhoneNumber`

#### External phx-hook

External JS hooks (`<div id="myhook" phx-hook="MyHook">`) must be placed in `assets/js/` and passed to the
LiveSocket constructor:

    const MyHook = {
      mounted() { ... }
    }
    let liveSocket = new LiveSocket("/live", Socket, {
      hooks: { MyHook }
    });

#### Pushing events between client and server

Use LiveView's `push_event/3` when you need to push events/data to the client for a phx-hook to handle.
**Always** return or rebind the socket on `push_event/3` when pushing events:

    # re-bind socket so we maintain event state to be pushed
    socket = push_event(socket, "my_event", %{...})

    # or return the modified socket directly:
    def handle_event("some_event", _, socket) do
      {:noreply, push_event(socket, "my_event", %{...})}
    end

Pushed events can then be picked up in a JS hook with `this.handleEvent`:

    mounted() {
      this.handleEvent("my_event", data => console.log("from server:", data));
    }

Clients can also push an event to the server and receive a reply with `this.pushEvent`:

    mounted() {
      this.el.addEventListener("click", e => {
        this.pushEvent("my_event", { one: 1 }, reply => console.log("got reply from server:", reply));
      })
    }

Where the server handled it via:

    def handle_event("my_event", %{"one" => 1}, socket) do
      {:reply, %{two: 2}, socket}
    end

### LiveView tests

- `Phoenix.LiveViewTest` module and `LazyHTML` (included) for making your assertions
- Form tests are driven by `Phoenix.LiveViewTest`'s `render_submit/2` and `render_change/2` functions
- Come up with a step-by-step test plan that splits major test cases into small, isolated files. You may start with simpler tests that verify content exists, gradually add interaction tests
- **Always reference the key element IDs you added in the LiveView templates in your tests** for `Phoenix.LiveViewTest` functions like `element/2`, `has_element/2`, selectors, etc
- **Never** tests again raw HTML, **always** use `element/2`, `has_element/2`, and similar: `assert has_element?(view, "#my-form")`
- Instead of relying on testing text content, which can change, favor testing for the presence of key elements
- Focus on testing outcomes rather than implementation details
- Be aware that `Phoenix.Component` functions like `<.form>` might produce different HTML than expected. Test against the output HTML structure, not your mental model of what you expect it to be
- When facing test failures with element selectors, add debug statements to print the actual HTML, but use `LazyHTML` selectors to limit the output, ie:

      html = render(view)
      document = LazyHTML.from_fragment(html)
      matches = LazyHTML.filter(document, "your-complex-selector")
      IO.inspect(matches, label: "Matches")
