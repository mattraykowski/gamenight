import { describe, it, expect } from "vitest";
import { landingMeta, privacyMeta, termsMeta } from "./meta";

const allMeta = [
  ["landingMeta", landingMeta],
  ["privacyMeta", privacyMeta],
  ["termsMeta", termsMeta],
] as const;

describe.each(allMeta)("%s constraints", (_name, meta) => {
  it("title is non-empty and ≤ 70 chars (typical search-result truncation)", () => {
    expect(meta.title.length).toBeGreaterThan(0);
    expect(meta.title.length).toBeLessThanOrEqual(70);
  });

  it("description is non-empty and ≤ 160 chars (typical SERP truncation)", () => {
    expect(meta.description.length).toBeGreaterThan(0);
    expect(meta.description.length).toBeLessThanOrEqual(160);
  });

  it("ogTitle and ogDescription are non-empty strings", () => {
    expect(meta.ogTitle).toBeTruthy();
    expect(meta.ogDescription).toBeTruthy();
  });

  it("ogImagePath is a path under siteOrigin (starts with /)", () => {
    expect(meta.ogImagePath.startsWith("/")).toBe(true);
  });
});

describe("landingMeta literal copy from contracts/route-contracts.md", () => {
  it("title matches the contract", () => {
    expect(landingMeta.title).toBe(
      "GameNight — Run your tabletop campaign with confidence",
    );
  });

  it("description matches the contract", () => {
    expect(landingMeta.description).toBe(
      "GameNight helps Game Masters organize tabletop campaigns: register games, invite players, schedule the month, and keep your fellowship in sync.",
    );
  });

  it("ogImagePath points at the brand-only landing OG asset", () => {
    expect(landingMeta.ogImagePath).toBe("/images/og/landing.png");
  });
});

describe("privacyMeta literal copy from contracts/route-contracts.md", () => {
  it("title matches the contract", () => {
    expect(privacyMeta.title).toBe("Privacy Policy — GameNight");
  });
});

describe("termsMeta literal copy from contracts/route-contracts.md", () => {
  it("title matches the contract", () => {
    expect(termsMeta.title).toBe("Terms of Service — GameNight");
  });
});
