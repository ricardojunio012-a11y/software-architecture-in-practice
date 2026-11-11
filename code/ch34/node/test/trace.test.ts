import { describe, expect, it } from "vitest";
import { trace } from "@opentelemetry/api";
import { pay } from "../src/payment.ts";
import {
  InMemoryExporter,
  Log,
  SeededIds,
  extract,
  inject,
  tracers,
} from "../src/telemetry.ts";

const SERVICES = ["app", "billing", "billing-relay", "communications"];

function run(traceparentInOutbox: boolean) {
  const exporter = new InMemoryExporter();
  const log = new Log();
  const t = tracers(SERVICES, exporter, new SeededIds(1));
  pay(t, log, { charge: "C-1", resident: "R-1", traceparentInOutbox });
  return { spans: exporter.spans, log };
}

describe("context propagation", () => {
  it("the traceparent carries the trace and the span across", () => {
    const t = tracers(["a"], new InMemoryExporter(), new SeededIds(2)).a;
    const s = t.startSpan("x");
    const carrier = inject(trace.setSpan(extract({}), s));
    expect(carrier.traceparent).toMatch(/^00-[0-9a-f]{32}-[0-9a-f]{16}-01$/);
    const received = trace.getSpanContext(extract(carrier));
    expect(received?.traceId).toBe(s.spanContext().traceId);
    expect(received?.spanId).toBe(s.spanContext().spanId);
  });

  it("with the traceparent in the outbox, payment and email are in one trace", () => {
    const { spans, log } = run(true);
    const traces = new Set(spans.map((s) => s.spanContext().traceId));
    expect(spans).toHaveLength(11);
    expect(traces.size).toBe(1);
    for (const line of log.lines)
      expect(traces.has(JSON.parse(line).trace_id)).toBe(true);
  });

  it("without it, the trace splits in two at the outbox", () => {
    const { spans } = run(false);
    expect(new Set(spans.map((s) => s.spanContext().traceId)).size).toBe(2);
  });

  it("the logs do not carry the resident's email address", () => {
    const { log } = run(true);
    expect(log.lines.join("\n")).not.toMatch(/@/);
  });
});
