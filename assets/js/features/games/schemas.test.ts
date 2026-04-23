import { describe, expect, it } from "vitest";
import { gameFormSchema, toRegisterGameInput } from "./schemas";

describe("gameFormSchema", () => {
  it("accepts a complete valid submission", () => {
    const result = gameFormSchema.safeParse({
      title: "Lost Mine of Phandelver",
      description: "Opening adventure for our Tuesday group.",
      status: "active",
    });
    expect(result.success).toBe(true);
  });

  it("accepts an empty description (optional)", () => {
    const result = gameFormSchema.safeParse({
      title: "Short",
      description: "",
      status: "paused",
    });
    expect(result.success).toBe(true);
  });

  it("rejects an empty title", () => {
    const result = gameFormSchema.safeParse({
      title: "",
      description: "x",
      status: "active",
    });
    expect(result.success).toBe(false);
    if (!result.success) {
      expect(result.error.issues.some((i) => i.path[0] === "title")).toBe(true);
    }
  });

  it("rejects an unknown status", () => {
    const result = gameFormSchema.safeParse({
      title: "Good",
      description: "x",
      status: "wobbly",
    });
    expect(result.success).toBe(false);
  });

  it("rejects a title longer than 120 characters", () => {
    const result = gameFormSchema.safeParse({
      title: "a".repeat(121),
      description: "x",
      status: "active",
    });
    expect(result.success).toBe(false);
  });

  it("rejects a description longer than 2000 characters", () => {
    const result = gameFormSchema.safeParse({
      title: "Fine",
      description: "a".repeat(2001),
      status: "active",
    });
    expect(result.success).toBe(false);
  });
});

describe("toRegisterGameInput", () => {
  it("normalises an empty description to null on the wire", () => {
    const input = toRegisterGameInput({
      title: "T",
      description: "",
      status: "active",
    });
    expect(input).toEqual({ title: "T", description: null, status: "active" });
  });

  it("passes a non-empty description through unchanged", () => {
    const input = toRegisterGameInput({
      title: "T",
      description: "keep me",
      status: "paused",
    });
    expect(input).toEqual({ title: "T", description: "keep me", status: "paused" });
  });
});
