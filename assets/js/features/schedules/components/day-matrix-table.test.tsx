import { describe, expect, it, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";

import { DayMatrixTable } from "./day-matrix-table";

const PARTICIPANTS = [
  { id: "p1", characterName: "Anne", npOnly: false },
  { id: "p2", characterName: "Bobby", npOnly: false },
];

describe("<DayMatrixTable> (T094)", () => {
  it("renders one row per day with columns for each participant + Final + Note", () => {
    render(
      <DayMatrixTable
        participants={PARTICIPANTS}
        days={[
          {
            day: 1,
            gmStatus: "A",
            finalStatus: null,
            participantStatuses: { p1: "A", p2: "A" },
          },
          {
            day: 2,
            gmStatus: "NA",
            finalStatus: null,
            participantStatuses: { p1: "NA", p2: "NA" },
          },
        ]}
        onCycleFinal={() => undefined}
      />,
    );

    expect(screen.getByText(/anne/i)).toBeInTheDocument();
    expect(screen.getByText(/bobby/i)).toBeInTheDocument();
    expect(screen.getByTestId("day-matrix-row-1")).toBeInTheDocument();
    expect(screen.getByTestId("day-matrix-row-2")).toBeInTheDocument();
  });

  it("renders 'Good Day' (✓) when GM and all participants are A", () => {
    render(
      <DayMatrixTable
        participants={PARTICIPANTS}
        days={[
          {
            day: 1,
            gmStatus: "A",
            finalStatus: null,
            participantStatuses: { p1: "A", p2: "A" },
          },
        ]}
        onCycleFinal={() => undefined}
      />,
    );

    const note = screen.getByTestId("day-matrix-note-1");
    expect(note).toHaveTextContent(/good day/i);
  });

  it("renders 'Bad Day' (✕) when GM is NA", () => {
    render(
      <DayMatrixTable
        participants={PARTICIPANTS}
        days={[
          {
            day: 1,
            gmStatus: "NA",
            finalStatus: null,
            participantStatuses: { p1: "A", p2: "A" },
          },
        ]}
        onCycleFinal={() => undefined}
      />,
    );

    expect(screen.getByTestId("day-matrix-note-1")).toHaveTextContent(/bad day/i);
  });

  it("renders 'Maybe, talk to <name>' when a participant is IF", () => {
    render(
      <DayMatrixTable
        participants={PARTICIPANTS}
        days={[
          {
            day: 1,
            gmStatus: "A",
            finalStatus: null,
            participantStatuses: { p1: "IF", p2: "A" },
          },
        ]}
        onCycleFinal={() => undefined}
      />,
    );

    expect(screen.getByTestId("day-matrix-note-1")).toHaveTextContent(
      /maybe, talk to anne/i,
    );
  });

  it("Final button cycles NA ↔ A and calls onCycleFinal with the new value", async () => {
    const onCycle = vi.fn();
    const user = userEvent.setup();

    render(
      <DayMatrixTable
        participants={PARTICIPANTS}
        days={[
          {
            day: 5,
            gmStatus: "A",
            finalStatus: "A",
            participantStatuses: { p1: "A", p2: "A" },
          },
        ]}
        onCycleFinal={onCycle}
      />,
    );

    await user.click(screen.getByTestId("day-matrix-final-5"));
    expect(onCycle).toHaveBeenCalledWith(5, "NA");
  });

  it("excludes np_only participants from rendered columns", () => {
    render(
      <DayMatrixTable
        participants={[
          { id: "p1", characterName: "Anne", npOnly: false },
          { id: "p2", characterName: "Bobby", npOnly: true },
        ]}
        days={[
          {
            day: 1,
            gmStatus: "A",
            finalStatus: null,
            participantStatuses: { p1: "A", p2: "NP" },
          },
        ]}
        onCycleFinal={() => undefined}
      />,
    );

    expect(screen.getByText(/anne/i)).toBeInTheDocument();
    expect(screen.queryByText(/bobby/i)).not.toBeInTheDocument();
  });
});
