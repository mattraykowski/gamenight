import { describe, expect, it, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";

import { DayEventsPopover } from "./day-events-popover";
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

describe("<DayEventsPopover> (T026 / US3)", () => {
  it("opens with the trigger and renders one row per event", async () => {
    const user = userEvent.setup();
    const events = [
      buildEvent({ scheduleId: "a", gameTitle: "Game A" }),
      buildEvent({ scheduleId: "b", gameTitle: "Game B" }),
      buildEvent({
        scheduleId: "c",
        gameTitle: "Game C",
        role: "player",
        characterId: "char-1",
        targetRoute: "/characters/$characterId/schedules/$scheduleId",
      }),
    ];

    render(
      <DayEventsPopover
        date="2026-11-05"
        events={events}
        onOpenEvent={() => undefined}
      >
        <button type="button" data-testid="trigger">+3 more</button>
      </DayEventsPopover>,
    );

    await user.click(screen.getByTestId("trigger"));

    expect(await screen.findByText("Game A")).toBeInTheDocument();
    expect(screen.getByText("Game B")).toBeInTheDocument();
    expect(screen.getByText("Game C")).toBeInTheDocument();
  });

  it("clicking an event row fires onOpenEvent with the matching event", async () => {
    const user = userEvent.setup();
    const onOpenEvent = vi.fn();
    const target = buildEvent({ scheduleId: "x", gameTitle: "Pick me" });

    render(
      <DayEventsPopover
        date="2026-11-05"
        events={[
          buildEvent({ scheduleId: "y", gameTitle: "Other" }),
          target,
        ]}
        onOpenEvent={onOpenEvent}
      >
        <button type="button" data-testid="trigger">+2 more</button>
      </DayEventsPopover>,
    );

    await user.click(screen.getByTestId("trigger"));
    await user.click(await screen.findByRole("button", { name: /pick me/i }));

    expect(onOpenEvent).toHaveBeenCalledTimes(1);
    expect(onOpenEvent).toHaveBeenCalledWith(target);
  });

  it("renders a date header and the time-slot label per row", async () => {
    const user = userEvent.setup();
    render(
      <DayEventsPopover
        date="2026-11-05"
        events={[
          buildEvent({
            timeSlotLabel: "7:00 PM – 11:00 PM",
            gameTitle: "Curse of Strahd",
          }),
        ]}
        onOpenEvent={() => undefined}
      >
        <button type="button" data-testid="trigger">+1 more</button>
      </DayEventsPopover>,
    );

    await user.click(screen.getByTestId("trigger"));

    // Header reads as the formatted date.
    expect(await screen.findByText(/November 5, 2026/)).toBeInTheDocument();
    // Time slot label is visible inside the row.
    expect(screen.getByText(/7:00 PM – 11:00 PM/)).toBeInTheDocument();
  });
});
