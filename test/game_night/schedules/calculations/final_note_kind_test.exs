defmodule GameNight.Schedules.Calculations.FinalNoteKindTest do
  @moduledoc """
  T090 — drives every row of the shared truth-table fixture
  through `Calculations.FinalNoteKind.classify/3` + `label/2`.

  Both the Elixir calc and the TS mirror
  (`assets/js/features/schedules/final-note.ts`) consume this exact
  fixture, so a divergence between server and client behavior fails
  CI here OR in the matching Vitest run.
  """
  use ExUnit.Case, async: true

  alias GameNight.Schedules.Calculations.FinalNoteKind
  alias GameNight.SchedulesFixtures.FinalNoteTruthTable

  for row <- FinalNoteTruthTable.rows() do
    @row row

    test @row.name do
      {kind, names} =
        FinalNoteKind.classify(
          @row.gm,
          @row.participants,
          @row.if_player_names
        )

      assert kind == @row.expected_kind,
             "wrong kind for row #{inspect(@row.name)}: " <>
               "expected #{inspect(@row.expected_kind)}, got #{inspect(kind)}"

      assert FinalNoteKind.label(kind, names) == @row.expected_label,
             "wrong label for row #{inspect(@row.name)}: " <>
               "expected #{inspect(@row.expected_label)}, got " <>
               "#{inspect(FinalNoteKind.label(kind, names))}"
    end
  end
end
