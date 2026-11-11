import { mkdirSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { type Attributes, SpanKind, SpanStatusCode } from "@opentelemetry/api";
import { hrTimeToMilliseconds } from "@opentelemetry/core";
import { resourceFromAttributes } from "@opentelemetry/resources";
import {
  type HistogramMetricData,
  MeterProvider,
  MetricReader,
} from "@opentelemetry/sdk-metrics";
import { TraceIdRatioBasedSampler } from "@opentelemetry/sdk-trace-base";
import { duration, generator } from "./random.ts";
import { InMemoryExporter, SeededIds, at, tracers } from "./telemetry.ts";

// Ten minutes of Morada API traffic, generated from a seed: payments and charge
// lookups, with errors and a tail of slow requests
interface Request {
  route: string;
  method: string;
  status: number;
  ms: number;
  start: number;
  community: number;
}

export function traffic(seed: number): Request[] {
  const draw = generator(seed);
  const requests: Request[] = [];
  for (let i = 0; i < 4200; i++) {
    const payment = i % 7 < 2; // 1,200 payments and 3,000 lookups
    const community = 1 + Math.floor(draw() * 3000);
    const failed = draw() < (payment ? 0.015 : 0.002);
    const ms = failed && payment ? 300 : duration(draw, payment ? 180 : 40);
    requests.push({
      route: payment ? "/v1/payments" : "/v1/charges",
      method: payment ? "POST" : "GET",
      status: failed ? (payment ? 504 : 500) : payment ? 201 : 200,
      ms,
      start: Math.floor((i * 600_000) / 4200),
      community,
    });
  }
  return requests;
}

// A metric reader triggered by hand: the program asks for the collection when it wants
class ManualReader extends MetricReader {
  protected async onShutdown(): Promise<void> {}
  protected async onForceFlush(): Promise<void> {}
}

// The default buckets of the semantic conventions for HTTP durations, in seconds
const BUCKETS = [
  0.005, 0.01, 0.025, 0.05, 0.075, 0.1, 0.25, 0.5, 0.75, 1, 2.5, 5, 7.5, 10,
];

async function histogram(requests: Request[], withCommunity: boolean) {
  const reader = new ManualReader();
  const provider = new MeterProvider({
    resource: resourceFromAttributes({ "service.name": "billing" }),
    readers: [reader],
  });
  const httpDuration = provider
    .getMeter("morada")
    .createHistogram("http.server.request.duration", {
      unit: "s",
      advice: { explicitBucketBoundaries: BUCKETS },
    });
  for (const r of requests) {
    const attributes: Attributes = {
      "http.request.method": r.method,
      "http.route": r.route,
      "http.response.status_code": r.status,
    };
    if (withCommunity) attributes["morada.community"] = r.community; // do not do this
    httpDuration.record(r.ms / 1000, attributes);
  }
  const { resourceMetrics } = await reader.collect();
  return resourceMetrics.scopeMetrics[0].metrics[0] as HistogramMetricData;
}

// The percentile estimated from the buckets, as Prometheus's histogram_quantile does
export function bucketPercentile(bounds: number[], counts: number[], q: number) {
  const total = counts.reduce((a, b) => a + b, 0);
  let cumulative = 0;
  for (let i = 0; i < counts.length; i++) {
    if (cumulative + counts[i] >= q * total) {
      const from = i === 0 ? 0 : bounds[i - 1];
      const to = bounds[i] ?? bounds[bounds.length - 1];
      return from + ((to - from) * (q * total - cumulative)) / counts[i];
    }
    cumulative += counts[i];
  }
  return bounds[bounds.length - 1];
}

function exactPercentile(values: number[], q: number): number {
  const sorted = [...values].sort((a, b) => a - b);
  return sorted[Math.ceil(q * sorted.length) - 1];
}

const num = (n: number) => n.toLocaleString("en-US");

async function main() {
  const requests = traffic(34);
  const lines: string[] = ["Ten minutes of the Billing API: 4,200 requests", ""];

  // 1. RED per route, from the duration histogram
  const h = await histogram(requests, false);
  lines.push(
    "1. RED per route (rate, errors, duration)",
    "route                  rate errors     p50     p95     p99  p95 from buckets",
  );
  for (const route of ["/v1/payments", "/v1/charges"]) {
    const ofRoute = requests.filter((r) => r.route === route);
    const errors = ofRoute.filter((r) => r.status >= 500).length;
    const points = h.dataPoints.filter((d) => d.attributes["http.route"] === route);
    const counts = BUCKETS.map((_, i) =>
      points.reduce((s, d) => s + d.value.buckets.counts[i], 0),
    );
    counts.push(points.reduce((s, d) => s + d.value.buckets.counts[BUCKETS.length], 0));
    const ms = ofRoute.map((r) => r.ms);
    const p95b = bucketPercentile(BUCKETS, counts, 0.95) * 1000;
    lines.push(
      `${ofRoute[0].method.padEnd(5)}${route.padEnd(15)}` +
        `${((ofRoute.length / 600).toFixed(1) + "/s").padStart(7)}` +
        `${(((100 * errors) / ofRoute.length).toFixed(1) + "%").padStart(7)}` +
        [0.5, 0.95, 0.99]
          .map((q) => `${exactPercentile(ms, q)} ms`.padStart(8))
          .join("") +
        `${Math.round(p95b)} ms`.padStart(18),
    );
  }

  // 2. Cardinality: the same histogram, with and without the community as an attribute
  const withCommunity = await histogram(requests, true);
  const perSeries = BUCKETS.length + 3; // the buckets, +Inf, the sum, and the count
  const series = (name: string, n: number) =>
    name.padEnd(40) + num(n).padStart(7) + num(n * perSeries).padStart(23);
  const header = "attributes".padEnd(40) + "series".padStart(7);
  lines.push(
    "",
    "2. Cardinality of the duration histogram",
    header + "series in Prometheus".padStart(23),
    series("method, route, and status", h.dataPoints.length),
    series("method, route, status, and community", withCommunity.dataPoints.length),
  );

  // 3. Sampling: one span per request, kept whole, at the head or at the tail
  const all = new InMemoryExporter();
  const head = new InMemoryExporter();
  const t1 = tracers(["billing"], all, new SeededIds(7)).billing;
  const sampler = new TraceIdRatioBasedSampler(0.1);
  const t2 = tracers(["billing"], head, new SeededIds(7), sampler).billing;
  for (const r of requests) {
    for (const t of [t1, t2]) {
      const s = t.startSpan(`${r.method} ${r.route}`, {
        kind: SpanKind.SERVER,
        startTime: at(r.start),
      });
      if (r.status >= 500) s.setStatus({ code: SpanStatusCode.ERROR });
      s.end(at(r.start + r.ms));
    }
  }
  const slow = 400;
  const durationMs = (s: (typeof all.spans)[number]) =>
    hrTimeToMilliseconds(s.endTime) - hrTimeToMilliseconds(s.startTime);
  const error = (s: (typeof all.spans)[number]) =>
    s.status.code === SpanStatusCode.ERROR;
  // the tail decides after seeing the trace: errors, slow ones, and 10% of the rest
  const tail = all.spans.filter(
    (s) =>
      error(s) ||
      durationMs(s) > slow ||
      parseInt(s.spanContext().traceId.slice(-8), 16) / 2 ** 32 < 0.1,
  );
  const row = (name: string, ss: typeof all.spans) =>
    `${name.padEnd(36)}${num(ss.length).padStart(6)}` +
    `${String(ss.filter(error).length).padStart(11)}` +
    `${String(ss.filter((s) => durationMs(s) > slow).length).padStart(9)}`;
  lines.push(
    "",
    `3. Trace sampling (slow: over ${slow} ms)`,
    "strategy                            traces with error     slow",
    row("keep everything", all.spans),
    row("at the head, 10% by trace_id", head.spans),
    row("at the tail, errors, slow, and 10%", tail),
    "",
  );

  const folder = join(process.argv[2] ?? ".", "output", "metrics");
  mkdirSync(folder, { recursive: true });
  writeFileSync(join(folder, "result.txt"), lines.join("\n"));
  console.log(lines.join("\n"));
}

if (process.argv[1]?.endsWith("metrics.ts")) await main();
