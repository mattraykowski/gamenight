import { describe, it, expect, vi } from "vitest";
import { createAuthedFetch } from "./authed-fetch";

function makeResponse(status: number): Response {
  return new Response(null, { status });
}

describe("createAuthedFetch", () => {
  it("returns the original response when the server does not 401", async () => {
    const fetchImpl = vi.fn(async () => makeResponse(200));
    const onAuthFailed = vi.fn();
    const authed = createAuthedFetch({ onAuthFailed, fetchImpl });

    const res = await authed("/rpc/run", { method: "POST" });
    expect(res.status).toBe(200);
    expect(fetchImpl).toHaveBeenCalledTimes(1);
    expect(onAuthFailed).not.toHaveBeenCalled();
  });

  it("attempts a silent refresh on 401 and retries once on success", async () => {
    const fetchImpl = vi
      .fn()
      .mockResolvedValueOnce(makeResponse(401))
      .mockResolvedValueOnce(makeResponse(200));
    const attemptRefresh = vi.fn(async () => true);
    const onAuthFailed = vi.fn();
    const authed = createAuthedFetch({
      onAuthFailed,
      attemptRefresh,
      fetchImpl,
      getCurrentPath: () => "/dashboard",
    });

    const res = await authed("/rpc/run", { method: "POST" });
    expect(res.status).toBe(200);
    expect(fetchImpl).toHaveBeenCalledTimes(2);
    expect(attemptRefresh).toHaveBeenCalledTimes(1);
    expect(onAuthFailed).not.toHaveBeenCalled();
  });

  it("calls onAuthFailed with the current path when refresh is not configured", async () => {
    const fetchImpl = vi.fn(async () => makeResponse(401));
    const onAuthFailed = vi.fn();
    const authed = createAuthedFetch({
      onAuthFailed,
      fetchImpl,
      getCurrentPath: () => "/dashboard",
    });

    await authed("/rpc/run", { method: "POST" });
    expect(onAuthFailed).toHaveBeenCalledWith({ currentPath: "/dashboard" });
  });

  it("calls onAuthFailed when the retried request still 401s", async () => {
    const fetchImpl = vi.fn().mockResolvedValue(makeResponse(401));
    const attemptRefresh = vi.fn(async () => true);
    const onAuthFailed = vi.fn();
    const authed = createAuthedFetch({
      onAuthFailed,
      attemptRefresh,
      fetchImpl,
      getCurrentPath: () => "/dashboard",
    });

    await authed("/rpc/run", { method: "POST" });
    expect(fetchImpl).toHaveBeenCalledTimes(2);
    expect(onAuthFailed).toHaveBeenCalledWith({ currentPath: "/dashboard" });
  });

  it("threads `credentials: same-origin` so Phoenix session cookies ride along", async () => {
    const fetchImpl = vi.fn<typeof fetch>(async () => makeResponse(200));
    const authed = createAuthedFetch({ onAuthFailed: () => {}, fetchImpl });

    await authed("/rpc/run", { method: "POST" });
    const init = fetchImpl.mock.calls[0]![1];
    expect(init?.credentials).toBe("same-origin");
  });
});
