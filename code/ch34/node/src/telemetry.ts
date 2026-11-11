import {
  type Context,
  type Span,
  type Tracer,
  defaultTextMapGetter,
  defaultTextMapSetter,
  ROOT_CONTEXT,
  trace,
} from "@opentelemetry/api";
import { ExportResultCode, W3CTraceContextPropagator } from "@opentelemetry/core";
import { resourceFromAttributes } from "@opentelemetry/resources";
import {
  BasicTracerProvider,
  type IdGenerator,
  type ReadableSpan,
  type Sampler,
  type SpanExporter,
  SimpleSpanProcessor,
} from "@opentelemetry/sdk-trace-base";
import { generator } from "./random.ts";

// Trace and span ids drawn from a seed, so that the output is the same on every run.
// In production, the SDK uses its default random generator.
export class SeededIds implements IdGenerator {
  #draw: () => number;
  constructor(seed: number) {
    this.#draw = generator(seed);
  }
  #hex(bytes: number): string {
    let s = "";
    for (let i = 0; i < bytes; i++) {
      s += Math.floor(this.#draw() * 256)
        .toString(16)
        .padStart(2, "0");
    }
    return s;
  }
  generateTraceId(): string {
    return this.#hex(16);
  }
  generateSpanId(): string {
    return this.#hex(8);
  }
}

// An exporter that keeps the finished spans; trace.ts writes them to a JSONL file.
// In its place would go the OTLP exporter, which sends them to a collector.
export class InMemoryExporter implements SpanExporter {
  spans: ReadableSpan[] = [];
  export(spans: ReadableSpan[], done: (r: { code: number }) => void): void {
    this.spans.push(...spans);
    done({ code: ExportResultCode.SUCCESS });
  }
  async shutdown(): Promise<void> {}
}

// The simulated clock: every instant is "start of the test + ms"
const START = Date.UTC(2026, 10, 5, 12, 0, 0); // November 5, 2026, 7 a.m. in New York
export const at = (ms: number): Date => new Date(START + ms);

// One "Tracer" per service: each has its own service.name, all export to the same
// place and draw their ids from the same sequence
export function tracers(
  services: string[],
  exporter: SpanExporter,
  ids: IdGenerator,
  sampler?: Sampler,
): Record<string, Tracer> {
  const r: Record<string, Tracer> = {};
  for (const name of services) {
    const provider = new BasicTracerProvider({
      resource: resourceFromAttributes({ "service.name": name }),
      idGenerator: ids,
      sampler,
      spanProcessors: [new SimpleSpanProcessor(exporter)],
    });
    r[name] = provider.getTracer("morada");
  }
  return r;
}

// W3C Trace Context propagation: the context becomes the traceparent header and back
const propagator = new W3CTraceContextPropagator();

export function inject(ctx: Context): Record<string, string> {
  const carrier: Record<string, string> = {};
  propagator.inject(ctx, carrier, defaultTextMapSetter);
  return carrier;
}

export function extract(carrier: Record<string, string>): Context {
  return propagator.extract(ROOT_CONTEXT, carrier, defaultTextMapGetter);
}

export const within = (span: Span, ctx: Context = ROOT_CONTEXT): Context =>
  trace.setSpan(ctx, span);

// Structured log: one JSON object per line, with the trace and span it came from
export class Log {
  lines: string[] = [];
  record(
    ms: number,
    level: "info" | "warn" | "error",
    service: string,
    span: Span,
    msg: string,
    fields: Record<string, string | number> = {},
  ): void {
    const { traceId, spanId } = span.spanContext();
    const ts = at(ms).toISOString();
    const line = { ts, level, service, msg, ...fields };
    this.lines.push(JSON.stringify({ ...line, trace_id: traceId, span_id: spanId }));
  }
}
