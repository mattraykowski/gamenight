import { describe, it, expect } from "vitest";
import { narrowApiError } from "./errors";
import type { AshRpcError } from "@/ash_rpc";

function err(partial: Partial<AshRpcError>): AshRpcError {
  return {
    type: partial.type ?? "unknown",
    message: partial.message ?? "boom",
    shortMessage: partial.shortMessage ?? "boom",
    vars: partial.vars ?? {},
    fields: partial.fields ?? [],
    path: partial.path ?? [],
    details: partial.details,
  };
}

describe("narrowApiError", () => {
  it("returns an UnknownError when the error list is empty", () => {
    const result = narrowApiError([]);
    expect(result.kind).toBe("unknown");
  });

  it("classifies ash_typescript network_error into NetworkError", () => {
    const result = narrowApiError([
      err({
        type: "network_error",
        message: "Network request failed: Service Unavailable",
        details: { statusCode: 503 },
      }),
    ]);
    expect(result).toMatchObject({ kind: "network", status: 503 });
  });

  it("classifies 401 network_error into AuthError", () => {
    const result = narrowApiError([
      err({ type: "network_error", details: { statusCode: 401 } }),
    ]);
    expect(result).toMatchObject({ kind: "auth", status: 401 });
  });

  it("classifies Ash `forbidden` type into AuthError with status 403", () => {
    const result = narrowApiError([err({ type: "forbidden", message: "nope" })]);
    expect(result).toMatchObject({ kind: "auth", status: 403 });
  });

  it("classifies invalid_attribute errors into ValidationError and flattens fields", () => {
    const result = narrowApiError([
      err({ type: "invalid_attribute", fields: ["email"], message: "bad email" }),
      err({ type: "required", fields: ["password"], message: "required" }),
    ]);
    expect(result.kind).toBe("validation");
    if (result.kind === "validation") {
      expect(result.fields).toEqual(expect.arrayContaining(["email", "password"]));
    }
  });

  it("falls back to UnknownError for unrecognized types with no field hints", () => {
    const result = narrowApiError([
      err({ type: "something_weird", message: "no idea" }),
    ]);
    expect(result).toMatchObject({ kind: "unknown", message: "no idea" });
  });
});
