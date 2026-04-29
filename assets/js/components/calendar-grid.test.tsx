import { describe, expect, it } from "vitest";
import { render, screen } from "@testing-library/react";

import { expectNoAxeViolations } from "@/test/a11y";
import { CalendarGrid } from "./calendar-grid";

describe("<CalendarGrid> (T002 — feature 004 foundational)", () => {
  it("renders the seven Sun-first column headers", () => {
    render(
      <CalendarGrid
        year={2026}
        month={10}
        ariaLabel="October 2026"
        renderCell={() => null}
      />,
    );
    const headers = screen.getAllByRole("columnheader");
    expect(headers).toHaveLength(7);
    expect(headers[0]).toHaveTextContent(/sun/i);
    expect(headers[6]).toHaveTextContent(/sat/i);
  });

  it("renders one gridcell per day in October 2026 (31 cells, 31 days)", () => {
    const seen: number[] = [];
    render(
      <CalendarGrid
        year={2026}
        month={10}
        ariaLabel="October 2026"
        renderCell={(date) => {
          seen.push(date.getDate());
          return (
            <div role="gridcell" data-testid={`day-${date.getDate()}`}>
              {date.getDate()}
            </div>
          );
        }}
      />,
    );
    expect(seen).toHaveLength(31);
    expect(seen[0]).toBe(1);
    expect(seen[30]).toBe(31);
    expect(screen.getAllByRole("gridcell")).toHaveLength(31);
  });

  it("renders 28 gridcells for non-leap February 2026", () => {
    render(
      <CalendarGrid
        year={2026}
        month={2}
        ariaLabel="February 2026"
        renderCell={(date) => (
          <div role="gridcell" data-testid={`day-${date.getDate()}`} />
        )}
      />,
    );
    expect(screen.getAllByRole("gridcell")).toHaveLength(28);
  });

  it("renders 29 gridcells for leap February 2024", () => {
    render(
      <CalendarGrid
        year={2024}
        month={2}
        ariaLabel="February 2024"
        renderCell={(date) => (
          <div role="gridcell" data-testid={`day-${date.getDate()}`} />
        )}
      />,
    );
    expect(screen.getAllByRole("gridcell")).toHaveLength(29);
  });

  it("passes the correct Date object to the renderCell prop (year + month + day)", () => {
    const seenDates: Date[] = [];
    render(
      <CalendarGrid
        year={2026}
        month={11}
        ariaLabel="November 2026"
        renderCell={(date) => {
          seenDates.push(date);
          return <div role="gridcell" />;
        }}
      />,
    );
    // November 2026 starts on a Sunday, so the very first call is Nov 1.
    const first = seenDates[0];
    expect(first).toBeInstanceOf(Date);
    expect(first?.getFullYear()).toBe(2026);
    expect(first?.getMonth()).toBe(10);
    expect(first?.getDate()).toBe(1);
  });

  it("includes leading blanks for months that don't start on Sunday", () => {
    // October 2026 starts on a Thursday. JS Date.getDay() = 4. So the
    // first row should have 4 blank slots before Oct 1.
    render(
      <CalendarGrid
        year={2026}
        month={10}
        ariaLabel="October 2026"
        renderCell={(date) => (
          <div role="gridcell" data-testid={`day-${date.getDate()}`}>
            {date.getDate()}
          </div>
        )}
      />,
    );
    // Blank cells render with role="presentation" / aria-hidden.
    const blanks = screen.getAllByTestId("calendar-grid-blank");
    expect(blanks.length).toBeGreaterThanOrEqual(4);
  });

  it("uses the supplied ariaLabel on the grid", () => {
    render(
      <CalendarGrid
        year={2026}
        month={10}
        ariaLabel="October 2026 calendar"
        renderCell={() => null}
      />,
    );
    expect(
      screen.getByRole("grid", { name: /october 2026 calendar/i }),
    ).toBeInTheDocument();
  });

  it("has no axe violations", async () => {
    const { container } = render(
      <CalendarGrid
        year={2026}
        month={10}
        ariaLabel="October 2026"
        renderCell={(date) => (
          <div role="gridcell" data-testid={`day-${date.getDate()}`}>
            {date.getDate()}
          </div>
        )}
      />,
    );
    await expectNoAxeViolations(container);
  });
});
