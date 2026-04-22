import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { createReporter, type MetricName } from "./reporter";

type Subscriber = (metric: {
  name: "LCP" | "INP" | "CLS" | "TTFB" | "FCP";
  value: number;
  rating: "good" | "needs-improvement" | "poor";
}) => void;

function withDeferredFetch() {
  const fetchImpl = vi.fn<typeof fetch>(
    async () => new Response(null, { status: 201 }),
  );
  return fetchImpl;
}

function captureSubscriber() {
  const sub: { current: Subscriber | null } = { current: null };
  const register = (cb: Subscriber) => {
    sub.current = cb;
  };
  return { sub, register };
}

beforeEach(() => {
  // buildCSRFHeaders reads this; tests that care about the header
  // provide their own DOM, others rely on this default.
  document.head.innerHTML = '<meta name="csrf-token" content="test-csrf" />';
  vi.useFakeTimers();
});

afterEach(() => {
  vi.useRealTimers();
  document.head.innerHTML = "";
});

describe("createReporter", () => {
  it("buffers samples and flushes via POST when the idle timer fires", async () => {
    const { sub: lcpSub, register: registerLcp } = captureSubscriber();
    const fetchImpl = withDeferredFetch();

    const reporter = createReporter({
      subscribers: { lcp: registerLcp },
      sampleRate: 1,
      flushIntervalMs: 1_000,
      maxBatchSize: 100,
      sessionId: "s1",
      getRoute: () => "/dashboard",
      getUserAgent: () => "ua",
      fetchImpl,
    });
    reporter.subscribe();

    lcpSub.current?.({ name: "LCP", value: 1234.5, rating: "good" });
    expect(reporter.pending()).toHaveLength(1);
    expect(fetchImpl).not.toHaveBeenCalled();

    await vi.advanceTimersByTimeAsync(1_000);
    expect(fetchImpl).toHaveBeenCalledTimes(1);

    const [url, init] = fetchImpl.mock.calls[0]!;
    expect(url).toBe("/api/vitals");
    expect(init?.method).toBe("POST");
    expect((init?.headers as Record<string, string>)["X-CSRF-Token"]).toBe("test-csrf");
    expect((init?.headers as Record<string, string>)["content-type"]).toBe(
      "application/vnd.api+json",
    );
    const body = JSON.parse(init?.body as string);
    expect(body).toEqual({
      data: {
        type: "page-metric",
        attributes: {
          session_id: "s1",
          route: "/dashboard",
          metric_name: "lcp",
          value: 1234.5,
          rating: "good",
          user_agent: "ua",
        },
      },
    });
  });

  it("flushes eagerly once maxBatchSize is reached, independent of the timer", async () => {
    const { sub: lcpSub, register: registerLcp } = captureSubscriber();
    const fetchImpl = withDeferredFetch();

    const reporter = createReporter({
      subscribers: { lcp: registerLcp },
      sampleRate: 1,
      flushIntervalMs: 60_000,
      maxBatchSize: 3,
      fetchImpl,
    });
    reporter.subscribe();

    for (let i = 0; i < 3; i++) {
      lcpSub.current?.({ name: "LCP", value: i, rating: "good" });
    }

    // Give microtasks a tick to flush (send is async).
    await vi.advanceTimersByTimeAsync(0);
    // One POST per buffered sample — the reporter fans out at flush
    // time to keep the JSON:API contract one-resource-per-request.
    expect(fetchImpl).toHaveBeenCalledTimes(3);
    for (const [, init] of fetchImpl.mock.calls) {
      const body = JSON.parse(init?.body as string);
      expect(body.data.type).toBe("page-metric");
    }
  });

  it("normalizes web-vitals rating 'needs-improvement' to the Ash atom form", async () => {
    const { sub, register } = captureSubscriber();
    const fetchImpl = withDeferredFetch();

    const reporter = createReporter({
      subscribers: { inp: register },
      sampleRate: 1,
      flushIntervalMs: 100,
      fetchImpl,
    });
    reporter.subscribe();

    sub.current?.({ name: "INP", value: 200, rating: "needs-improvement" });
    await vi.advanceTimersByTimeAsync(100);

    const body = JSON.parse(fetchImpl.mock.calls[0]?.[1]?.body as string);
    expect(body.data.attributes.rating).toBe("needs_improvement");
    expect(body.data.attributes.metric_name).toBe("inp");
  });

  it("drops every sample when sampleRate === 0 (no fetch, no buffer)", async () => {
    const { sub, register } = captureSubscriber();
    const fetchImpl = withDeferredFetch();

    const reporter = createReporter({
      subscribers: { lcp: register },
      sampleRate: 0,
      flushIntervalMs: 100,
      fetchImpl,
    });
    reporter.subscribe();

    sub.current?.({ name: "LCP", value: 1, rating: "good" });
    sub.current?.({ name: "LCP", value: 2, rating: "good" });

    await vi.advanceTimersByTimeAsync(100);
    expect(reporter.pending()).toEqual([]);
    expect(fetchImpl).not.toHaveBeenCalled();
  });

  it("decides sample inclusion once per session, not per metric", async () => {
    const { sub, register } = captureSubscriber();
    const fetchImpl = withDeferredFetch();
    // random() returns 0.5; with sampleRate 0.4, 0.5 is NOT < 0.4, so
    // the session is out.
    const reporter = createReporter({
      subscribers: { lcp: register },
      sampleRate: 0.4,
      random: () => 0.5,
      flushIntervalMs: 100,
      fetchImpl,
    });
    reporter.subscribe();

    for (let i = 0; i < 5; i++) {
      sub.current?.({ name: "LCP", value: i, rating: "good" });
    }

    await vi.advanceTimersByTimeAsync(100);
    expect(fetchImpl).not.toHaveBeenCalled();
  });

  it("swallows network errors via onError so app code never sees them", async () => {
    const { sub, register } = captureSubscriber();
    const fetchImpl = vi.fn<typeof fetch>(async () => {
      throw new Error("network down");
    });
    const onError = vi.fn();

    const reporter = createReporter({
      subscribers: { lcp: register },
      sampleRate: 1,
      flushIntervalMs: 100,
      fetchImpl,
      onError,
    });
    reporter.subscribe();

    sub.current?.({ name: "LCP", value: 1, rating: "good" });

    // flush() is awaited internally; let the timer fire and the
    // rejected fetch settle before we assert.
    await vi.advanceTimersByTimeAsync(100);
    await Promise.resolve();
    await Promise.resolve();

    expect(onError).toHaveBeenCalledTimes(1);
    expect(onError.mock.calls[0]![0]).toBeInstanceOf(Error);
  });

  it("uses sendBeacon on pagehide so in-flight samples survive navigation", async () => {
    const { sub, register } = captureSubscriber();
    const fetchImpl = withDeferredFetch();
    const sendBeacon = vi.fn<(url: string, data: BodyInit) => boolean>(() => true);

    const reporter = createReporter({
      subscribers: { lcp: register },
      sampleRate: 1,
      flushIntervalMs: 60_000,
      fetchImpl,
      sendBeacon,
    });
    reporter.subscribe();

    sub.current?.({ name: "LCP", value: 42, rating: "good" });

    window.dispatchEvent(new Event("pagehide"));

    expect(sendBeacon).toHaveBeenCalledTimes(1);
    const [beaconUrl, beaconBody] = sendBeacon.mock.calls[0]!;
    expect(beaconUrl).toBe("/api/vitals");
    expect(beaconBody).toBeInstanceOf(Blob);
    expect((beaconBody as Blob).type).toBe("application/vnd.api+json");
    // Regular fetch should NOT fire for the beacon path.
    expect(fetchImpl).not.toHaveBeenCalled();
  });

  it("subscribes to every metric name passed in", async () => {
    const registrations: Record<string, Subscriber | null> = {};
    const fetchImpl = withDeferredFetch();

    const subscribers: Record<MetricName, (cb: Subscriber) => void> = {
      lcp: (cb) => (registrations.lcp = cb),
      inp: (cb) => (registrations.inp = cb),
      cls: (cb) => (registrations.cls = cb),
      ttfb: (cb) => (registrations.ttfb = cb),
      fcp: (cb) => (registrations.fcp = cb),
    };

    const reporter = createReporter({
      subscribers,
      sampleRate: 1,
      flushIntervalMs: 100,
      fetchImpl,
    });
    reporter.subscribe();

    for (const name of ["lcp", "inp", "cls", "ttfb", "fcp"] as const) {
      expect(typeof registrations[name]).toBe("function");
    }
  });
});
