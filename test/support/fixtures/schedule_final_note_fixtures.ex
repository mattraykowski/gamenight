defmodule GameNight.SchedulesFixtures.FinalNoteTruthTable do
  @moduledoc """
  Single-source-of-truth test fixture for the Final Note rule.

  Both `GameNight.Schedules.Calculations.FinalNoteKind` (Elixir, T098)
  and `assets/js/features/schedules/final-note.ts` (TypeScript, T100)
  consume this fixture so any divergence fails CI. The TS side reads
  the byte-identical JSON copy at
  `assets/js/features/schedules/__fixtures__/final-note-truth-table.json`.

  Each row is a tuple `{ name, gm, participants, expected_kind,
  expected_label }`. Participant IFs that produce names use the
  placeholder list in `:if_player_names`; when the kind is
  `:maybe_with_if` the label format is checked against the names.

  See `specs/003-game-schedule/contracts/rpc.md` §Final Note Truth
  Table for the rule.
  """

  @rows [
    %{
      name: "no participants, GM available",
      gm: :A,
      participants: [],
      if_player_names: [],
      expected_kind: :good_day,
      expected_label: "Good Day"
    },
    %{
      name: "GM NA blocks the day → host unavailable",
      gm: :NA,
      participants: [:A, :A, :A],
      if_player_names: [],
      expected_kind: :host_unavailable,
      expected_label: "Host Unavailable"
    },
    %{
      name: "everyone available",
      gm: :A,
      participants: [:A, :A, :A, :A, :A],
      if_player_names: [],
      expected_kind: :good_day,
      expected_label: "Good Day"
    },
    %{
      name: "one of five NA — within the one-fifth threshold",
      gm: :A,
      participants: [:A, :NA, :A, :A, :A],
      if_player_names: [],
      expected_kind: :maybe,
      expected_label: "Maybe"
    },
    %{
      name: "two of five NA — past the one-fifth threshold",
      gm: :A,
      participants: [:A, :NA, :NA, :A, :A],
      if_player_names: [],
      expected_kind: :bad_day,
      expected_label: "Bad Day"
    },
    %{
      name: "any IF triggers maybe_with_if regardless of count",
      gm: :A,
      participants: [:A, :IF, :A, :A, :A],
      if_player_names: ["Anne"],
      expected_kind: :maybe_with_if,
      expected_label: "Maybe, talk to Anne"
    },
    %{
      name: "single-player NA — strict one-fifth = 0, so 1 > 0 = bad",
      gm: :A,
      participants: [:NA],
      if_player_names: [],
      expected_kind: :bad_day,
      expected_label: "Bad Day"
    },
    %{
      name: "GM Ideal + all participants Ideal = good day",
      gm: :I,
      participants: [:I, :A, :I],
      if_player_names: [],
      expected_kind: :good_day,
      expected_label: "Good Day"
    },
    %{
      name: "GM IF counts toward IF detection (no participants are IF)",
      gm: :IF,
      participants: [:A, :A, :A],
      if_player_names: [],
      expected_kind: :maybe_with_if,
      expected_label: "Maybe, talk to GM"
    }
  ]

  def rows, do: @rows
end
