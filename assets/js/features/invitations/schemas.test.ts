import { describe, expect, it } from "vitest";
import { invitationFormSchema, toCreateInvitationInput } from "./schemas";

describe("invitationFormSchema", () => {
  const valid = {
    email: "rachel@example.com",
    characterName: "Mira Stoneheart",
    characterSummary: "Half-orc paladin.",
    gmNotes: "First-time paladin.",
  };

  it("accepts a complete valid submission", () => {
    expect(invitationFormSchema.safeParse(valid).success).toBe(true);
  });

  it("accepts an empty character_summary and gm_notes (optional)", () => {
    expect(
      invitationFormSchema.safeParse({ ...valid, characterSummary: "", gmNotes: "" }).success,
    ).toBe(true);
  });

  it("rejects a missing email", () => {
    const result = invitationFormSchema.safeParse({ ...valid, email: "" });
    expect(result.success).toBe(false);
    if (!result.success) {
      expect(result.error.issues.some((i) => i.path[0] === "email")).toBe(true);
    }
  });

  it("rejects an invalid email", () => {
    expect(invitationFormSchema.safeParse({ ...valid, email: "not-an-email" }).success).toBe(false);
  });

  it("rejects a missing character_name", () => {
    const result = invitationFormSchema.safeParse({ ...valid, characterName: "" });
    expect(result.success).toBe(false);
    if (!result.success) {
      expect(result.error.issues.some((i) => i.path[0] === "characterName")).toBe(true);
    }
  });

  it("rejects character_name longer than 120 characters", () => {
    expect(
      invitationFormSchema.safeParse({ ...valid, characterName: "a".repeat(121) }).success,
    ).toBe(false);
  });

  it("rejects character_summary longer than 4000 characters", () => {
    expect(
      invitationFormSchema.safeParse({ ...valid, characterSummary: "a".repeat(4001) }).success,
    ).toBe(false);
  });

  it("rejects gm_notes longer than 4000 characters", () => {
    expect(
      invitationFormSchema.safeParse({ ...valid, gmNotes: "a".repeat(4001) }).success,
    ).toBe(false);
  });
});

describe("toCreateInvitationInput", () => {
  it("normalises empty optional strings to null on the wire", () => {
    const input = toCreateInvitationInput(
      {
        email: "rachel@example.com",
        characterName: "Mira",
        characterSummary: "",
        gmNotes: "",
      },
      "game-uuid",
    );
    expect(input).toEqual({
      gameId: "game-uuid",
      email: "rachel@example.com",
      characterName: "Mira",
      characterSummary: null,
      gmNotes: null,
    });
  });

  it("passes non-empty optional strings through unchanged", () => {
    const input = toCreateInvitationInput(
      {
        email: "rachel@example.com",
        characterName: "Mira",
        characterSummary: "Half-orc paladin.",
        gmNotes: "First-time player.",
      },
      "game-uuid",
    );
    expect(input).toEqual({
      gameId: "game-uuid",
      email: "rachel@example.com",
      characterName: "Mira",
      characterSummary: "Half-orc paladin.",
      gmNotes: "First-time player.",
    });
  });
});
