defmodule GameNight.Schedules.Schedule do
  @moduledoc """
  One month's schedule for one `GameNight.Games.Game`.

  Holds the month/year/time-slot envelope and the lifecycle status
  (`:preparing` → `:ready_for_availability` → `:posted`). The display
  name (e.g. `"October 2026 7:00 PM – 11:00 PM"`) is derived via an
  Ash calculation rather than stored, per the user's directive.

  Skeleton resource for Phase 2 (Foundational) — declares the
  schema, identities, and `belongs_to :game` only. Story phases
  (US1 onwards) add the named actions, calculations, policies, and
  the JSON:API/RPC bindings.

  See `specs/003-game-schedule/data-model.md` §Schedule for the
  full attribute, action, and policy tables.
  """
  use Ash.Resource,
    otp_app: :game_night,
    domain: GameNight.Schedules,
    data_layer: AshPostgres.DataLayer,
    authorizers: [Ash.Policy.Authorizer],
    extensions: [AshJsonApi.Resource, AshTypescript.Resource]

  @statuses [:preparing, :ready_for_availability, :posted]

  def statuses, do: @statuses

  postgres do
    table "schedules"
    repo GameNight.Repo

    references do
      reference :game, on_delete: :delete
    end

    custom_indexes do
      index [:game_id, :year, :month],
        name: "schedules_game_year_month_index"
    end
  end

  json_api do
    type "schedule"

    # Include the derived display name in the default response so
    # every consumer (table rows, breadcrumbs, email subjects) gets
    # it without an opt-in `?fields[schedule]=name`. Per the user's
    # "derive via Ash best practices" directive in research.md §1.
    default_fields [
      :id,
      :game_id,
      :month,
      :year,
      :start_time,
      :end_time,
      :time_zone,
      :status,
      :posted_at,
      :inserted_at,
      :updated_at,
      :name
    ]

    routes do
      base "/schedules"

      index :list_for_game, route: "/by-game/:game_id"
      index :list_for_game_top_six, route: "/by-game/:game_id/top-six"
      get :get_for_game, route: "/by-game/:game_id/:id"
      post :initiate
      patch :set_gm_day, route: "/:id/set-gm-day"
      patch :transition_to_ready_for_availability,
        route: "/:id/transition-to-ready-for-availability"
      patch :update_final_days, route: "/:id/update-final-days"
      patch :update_final_days_and_notify,
        route: "/:id/update-final-days-and-notify"
      patch :post, route: "/:id/post"

      # US3 — player-side reads.
      index :list_for_player_character, route: "/by-character/:player_id"
      get :get_for_player_character, route: "/by-character/:player_id/:id"
    end
  end

  typescript do
    type_name "Schedule"
  end

  actions do
    # Foundational stubs — story phases REPLACE these with the
    # constrained named actions from the data model. Kept around
    # so `:create` / `:update` / `:destroy` work for fixtures and
    # tests that bypass policy via the internal actor.
    defaults [:read, :destroy, create: :*, update: :*]

    # US1 named actions.
    create :initiate do
      description """
      GM-only action to initiate a new monthly schedule. Validates
      the timezone, the not-in-past rule, and the unique-per-game
      identity. After insert, materialises one ScheduleDay row per
      day in the month with `gm_status: :NA`.
      """

      accept [:month, :year, :start_time, :end_time, :time_zone, :game_id]

      validate {GameNight.Schedules.Validations.TimezoneKnown, []}
      validate {GameNight.Schedules.Validations.MonthNotInPast, []}

      change after_action(fn _changeset, schedule, _context ->
               case create_schedule_days(schedule) do
                 :ok -> {:ok, schedule}
                 {:error, reason} -> {:error, reason}
               end
             end)
    end

    read :list_for_game do
      description "GM-only list of every schedule for a game, year/month DESC."
      argument :game_id, :uuid, allow_nil?: false

      prepare build(
               filter: expr(game_id == ^arg(:game_id)),
               sort: [year: :desc, month: :desc]
             )
    end

    read :list_for_game_top_six do
      description "GM-only top-6 most recent schedules for a game (View Game widget)."
      argument :game_id, :uuid, allow_nil?: false

      prepare build(
               filter: expr(game_id == ^arg(:game_id)),
               sort: [year: :desc, month: :desc],
               limit: 6
             )
    end

    read :get_for_game do
      description "GM-only fetch of one schedule by id, scoped to a game. Loads schedule_days."
      get? true

      argument :id, :uuid, allow_nil?: false
      argument :game_id, :uuid, allow_nil?: false

      prepare build(
               filter: expr(id == ^arg(:id) and game_id == ^arg(:game_id)),
               load: [:schedule_days, :name]
             )
    end

    read :list_for_player_character do
      description """
      Player-side — list every non-:preparing schedule on a game
      where the actor's character (Player) is linked. Filters out
      schedules the player can't see yet (still in :preparing on
      the GM's side).
      """
      argument :player_id, :uuid, allow_nil?: false

      prepare build(
               filter:
                 expr(
                   exists(participants, player_id == ^arg(:player_id)) and
                     status != :preparing
                 ),
               sort: [year: :desc, month: :desc]
             )
    end

    read :get_for_player_character do
      description """
      Player-side — fetch one schedule by id where the actor's
      character is a linked participant. Cross-tenant access
      collapses to not-found.
      """
      get? true

      argument :id, :uuid, allow_nil?: false
      argument :player_id, :uuid, allow_nil?: false

      prepare build(
               filter:
                 expr(
                   id == ^arg(:id) and
                     exists(participants, player_id == ^arg(:player_id)) and
                     status != :preparing
                 ),
               load: [:schedule_days, :name]
             )
    end

    update :update_final_days do
      description """
      GM-only — patch the Final decision for one or more days. Used
      by the Scheduling View's per-cell toggle. Allowed in
      `:ready_for_availability` (so the GM can adjust Final values
      before posting) and in `:posted` (silent post-post edits).

      Args: `final_days: [%{day: integer, status: :NA | :A}]`.
      """
      accept []
      require_atomic? false

      argument :final_days, {:array, :map}, allow_nil?: false

      validate fn changeset, _ctx ->
        case Ash.Changeset.get_data(changeset, :status) do
          status when status in [:ready_for_availability, :posted] ->
            :ok

          other ->
            {:error,
             field: :status,
             message:
               "Schedule must be ready for availability or posted to update Final values (was #{inspect(other)})."}
        end
      end

      change after_action(fn changeset, schedule, _ctx ->
               final_days = Ash.Changeset.get_argument(changeset, :final_days)

               case apply_final_days(schedule, final_days) do
                 :ok -> {:ok, schedule}
                 {:error, reason} -> {:error, reason}
               end
             end)
    end

    update :update_final_days_and_notify do
      description """
      US7 — same as `:update_final_days` but only allowed when the
      schedule is `:posted` and additionally fans out the
      `:schedule_updated` notification + email to every linked,
      non-NP participant. Used by the GM's "Update and notify"
      button in the Scheduling View.

      Args: `final_days: [%{day: integer, status: :NA | :A}]`.
      """
      accept []
      require_atomic? false

      argument :final_days, {:array, :map}, allow_nil?: false

      validate fn changeset, _ctx ->
        case Ash.Changeset.get_data(changeset, :status) do
          :posted ->
            :ok

          other ->
            {:error,
             field: :status,
             message:
               "Schedule must be posted to update-and-notify (was #{inspect(other)})."}
        end
      end

      change after_action(fn changeset, schedule, _ctx ->
               final_days = Ash.Changeset.get_argument(changeset, :final_days)

               with :ok <- apply_final_days(schedule, final_days),
                    :ok <-
                      GameNight.Schedules.System.fan_out_notification(
                        schedule,
                        :schedule_updated
                      ) do
                 {:ok, schedule}
               end
             end)
    end

    update :post do
      description """
      Transition a `:ready_for_availability` schedule to `:posted`.
      ComputeFinalDefault fills any still-null `final_status` from
      the truth table; days the GM set via `:update_final_days` are
      preserved. Sends the `:schedule_posted` notification + email
      to every linked, non-NP participant.
      """
      accept []
      require_atomic? false

      validate fn changeset, _ctx ->
        case Ash.Changeset.get_data(changeset, :status) do
          :ready_for_availability ->
            :ok

          other ->
            {:error,
             field: :status,
             message:
               "Schedule must be ready for availability to post (was #{inspect(other)})."}
        end
      end

      change set_attribute(:status, :posted)
      change set_attribute(:posted_at, &DateTime.utc_now/0)
      change GameNight.Schedules.Changes.ComputeFinalDefault
      change after_action(fn _changeset, schedule, _ctx ->
               case GameNight.Schedules.System.fan_out_notification(
                      schedule,
                      :schedule_posted
                    ) do
                 :ok -> {:ok, schedule}
                 {:error, reason} -> {:error, reason}
               end
             end)
    end

    update :transition_to_ready_for_availability do
      description """
      Transition a `:preparing` schedule to `:ready_for_availability`.
      Links every accepted player on the schedule's game to the
      schedule (one ScheduleParticipant + N ParticipantDay rows
      apiece) and fans out the `:schedule_ready_for_availability`
      notification + email to each linked player.
      """

      accept []
      require_atomic? false

      validate fn changeset, _ctx ->
        case Ash.Changeset.get_data(changeset, :status) do
          :preparing ->
            :ok

          other ->
            {:error,
             field: :status,
             message:
               "Schedule must be in :preparing to transition (was #{inspect(other)})."}
        end
      end

      change set_attribute(:status, :ready_for_availability)
      change GameNight.Schedules.Changes.LinkActivePlayers
      change after_action(fn _changeset, schedule, _context ->
               case GameNight.Schedules.System.fan_out_notification(
                      schedule,
                      :schedule_ready_for_availability
                    ) do
                 :ok -> {:ok, schedule}
                 {:error, reason} -> {:error, reason}
               end
             end)
    end

    update :set_gm_day do
      description """
      GM-only — toggle one ScheduleDay's `gm_status`. Rejects when
      schedule is `:posted` (FR-010 state guard).

      Cascade behavior on `:NA` while schedule is
      `:ready_for_availability` lands in T080 (US3); for `:preparing`
      this is a no-op fan-out.
      """
      accept []
      require_atomic? false

      argument :day, :integer, allow_nil?: false, constraints: [min: 1, max: 31]
      argument :status, :atom, allow_nil?: false, constraints: [one_of: [:NA, :I, :A, :IF]]

      validate fn changeset, _ctx ->
        case Ash.Changeset.get_data(changeset, :status) do
          :posted ->
            {:error,
             field: :status,
             message: "GM availability is locked once a schedule is posted."}

          _ ->
            :ok
        end
      end

      change after_action(fn changeset, schedule, _context ->
               day = Ash.Changeset.get_argument(changeset, :day)
               new_status = Ash.Changeset.get_argument(changeset, :status)

               case set_schedule_day_status(schedule, day, new_status) do
                 :ok -> {:ok, schedule}
                 {:error, reason} -> {:error, reason}
               end
             end)
    end
  end

  calculations do
    calculate :name, :string, GameNight.Schedules.Calculations.Name do
      description "Display name composed from month/year/time slot. See Calculations.Name."
      public? true
    end

    # FR-036 — denominator excludes NP-only participants
    # (late-joiners on a posted schedule who didn't get to submit).
    calculate :participant_count,
              :integer,
              expr(count(participants, query: [filter: np_only == false])) do
      description "Number of non-NP participants linked to this schedule."
      public? true
    end

    # Numerator counts non-NP participants who have called
    # `:set_submission` (i.e. submitted_at is set). All-NA
    # submissions still count per FR-022.
    calculate :submission_count,
              :integer,
              expr(
                count(participants,
                  query: [filter: np_only == false and not is_nil(submitted_at)]
                )
              ) do
      description "Number of participants who have submitted their availability."
      public? true
    end
  end

  policies do
    # Internal-actor bypass for fixtures and the foundational
    # default actions. Story phases add per-action policies BELOW
    # this block.
    bypass actor_attribute_equals(:_internal?, true) do
      authorize_if always()
    end

    # US1 — GM-only reads and updates use the relationship-walk
    # filter (works for read/update because the row exists).
    policy action([
             :list_for_game,
             :list_for_game_top_six,
             :get_for_game,
             :set_gm_day,
             :transition_to_ready_for_availability,
             :update_final_days,
             :update_final_days_and_notify,
             :post
           ]) do
      authorize_if expr(game.owner_id == ^actor(:id))
    end

    # JSON:API PATCH does a load-then-update under the base `:read`
    # action, so the GM also needs to pass that read policy. Linked
    # players also pass for non-:preparing schedules so the
    # player-side detail view can load.
    policy action_type(:read) do
      authorize_if expr(game.owner_id == ^actor(:id))
      authorize_if expr(
                     exists(participants, player.user_id == ^actor(:id)) and
                       status != :preparing
                   )
    end

    # Player-side reads use their own named actions so the action-level
    # policy is explicit (rather than depending on the action_type
    # gate above).
    policy action([:list_for_player_character, :get_for_player_character]) do
      authorize_if expr(
                     exists(participants, player.user_id == ^actor(:id)) and
                       status != :preparing
                   )
    end

    # `:initiate` is a create — Ash can't evaluate relationship
    # expressions on creates, so we use a custom check that loads
    # the game and asserts ownership before the row is materialised.
    policy action(:initiate) do
      authorize_if {GameNight.Schedules.Schedule.Checks.GameOwner, []}
    end
  end

  attributes do
    uuid_primary_key :id

    attribute :month, :integer do
      allow_nil? false
      public? true
      constraints min: 1, max: 12
    end

    attribute :year, :integer do
      allow_nil? false
      public? true
      constraints min: 2024, max: 2100
    end

    attribute :start_time, :time do
      allow_nil? false
      public? true
    end

    attribute :end_time, :time do
      allow_nil? false
      public? true
    end

    attribute :time_zone, :string do
      allow_nil? false
      public? true
      constraints min_length: 1, max_length: 64
    end

    attribute :status, :atom do
      allow_nil? false
      public? true
      default :preparing
      constraints one_of: @statuses
    end

    attribute :posted_at, :utc_datetime_usec do
      allow_nil? true
      public? true
    end

    create_timestamp :inserted_at, public?: true
    update_timestamp :updated_at, public?: true
  end

  relationships do
    belongs_to :game, GameNight.Games.Game do
      allow_nil? false
      # public? true so `game_id` is selectable via `fields` on the
      # SPA. Schedule's policies still gate the row itself, and the
      # related Game resource is loaded only when explicitly
      # requested.
      public? true
      attribute_writable? true
    end

    has_many :schedule_days, GameNight.Schedules.ScheduleDay do
      public? true
    end

    has_many :participants, GameNight.Schedules.ScheduleParticipant do
      public? true
    end
  end

  identities do
    # FR-002: at most one schedule per game per month/year.
    identity :unique_per_game_month, [:game_id, :year, :month]
  end

  # ---------------------------------------------------------------
  # Helpers used by after_action callbacks.
  # ---------------------------------------------------------------

  @doc false
  def create_schedule_days(schedule) do
    days_in_month = Date.days_in_month(Date.new!(schedule.year, schedule.month, 1))

    Enum.reduce_while(1..days_in_month, :ok, fn day, _acc ->
      case GameNight.Schedules.ScheduleDay
           |> Ash.Changeset.for_create(
             :create,
             %{
               schedule_id: schedule.id,
               day: day,
               gm_status: :NA
             },
             actor: GameNight.Schedules.System.actor()
           )
           |> Ash.create() do
        {:ok, _} -> {:cont, :ok}
        {:error, reason} -> {:halt, {:error, reason}}
      end
    end)
  end

  @doc false
  def set_schedule_day_status(schedule, day, status) do
    require Ash.Query

    with {:ok, schedule_day} <- find_schedule_day(schedule, day),
         {:ok, _} <-
           schedule_day
           |> Ash.Changeset.for_update(:update, %{gm_status: status},
             actor: GameNight.Schedules.System.actor()
           )
           |> Ash.update(),
         :ok <- maybe_cascade_gm_na(schedule, day, status) do
      :ok
    end
  end

  defp find_schedule_day(schedule, day) do
    require Ash.Query

    case GameNight.Schedules.ScheduleDay
         |> Ash.Query.filter(schedule_id == ^schedule.id and day == ^day)
         |> Ash.read_one(authorize?: false) do
      {:ok, nil} -> {:error, "ScheduleDay for day #{day} not found"}
      other -> other
    end
  end

  # FR-011 — when the GM flips a day to NA on a
  # :ready_for_availability schedule, overwrite every linked
  # participant's status for that day to :NA.
  defp maybe_cascade_gm_na(%{status: :ready_for_availability} = schedule, day, :NA) do
    GameNight.Schedules.System.cascade_gm_na(schedule, day, :NA)
  end

  defp maybe_cascade_gm_na(_schedule, _day, _status), do: :ok

  @doc false
  def apply_final_days(schedule, final_days) when is_list(final_days) do
    require Ash.Query

    Enum.reduce_while(final_days, :ok, fn entry, _acc ->
      day = day_from_entry(entry)
      status = status_from_entry(entry)

      with {:ok, %GameNight.Schedules.ScheduleDay{} = sd} <- find_schedule_day(schedule, day),
           {:ok, _} <-
             sd
             |> Ash.Changeset.for_update(:set_final_status, %{final_status: status},
               actor: GameNight.Schedules.System.actor()
             )
             |> Ash.update() do
        {:cont, :ok}
      else
        {:error, reason} -> {:halt, {:error, reason}}
      end
    end)
  end

  defp day_from_entry(%{"day" => day}) when is_integer(day), do: day
  defp day_from_entry(%{day: day}) when is_integer(day), do: day
  defp day_from_entry(%{"day" => day}) when is_binary(day), do: String.to_integer(day)

  defp status_from_entry(%{"status" => status}) when is_atom(status), do: status
  defp status_from_entry(%{status: status}) when is_atom(status), do: status
  defp status_from_entry(%{"status" => status}) when is_binary(status), do: String.to_existing_atom(status)
  defp status_from_entry(%{status: status}) when is_binary(status), do: String.to_existing_atom(status)
end
