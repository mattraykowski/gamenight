defmodule GameNight.Schedules.Calculations.FinalNoteKind do
  @moduledoc """
  Pure classifier for the per-day Final Note. Given the GM's status
  for a day plus the linked participants' (non-NP) statuses for the
  same day, returns one of:

    * `:good_day`         — green; everyone is `:I` or `:A`.
    * `:maybe`            — yellow; ≤ 1/5 of participants are NA/IF.
    * `:maybe_with_if`    — yellow; one or more IFs (carries the
                             list of names that need talking to).
    * `:host_unavailable` — gray; GM is NA. Distinct from bad-day
                             so the UI can communicate "the GM
                             can't run this" specifically.
    * `:bad_day`          — red; > 1/5 of participants NA/IF (and
                             the GM is otherwise available).

  See research.md §4 + the shared truth-table fixture
  `test/support/fixtures/schedule_final_note_fixtures.ex` (which
  drives both the Elixir test and the TS mirror).

  This module is the **pure** function. The Ash calculation that
  loads participants for a given ScheduleDay and feeds them in lives
  in `ScheduleDay.calculations`.
  """

  @type avail :: :NA | :I | :A | :IF
  @type kind :: :good_day | :maybe | :maybe_with_if | :host_unavailable | :bad_day

  @doc """
  Classify the Final Note kind. `if_names` is a list of the IF
  participants' display names; when GM is `:IF` we append "GM" to
  the list (the GM acts as a participant for IF detection).

  Returns `{kind, sorted_if_names}` so callers can render
  "Maybe, talk to <names>".
  """
  @spec classify(avail(), [avail()], [String.t()]) :: {kind(), [String.t()]}
  def classify(gm, participants, if_names \\ [])
      when gm in [:NA, :I, :A, :IF] and is_list(participants) and is_list(if_names) do
    n = length(participants)
    threshold = div(n, 5)
    na_or_if = Enum.count(participants, &(&1 in [:NA, :IF]))
    has_participant_if = Enum.any?(participants, &(&1 == :IF))
    gm_is_if = gm == :IF

    cond do
      gm == :NA ->
        {:host_unavailable, []}

      gm in [:I, :A] and Enum.all?(participants, &(&1 in [:I, :A])) ->
        {:good_day, []}

      has_participant_if or gm_is_if ->
        names =
          if_names
          |> then(fn names -> if gm_is_if, do: names ++ ["GM"], else: names end)
          |> Enum.sort()

        {:maybe_with_if, names}

      na_or_if > threshold ->
        {:bad_day, []}

      na_or_if > 0 ->
        {:maybe, []}

      n == 0 and gm in [:I, :A] ->
        {:good_day, []}

      true ->
        {:bad_day, []}
    end
  end

  @doc """
  Build the human-readable label string from a kind + the IF names.
  Mirrored in `assets/js/features/schedules/final-note.ts`.
  """
  @spec label(kind(), [String.t()]) :: String.t()
  def label(:good_day, _), do: "Good Day"
  def label(:maybe, _), do: "Maybe"
  def label(:bad_day, _), do: "Bad Day"
  def label(:host_unavailable, _), do: "Host Unavailable"

  def label(:maybe_with_if, names) when is_list(names) and names != [] do
    "Maybe, talk to " <> Enum.join(names, ", ")
  end

  def label(:maybe_with_if, _), do: "Maybe"
end
