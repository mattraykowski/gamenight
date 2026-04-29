import { describe, expect, it } from "vitest";

import { calendarKeys } from "./hooks";

describe("calendarKeys (T009 / US1)", () => {
  it("scopes byMonth keys under [schedules, calendar, actorId, year, month]", () => {
    expect(calendarKeys.byMonth("user-1", 2026, 11)).toEqual([
      "schedules",
      "calendar",
      "user-1",
      2026,
      11,
    ]);
  });

  it("scopes forActor keys under [schedules, calendar, actorId] for prefix invalidation", () => {
    expect(calendarKeys.forActor("user-1")).toEqual([
      "schedules",
      "calendar",
      "user-1",
    ]);
  });

  it("the all key is the bare prefix [schedules, calendar]", () => {
    expect(calendarKeys.all).toEqual(["schedules", "calendar"]);
  });

  it("byMonth keys for the same actor across months share the actor prefix", () => {
    const oct = calendarKeys.byMonth("user-1", 2026, 10);
    const nov = calendarKeys.byMonth("user-1", 2026, 11);
    expect(oct.slice(0, 3)).toEqual(nov.slice(0, 3));
    expect(oct).not.toEqual(nov);
  });
});
