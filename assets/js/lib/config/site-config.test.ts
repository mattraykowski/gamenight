import { describe, it, expect } from "vitest";
import { siteConfig } from "./site-config";

describe("siteConfig", () => {
  it("exports the three documented build-time constants", () => {
    expect(siteConfig).toMatchObject({
      siteOrigin: expect.any(String),
      contactEmail: expect.any(String),
      socialUrl: expect.any(String),
    });
  });

  it("siteOrigin has no trailing slash (avoids double-slash when composing URLs)", () => {
    expect(siteConfig.siteOrigin.endsWith("/")).toBe(false);
  });

  it("contactEmail looks like an email address", () => {
    expect(siteConfig.contactEmail).toMatch(/.+@.+/);
  });

  it("socialUrl parses as a URL", () => {
    expect(() => new URL(siteConfig.socialUrl)).not.toThrow();
  });
});
