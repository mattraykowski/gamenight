import { describe, expect, it, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";

import { expectNoAxeViolations } from "@/test/a11y";
import { EventCalendar } from "./event-calendar";
import type { CalendarEventDay } from "../hooks";

function buildEvent(overrides: Partial<CalendarEventDay>): CalendarEventDay {
  return {
    date: "2026-11-05",
    scheduleId: "sched-1",
    gameId: "game-1",
    gameTitle: "Curse of Strahd",
    timeSlotLabel: "7:00 PM – 11:00 PM",
    role: "gm",
    characterId: null,
    targetRoute: "/games/$gameId/schedules/$scheduleId",
    ...overrides,
  };
}

describe("<EventCalendar> (T010 / US1)", () => {
  it("renders one pill per event on the matching cell", () => {
    const events = [
      buildEvent({ date: "2026-11-05", gameTitle: "Curse of Strahd" }),
      buildEvent({
        date: "2026-11-12",
        gameTitle: "Lost Mines",
        scheduleId: "sched-2",
        role: "player",
        characterId: "char-1",
        targetRoute: "/characters/$characterId/schedules/$scheduleId",
      }),
    ];

    render(
      <EventCalendar
        year={2026}
        month={11}
        events={events}
        onOpenEvent={() => undefined}
        ariaLabel="November 2026"
      />,
    );

    expect(screen.getByText(/curse of strahd/i)).toBeInTheDocument();
    expect(screen.getByText(/lost mines/i)).toBeInTheDocument();
  });

  it("renders no pill on days with no events", () => {
    const events = [buildEvent({ date: "2026-11-05" })];
    render(
      <EventCalendar
        year={2026}
        month={11}
        events={events}
        onOpenEvent={() => undefined}
        ariaLabel="November 2026"
      />,
    );

    // Day 6 cell has no event pill.
    const day6 = screen.getByTestId("event-calendar-cell-2026-11-06");
    expect(day6).toBeInTheDocument();
    expect(day6.querySelectorAll("[data-testid^='event-pill-']")).toHaveLength(0);
  });

  it("clicking a pill fires onOpenEvent with the matching event", async () => {
    const user = userEvent.setup();
    const onOpenEvent = vi.fn();
    const event = buildEvent({ date: "2026-11-05" });

    render(
      <EventCalendar
        year={2026}
        month={11}
        events={[event]}
        onOpenEvent={onOpenEvent}
        ariaLabel="November 2026"
      />,
    );

    await user.click(
      screen.getByRole("button", { name: /curse of strahd/i }),
    );
    expect(onOpenEvent).toHaveBeenCalledTimes(1);
    expect(onOpenEvent).toHaveBeenCalledWith(event);
  });

  it("renders up to 3 pills + a +N more chip when a day has > 3 events", () => {
    const events = [
      buildEvent({ scheduleId: "a", gameTitle: "Game A" }),
      buildEvent({ scheduleId: "b", gameTitle: "Game B" }),
      buildEvent({ scheduleId: "c", gameTitle: "Game C" }),
      buildEvent({ scheduleId: "d", gameTitle: "Game D" }),
      buildEvent({ scheduleId: "e", gameTitle: "Game E" }),
    ];

    render(
      <EventCalendar
        year={2026}
        month={11}
        events={events}
        onOpenEvent={() => undefined}
        ariaLabel="November 2026"
      />,
    );

    // First three are visible; D + E are hidden behind the chip.
    expect(screen.getByText(/game a/i)).toBeInTheDocument();
    expect(screen.getByText(/game b/i)).toBeInTheDocument();
    expect(screen.getByText(/game c/i)).toBeInTheDocument();
    expect(
      screen.getByTestId("event-overflow-2026-11-05"),
    ).toHaveTextContent("+2 more");
  });

  it("each pill carries an accessible name with date + game + role", () => {
    const events = [
      buildEvent({ date: "2026-11-05", gameTitle: "Curse of Strahd", role: "gm" }),
    ];
    render(
      <EventCalendar
        year={2026}
        month={11}
        events={events}
        onOpenEvent={() => undefined}
        ariaLabel="November 2026"
      />,
    );

    const pill = screen.getByRole("button", {
      name: /november 5,.*curse of strahd.*game master/i,
    });
    expect(pill).toBeInTheDocument();
  });

  it("has no axe violations", async () => {
    const events = [
      buildEvent({ date: "2026-11-05" }),
      buildEvent({
        date: "2026-11-12",
        scheduleId: "sched-2",
        gameTitle: "Lost Mines",
        role: "player",
        characterId: "char-1",
        targetRoute: "/characters/$characterId/schedules/$scheduleId",
      }),
    ];
    const { container } = render(
      <EventCalendar
        year={2026}
        month={11}
        events={events}
        onOpenEvent={() => undefined}
        ariaLabel="November 2026"
      />,
    );
    await expectNoAxeViolations(container);
  });
});
