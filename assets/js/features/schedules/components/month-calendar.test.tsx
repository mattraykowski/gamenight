import { describe, expect, it, vi } from "vitest";
import { render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";

import { expectNoAxeViolations } from "@/test/a11y";
import { MonthCalendar, type DayCell } from "./month-calendar";
import type { AvailabilityStatus, ParticipantDayStatus } from "../kinds";

function buildCells(
  year: number,
  month: number,
  status: ParticipantDayStatus = "NA",
  overrides: Partial<Record<number, Partial<DayCell>>> = {},
): DayCell[] {
  const days = new Date(year, month, 0).getDate();
  return Array.from({ length: days }, (_, i) => ({
    day: i + 1,
    status,
    gmLockedNa: false,
    ...overrides[i + 1],
  }));
}

describe("<MonthCalendar> (T027)", () => {
  it("renders 28 cells for non-leap February 2026", () => {
    render(
      <MonthCalendar
        year={2026}
        month={2}
        cells={buildCells(2026, 2)}
        mode="gm-edit"
        ariaLabel="February 2026 calendar"
      />,
    );
    const grid = screen.getByRole("grid", { name: /february 2026/i });
    expect(within(grid).getAllByRole("gridcell")).toHaveLength(28);
  });

  it("renders 31 cells for October 2026", () => {
    render(
      <MonthCalendar
        year={2026}
        month={10}
        cells={buildCells(2026, 10)}
        mode="gm-edit"
        ariaLabel="October 2026 calendar"
      />,
    );
    expect(screen.getAllByRole("gridcell")).toHaveLength(31);
  });

  it("starts the week on Sunday (column header is Sun)", () => {
    render(
      <MonthCalendar
        year={2026}
        month={10}
        cells={buildCells(2026, 10)}
        mode="gm-edit"
        ariaLabel="October 2026 calendar"
      />,
    );
    const headers = screen.getAllByRole("columnheader");
    expect(headers[0]).toHaveTextContent(/sun/i);
  });

  it("clicking a cell calls onCycle with that day", async () => {
    const onCycle = vi.fn();
    const user = userEvent.setup();
    render(
      <MonthCalendar
        year={2026}
        month={10}
        cells={buildCells(2026, 10)}
        mode="gm-edit"
        onCycle={onCycle}
        ariaLabel="October 2026 calendar"
      />,
    );

    await user.click(screen.getByRole("gridcell", { name: /^october 5,/i }));
    expect(onCycle).toHaveBeenCalledWith(5);
  });

  it("locked NA cells render the 'Host Unavailable' label instead of 'Not Available'", () => {
    const cells = buildCells(2026, 10);
    cells[4] = {
      day: 5,
      status: "NA",
      gmLockedNa: true,
    } as DayCell;

    render(
      <MonthCalendar
        year={2026}
        month={10}
        cells={cells}
        mode="player-edit"
        ariaLabel="October 2026 calendar"
      />,
    );

    const day5 = screen.getByRole("gridcell", {
      name: /^october 5,.*host unavailable/i,
    });
    expect(day5).toBeInTheDocument();
    // The on-screen label inside the cell also reads "Host Unavailable".
    expect(day5).toHaveTextContent(/host unavailable/i);
    // It is NOT labeled "Not Available" — that's the participant-NA
    // self-marked state, not the GM-locked one.
    expect(day5).not.toHaveTextContent(/not available/i);
  });

  it("locked NA cells are not clickable in player-edit mode", async () => {
    const onCycle = vi.fn();
    const user = userEvent.setup();
    const cells = buildCells(2026, 10);
    cells[4] = {
      ...cells[4],
      day: 5,
      status: "NA",
      gmLockedNa: true,
    } as DayCell;

    render(
      <MonthCalendar
        year={2026}
        month={10}
        cells={cells}
        mode="player-edit"
        onCycle={onCycle}
        ariaLabel="October 2026 calendar"
      />,
    );

    const day5 = screen.getByRole("gridcell", { name: /^october 5,/i });
    expect(day5).toHaveAttribute("aria-disabled", "true");

    await user.click(day5);
    expect(onCycle).not.toHaveBeenCalled();
  });

  it("read-only mode never calls onCycle", async () => {
    const onCycle = vi.fn();
    const user = userEvent.setup();
    render(
      <MonthCalendar
        year={2026}
        month={10}
        cells={buildCells(2026, 10, "A")}
        mode="read-only"
        onCycle={onCycle}
        ariaLabel="October 2026 calendar"
      />,
    );

    await user.click(screen.getByRole("gridcell", { name: /^october 5,/i }));
    expect(onCycle).not.toHaveBeenCalled();
  });

  it("each cell carries an aria-label naming the date and status", () => {
    const cells = buildCells(2026, 10);
    cells[4] = { day: 5, status: "A", gmLockedNa: false };
    render(
      <MonthCalendar
        year={2026}
        month={10}
        cells={cells}
        mode="gm-edit"
        ariaLabel="October 2026 calendar"
      />,
    );

    const day5 = screen.getByRole("gridcell", { name: /^october 5,.*available/i });
    expect(day5).toBeInTheDocument();
  });

  it("cycles the focus index with arrow keys", async () => {
    const onCycle = vi.fn();
    const user = userEvent.setup();
    render(
      <MonthCalendar
        year={2026}
        month={10}
        cells={buildCells(2026, 10)}
        mode="gm-edit"
        onCycle={onCycle}
        ariaLabel="October 2026 calendar"
      />,
    );

    const day1 = screen.getByRole("gridcell", { name: /^october 1,/i });
    day1.focus();
    expect(day1).toHaveFocus();

    await user.keyboard("{ArrowRight}");
    expect(screen.getByRole("gridcell", { name: /^october 2,/i })).toHaveFocus();

    await user.keyboard("{ArrowDown}");
    expect(screen.getByRole("gridcell", { name: /^october 9,/i })).toHaveFocus();

    await user.keyboard("{ArrowLeft}");
    expect(screen.getByRole("gridcell", { name: /^october 8,/i })).toHaveFocus();

    await user.keyboard("{ArrowUp}");
    expect(screen.getByRole("gridcell", { name: /^october 1,/i })).toHaveFocus();
  });

  it("Enter on a focused cell triggers onCycle", async () => {
    const onCycle = vi.fn();
    const user = userEvent.setup();
    render(
      <MonthCalendar
        year={2026}
        month={10}
        cells={buildCells(2026, 10)}
        mode="gm-edit"
        onCycle={onCycle}
        ariaLabel="October 2026 calendar"
      />,
    );

    const day1 = screen.getByRole("gridcell", { name: /^october 1,/i });
    day1.focus();
    await user.keyboard("{Enter}");
    expect(onCycle).toHaveBeenCalledWith(1);
  });

  it("has no axe violations", async () => {
    const cells = buildCells(2026, 10) as DayCell[];
    cells[4] = { day: 5, status: "A" as AvailabilityStatus, gmLockedNa: false };
    cells[10] = {
      day: 11,
      status: "NA" as AvailabilityStatus,
      gmLockedNa: true,
    };

    const { container } = render(
      <MonthCalendar
        year={2026}
        month={10}
        cells={cells}
        mode="player-edit"
        ariaLabel="October 2026 calendar"
      />,
    );
    await expectNoAxeViolations(container);
  });
});
