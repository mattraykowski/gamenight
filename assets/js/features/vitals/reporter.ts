import { buildCSRFHeaders } from "@/ash_rpc";

/**
 * Web-vitals reporter: subscribes to the browser's Core Web Vitals
 * measurements, batches them per page view, and POSTs them to the
 * Phoenix `/api/vitals` endpoint using the JSON:API envelope.
 *
 * Design choices worth calling out, because they shape every test in
 * `reporter.test.ts`:
 *
 * - **Sampling is decided once per session**, not per metric. That
 *   keeps "report nothing" / "report everything" sessions cleanly
 *   bucketed so downstream percentile math isn't distorted by partial
 *   reports.
 * - **Batching is session-local**. We accumulate until a flush trigger
 *   (idle timer, `visibilitychange -> hidden`, or `pagehide`) and
 *   ship with `sendBeacon` when the page is unloading — regular
 *   `fetch` during normal activity so the CSRF header can ride along.
 * - **Silent failure**. Vitals telemetry must never throw into the
 *   app; reporter rejections are swallowed after one attempt.
 */

export type MetricName = "lcp" | "inp" | "cls" | "ttfb" | "fcp";
export type Rating = "good" | "needs_improvement" | "poor";

export interface VitalSample {
  session_id: string;
  route: string;
  metric_name: MetricName;
  value: number;
  rating: Rating;
  user_agent?: string;
}

type WebVitalsMetric = {
  name: "LCP" | "INP" | "CLS" | "TTFB" | "FCP";
  value: number;
  rating: "good" | "needs-improvement" | "poor";
};

type Subscribe = (handler: (metric: WebVitalsMetric) => void) => void;

export interface ReporterConfig {
  endpoint?: string;
  sampleRate?: number;
  sessionId?: string;
  flushIntervalMs?: number;
  maxBatchSize?: number;
  getRoute?: () => string;
  getUserAgent?: () => string | undefined;
  random?: () => number;
  fetchImpl?: typeof fetch;
  sendBeacon?: (url: string, data: BodyInit) => boolean;
  onError?: (error: unknown) => void;
  /**
   * The web-vitals subscribers. Default wires to the real `web-vitals`
   * library via `installReporter(...)`. Tests pass hand-rolled
   * subscribers so the timing/visibility behavior is deterministic.
   */
  subscribers?: Partial<Record<MetricName, Subscribe>>;
}

export interface Reporter {
  record(sample: VitalSample): void;
  flush(): Promise<void>;
  subscribe(): () => void;
  pending(): VitalSample[];
}

const DEFAULTS = {
  endpoint: "/api/vitals",
  flushIntervalMs: 5_000,
  maxBatchSize: 20,
} as const;

const RATING_MAP: Record<WebVitalsMetric["rating"], Rating> = {
  good: "good",
  "needs-improvement": "needs_improvement",
  poor: "poor",
};

const METRIC_MAP: Record<WebVitalsMetric["name"], MetricName> = {
  LCP: "lcp",
  INP: "inp",
  CLS: "cls",
  TTFB: "ttfb",
  FCP: "fcp",
};

function toEnvelope(sample: VitalSample) {
  return {
    data: {
      type: "page-metric",
      attributes: sample,
    },
  };
}

/**
 * Factory for a single reporter instance. The reporter is idempotent
 * — calling `subscribe()` twice wires two listeners, so applications
 * should call `subscribe()` once at boot and call the returned
 * cleanup on teardown.
 */
export function createReporter(config: ReporterConfig = {}): Reporter {
  const endpoint = config.endpoint ?? DEFAULTS.endpoint;
  const flushIntervalMs = config.flushIntervalMs ?? DEFAULTS.flushIntervalMs;
  const maxBatchSize = config.maxBatchSize ?? DEFAULTS.maxBatchSize;
  const sampleRate = clampSampleRate(config.sampleRate);
  const random = config.random ?? Math.random;
  const sessionId = config.sessionId ?? defaultSessionId();
  const getRoute = config.getRoute ?? defaultGetRoute;
  const getUserAgent = config.getUserAgent ?? defaultGetUserAgent;
  const fetchImpl = config.fetchImpl ?? (typeof fetch === "function" ? fetch : undefined);
  const sendBeacon = config.sendBeacon ?? defaultSendBeacon;
  const onError = config.onError ?? (() => {});
  const subscribers = config.subscribers ?? {};

  // Sample gate: compute once at construction so every metric in a
  // session is coherent. sampleRate: 0 → always skip, 1 → always send.
  const includedInSample = sampleRate === 1 || (sampleRate > 0 && random() < sampleRate);

  let buffer: VitalSample[] = [];
  let flushTimer: ReturnType<typeof setTimeout> | null = null;

  function scheduleFlush() {
    if (flushTimer !== null) return;
    flushTimer = setTimeout(() => {
      flushTimer = null;
      void flush();
    }, flushIntervalMs);
  }

  function clearFlushTimer() {
    if (flushTimer !== null) {
      clearTimeout(flushTimer);
      flushTimer = null;
    }
  }

  function record(sample: VitalSample) {
    if (!includedInSample) return;
    buffer.push(sample);
    if (buffer.length >= maxBatchSize) {
      void flush();
    } else {
      scheduleFlush();
    }
  }

  async function flush(): Promise<void> {
    clearFlushTimer();
    if (buffer.length === 0) return;
    const batch = buffer;
    buffer = [];
    await send(batch, { beacon: false });
  }

  async function send(
    batch: VitalSample[],
    { beacon }: { beacon: boolean },
  ): Promise<void> {
    // Batching lives in memory for timing control only — the JSON:API
    // `POST /vitals` route takes one resource per request, so we fan
    // out at flush time. A handful of POSTs per page view is cheap
    // and keeps the server contract canonical.
    for (const sample of batch) {
      const body = JSON.stringify(toEnvelope(sample));
      try {
        if (beacon) {
          sendBeacon(endpoint, new Blob([body], { type: "application/vnd.api+json" }));
          continue;
        }
        if (!fetchImpl) return;
        await fetchImpl(endpoint, {
          method: "POST",
          credentials: "same-origin",
          headers: {
            "content-type": "application/vnd.api+json",
            accept: "application/vnd.api+json",
            ...buildCSRFHeaders(),
          },
          body,
          keepalive: true,
        });
      } catch (err) {
        onError(err);
      }
    }
  }

  function subscribe(): () => void {
    const disposers: Array<() => void> = [];

    for (const metric of Object.keys(subscribers) as MetricName[]) {
      const subscribe = subscribers[metric];
      if (!subscribe) continue;
      subscribe((raw) => {
        record({
          session_id: sessionId,
          route: getRoute(),
          metric_name: METRIC_MAP[raw.name] ?? metric,
          value: raw.value,
          rating: RATING_MAP[raw.rating],
          user_agent: getUserAgent(),
        });
      });
    }

    const handleHidden = () => {
      if (typeof document !== "undefined" && document.visibilityState === "hidden") {
        flushWithBeacon();
      }
    };
    const handlePageHide = () => flushWithBeacon();

    function flushWithBeacon() {
      if (buffer.length === 0) return;
      clearFlushTimer();
      const batch = buffer;
      buffer = [];
      void send(batch, { beacon: true });
    }

    if (typeof document !== "undefined") {
      document.addEventListener("visibilitychange", handleHidden);
      disposers.push(() =>
        document.removeEventListener("visibilitychange", handleHidden),
      );
    }
    if (typeof window !== "undefined") {
      window.addEventListener("pagehide", handlePageHide);
      disposers.push(() => window.removeEventListener("pagehide", handlePageHide));
    }

    return () => {
      for (const dispose of disposers) dispose();
      clearFlushTimer();
    };
  }

  return {
    record,
    flush,
    subscribe,
    pending: () => [...buffer],
  };
}

function clampSampleRate(value: number | undefined): number {
  if (typeof value !== "number" || Number.isNaN(value)) return 1;
  if (value < 0) return 0;
  if (value > 1) return 1;
  return value;
}

function defaultSessionId(): string {
  if (typeof crypto !== "undefined" && typeof crypto.randomUUID === "function") {
    return crypto.randomUUID();
  }
  return `session-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 10)}`;
}

function defaultGetRoute(): string {
  if (typeof window === "undefined") return "/";
  return window.location.pathname + window.location.search;
}

function defaultGetUserAgent(): string | undefined {
  if (typeof navigator === "undefined") return undefined;
  return navigator.userAgent;
}

function defaultSendBeacon(url: string, data: BodyInit): boolean {
  if (typeof navigator !== "undefined" && typeof navigator.sendBeacon === "function") {
    return navigator.sendBeacon(url, data);
  }
  return false;
}

/**
 * Wires {@link createReporter} to the real `web-vitals` library. Kept
 * separate from the factory so unit tests never have to import
 * `web-vitals` — they pass their own subscribers.
 */
export async function installReporter(
  config: Omit<ReporterConfig, "subscribers"> = {},
): Promise<() => void> {
  const { onLCP, onINP, onCLS, onTTFB, onFCP } = await import("web-vitals");

  const reporter = createReporter({
    ...config,
    subscribers: {
      lcp: (cb) => onLCP(cb as (m: WebVitalsMetric) => void),
      inp: (cb) => onINP(cb as (m: WebVitalsMetric) => void),
      cls: (cb) => onCLS(cb as (m: WebVitalsMetric) => void),
      ttfb: (cb) => onTTFB(cb as (m: WebVitalsMetric) => void),
      fcp: (cb) => onFCP(cb as (m: WebVitalsMetric) => void),
    },
  });

  return reporter.subscribe();
}
