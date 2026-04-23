import { describe, expect, it } from "vitest";
import { parseRedirectTarget } from "./redirect";

describe("parseRedirectTarget", () => {
  it("returns the fallback when input is missing", () => {
    expect(parseRedirectTarget(undefined)).toBe("/dashboard");
    expect(parseRedirectTarget(null)).toBe("/dashboard");
    expect(parseRedirectTarget("")).toBe("/dashboard");
  });

  it("accepts a normal same-origin path", () => {
    expect(parseRedirectTarget("/dashboard")).toBe("/dashboard");
    expect(parseRedirectTarget("/games/42")).toBe("/games/42");
    expect(parseRedirectTarget("/foo/bar?baz=1")).toBe("/foo/bar?baz=1");
  });

  it("rejects protocol-relative URLs", () => {
    expect(parseRedirectTarget("//evil.com")).toBe("/dashboard");
    expect(parseRedirectTarget("//evil.com/path")).toBe("/dashboard");
  });

  it("rejects backslash-tricked protocol-relative URLs", () => {
    expect(parseRedirectTarget("/\\evil.com")).toBe("/dashboard");
  });

  it("rejects fully-qualified URLs", () => {
    expect(parseRedirectTarget("https://evil.com")).toBe("/dashboard");
    expect(parseRedirectTarget("http://localhost:4000/dashboard")).toBe("/dashboard");
    expect(parseRedirectTarget("javascript:alert(1)")).toBe("/dashboard");
  });

  it("rejects paths that encode a scheme after the leading slash", () => {
    expect(parseRedirectTarget("/https://evil.com")).toBe("/dashboard");
  });

  it("uses a caller-supplied fallback", () => {
    expect(parseRedirectTarget(undefined, "/custom")).toBe("/custom");
    expect(parseRedirectTarget("//evil.com", "/home")).toBe("/home");
  });
});
