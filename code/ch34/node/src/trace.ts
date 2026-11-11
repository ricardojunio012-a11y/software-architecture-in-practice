import { mkdirSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { SpanKind, SpanStatusCode } from "@opentelemetry/api";
import { hrTimeToMilliseconds } from "@opentelemetry/core";
import type { ReadableSpan } from "@opentelemetry/sdk-trace-base";
import { pay } from "./payment.ts";
import { InMemoryExporter, Log, SeededIds, tracers } from "./telemetry.ts";

const SERVICES = ["app", "billing", "billing-relay", "communications"];
const KINDS: Record<number, string> = {
  [SpanKind.INTERNAL]: "internal",
  [SpanKind.SERVER]: "server",
  [SpanKind.CLIENT]: "client",
  [SpanKind.PRODUCER]: "producer",
  [SpanKind.CONSUMER]: "consumer",
};

const ms = (s: ReadableSpan, end = false) =>
  hrTimeToMilliseconds(end ? s.endTime : s.startTime);
const service = (s: ReadableSpan) => String(s.resource.attributes["service.name"]);

function run(traceparentInOutbox: boolean) {
  const exporter = new InMemoryExporter();
  const log = new Log();
  const t = tracers(SERVICES, exporter, new SeededIds(34));
  pay(t, log, { charge: "C-2026-11-0412", resident: "R-8812", traceparentInOutbox });
  return { spans: exporter.spans, log };
}

// Draws each trace as a tree: start and duration in ms, service and span
function tree(spans: ReadableSpan[]): string[] {
  const t0 = Math.min(...spans.map((s) => ms(s)));
  const children = new Map<string, ReadableSpan[]>();
  const ids = new Set(spans.map((s) => s.spanContext().spanId));
  const roots: ReadableSpan[] = [];
  for (const s of [...spans].sort((a, b) => ms(a) - ms(b))) {
    const parent = s.parentSpanContext?.spanId;
    if (parent && ids.has(parent))
      children.set(parent, [...(children.get(parent) ?? []), s]);
    else roots.push(s);
  }
  const lines: string[] = [];
  const visit = (s: ReadableSpan, depth: number) => {
    const start = String(ms(s) - t0).padStart(6);
    const duration = String(ms(s, true) - ms(s)).padStart(5);
    const status = s.attributes["http.response.status_code"];
    const error =
      s.status.code === SpanStatusCode.ERROR ? ` ERROR: ${s.status.message}` : "";
    const name = `${"  ".repeat(depth)}${s.name} (${KINDS[s.kind]})`;
    const end = status ? ` ${status}` : error;
    lines.push(`${start} ${duration} ms  ${service(s).padEnd(17)}${name}${end}`);
    for (const c of children.get(s.spanContext().spanId) ?? []) visit(c, depth + 1);
  };
  for (const r of roots) {
    const ofTrace = spans.filter(
      (s) => s.spanContext().traceId === r.spanContext().traceId,
    );
    const end = Math.max(...ofTrace.map((s) => ms(s, true)));
    const services = new Set(ofTrace.map(service)).size;
    lines.push(
      "",
      `trace ${r.spanContext().traceId}: ${ofTrace.length} spans, ` +
        `${services} services, ${end - ms(r)} ms`,
      " start duration  service          span",
    );
    visit(r, 0);
  }
  return lines;
}

function jsonl(spans: ReadableSpan[]): string {
  return spans
    .map((s) =>
      JSON.stringify({
        trace_id: s.spanContext().traceId,
        span_id: s.spanContext().spanId,
        parent_span_id: s.parentSpanContext?.spanId ?? null,
        service: service(s),
        name: s.name,
        kind: KINDS[s.kind],
        start: new Date(ms(s)).toISOString(),
        end: new Date(ms(s, true)).toISOString(),
        attributes: s.attributes,
        status: s.status.code === SpanStatusCode.ERROR ? s.status.message : "ok",
      }),
    )
    .join("\n");
}

const folder = join(process.argv[2] ?? ".", "output", "trace");
mkdirSync(folder, { recursive: true });

const whole = run(true);
const broken = run(false);
const email = (l: Log) => JSON.parse(l.lines.at(-1) ?? "{}").trace_id as string;
const payment = whole.spans.find((s) => !s.parentSpanContext)?.spanContext().traceId;
const brokenTraces = new Set(broken.spans.map((s) => s.spanContext().traceId));

const text = [
  "Payment of charge C-2026-11-0412, from the app to the email",
  "",
  "1. With the traceparent in the HTTP header, in the outbox, and in the queue message",
  ...tree(whole.spans),
  "",
  `   the email log has trace_id ${email(whole.log)}`,
  `   the same as the payment: ${email(whole.log) === payment ? "yes" : "no"}`,
  "",
  "2. Without the traceparent column in the outbox",
  `   traces: ${brokenTraces.size}`,
  ...tree(broken.spans),
  "",
  `   the email log has trace_id ${email(broken.log)}`,
  "   whoever searches the payment trace does not find the email",
  "",
];
writeFileSync(join(folder, "trace.txt"), text.join("\n"));
writeFileSync(join(folder, "spans.jsonl"), jsonl(whole.spans) + "\n");
writeFileSync(join(folder, "logs.jsonl"), whole.log.lines.join("\n") + "\n");
console.log(text.join("\n"));
