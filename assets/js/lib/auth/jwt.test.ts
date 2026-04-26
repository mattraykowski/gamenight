import { describe, expect, it } from "vitest";
import { decodeJwtPayload, emailFromToken } from "./jwt";

function makeJwt(payload: Record<string, unknown>): string {
  const encodeSegment = (data: unknown) =>
    btoa(JSON.stringify(data))
      .replace(/\+/g, "-")
      .replace(/\//g, "_")
      .replace(/=+$/, "");
  return [encodeSegment({ alg: "HS256", typ: "JWT" }), encodeSegment(payload), "sig"].join(".");
}

describe("decodeJwtPayload", () => {
  it("decodes a well-formed JWT", () => {
    const token = makeJwt({ sub: "user-1", email: "player@example.com" });
    expect(decodeJwtPayload(token)).toEqual({ sub: "user-1", email: "player@example.com" });
  });

  it("returns null for missing input", () => {
    expect(decodeJwtPayload(null)).toBeNull();
    expect(decodeJwtPayload(undefined)).toBeNull();
    expect(decodeJwtPayload("")).toBeNull();
  });

  it("returns null for malformed input", () => {
    expect(decodeJwtPayload("not-a-jwt")).toBeNull();
    expect(decodeJwtPayload("aaa.not-base64!.ccc")).toBeNull();
  });

  it("handles URL-safe base64 characters and missing padding", () => {
    // Encodes a payload whose base64 form contains `-` / `_` (via the
    // `~` / `?` characters that hit non-standard bytes).
    const token = makeJwt({ quirky: "~?~?~?" });
    expect(decodeJwtPayload(token)).toEqual({ quirky: "~?~?~?" });
  });
});

describe("emailFromToken", () => {
  it("returns the `email` claim when present", () => {
    const token = makeJwt({ sub: "user-1", email: "player@example.com" });
    expect(emailFromToken(token)).toBe("player@example.com");
  });

  it("falls back to the `identity` claim (used by magic-link tokens)", () => {
    const token = makeJwt({ sub: "user", identity: "magic@example.com" });
    expect(emailFromToken(token)).toBe("magic@example.com");
  });

  it("falls back to `act.email` when neither email nor identity are present", () => {
    const token = makeJwt({ sub: "user-1", act: { email: "nested@example.com" } });
    expect(emailFromToken(token)).toBe("nested@example.com");
  });

  it("returns null when the token has no email claim", () => {
    const token = makeJwt({ sub: "user-1" });
    expect(emailFromToken(token)).toBeNull();
  });

  it("returns null for a non-email string", () => {
    const token = makeJwt({ email: "not-an-email" });
    expect(emailFromToken(token)).toBeNull();
  });
});
