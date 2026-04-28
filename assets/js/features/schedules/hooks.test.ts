import { describe, expect, it } from "vitest";

import { schedulesKeys } from "./hooks";

describe("schedulesKeys (T031)", () => {
  it("scopes byGame keys under [schedules, byGame, gameId]", () => {
    expect(schedulesKeys.byGame("game-1")).toEqual([
      "schedules",
      "byGame",
      "game-1",
    ]);
  });

  it("scopes topSixForGame keys under [schedules, byGame, gameId, topSix]", () => {
    expect(schedulesKeys.topSixForGame("game-1")).toEqual([
      "schedules",
      "byGame",
      "game-1",
      "topSix",
    ]);
  });

  it("scopes detail keys under [schedules, detail, scheduleId]", () => {
    expect(schedulesKeys.detail("schedule-1")).toEqual([
      "schedules",
      "detail",
      "schedule-1",
    ]);
  });
});
