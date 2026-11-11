import {
  type Context,
  type Tracer,
  SpanKind,
  SpanStatusCode,
} from "@opentelemetry/api";
import { type Log, at, extract, inject, within } from "./telemetry.ts";

// Paying a community's monthly dues, from the app to the email, on a simulated clock.
// Each service knows only what reaches it: HTTP headers, the outbox row, and the
// queue message. The trace context travels in these three carriers.
export interface Options {
  charge: string;
  resident: string;
  traceparentInOutbox: boolean; // the column the team forgot to create
}

const { CLIENT, SERVER, PRODUCER, CONSUMER, INTERNAL } = SpanKind;

export function pay(t: Record<string, Tracer>, log: Log, o: Options): void {
  // 1. The resident's app calls the API and sends the traceparent in the header
  const app = t.app.startSpan("POST /v1/payments", {
    kind: CLIENT,
    startTime: at(0),
    attributes: { "http.request.method": "POST" },
  });
  const headers = inject(within(app));

  // 2. The Billing API extracts the context and continues the same trace
  const api = t.billing.startSpan(
    "POST /v1/payments",
    {
      kind: SERVER,
      startTime: at(12),
      attributes: { "http.route": "/v1/payments", "morada.charge": o.charge },
    },
    extract(headers),
  );
  const ctxApi = within(api);
  query(t.billing, ctxApi, "SELECT morada.charges", 20, 28);

  // 3. The gateway: the first attempt hits the 300 ms timeout (chapter 29)
  const g1 = t.billing.startSpan(
    "POST /authorizations",
    { kind: CLIENT, startTime: at(30), attributes: { "server.address": "gateway" } },
    ctxApi,
  );
  g1.setStatus({ code: SpanStatusCode.ERROR, message: "timeout" });
  log.record(330, "warn", "billing", g1, "no response from gateway; retrying", {
    charge: o.charge,
    attempt: 1,
  });
  g1.end(at(330));
  const g2 = t.billing.startSpan(
    "POST /authorizations",
    {
      kind: CLIENT,
      startTime: at(370),
      attributes: { "server.address": "gateway", "http.request.resend_count": 1 },
    },
    ctxApi,
  );
  g2.setAttribute("http.response.status_code", 200);
  g2.end(at(418));

  // 4. In the same transaction: the charge is paid and the event goes to the outbox
  query(t.billing, ctxApi, "UPDATE morada.charges", 420, 426);
  query(t.billing, ctxApi, "INSERT morada.outbox", 426, 431);
  const outbox = {
    event: "PaymentConfirmed",
    charge: o.charge,
    resident: o.resident,
    // without this column, the trace context dies here
    traceparent: o.traceparentInOutbox ? inject(ctxApi).traceparent : "",
  };
  log.record(432, "info", "billing", api, "payment confirmed", {
    charge: o.charge,
    resident: o.resident,
  });
  api.setAttribute("http.response.status_code", 201);
  api.end(at(440));
  app.end(at(452));

  // 5. The relay reads the outbox every second and publishes to the queue
  const ctxOutbox = extract({ traceparent: outbox.traceparent });
  const pub = t["billing-relay"].startSpan(
    "publish payments.confirmed",
    {
      kind: PRODUCER,
      startTime: at(1640),
      attributes: { "messaging.system": "rabbitmq" },
    },
    ctxOutbox,
  );
  const message = { body: outbox, headers: inject(within(pub, ctxOutbox)) };
  pub.end(at(1646));

  // 6. Communications consumes the message and sends the email
  const proc = t.communications.startSpan(
    "process payments.confirmed",
    {
      kind: CONSUMER,
      startTime: at(2110),
      attributes: { "messaging.system": "rabbitmq" },
    },
    extract(message.headers),
  );
  const ctxProc = within(proc, extract(message.headers));
  const build = t.communications.startSpan(
    "build notice",
    { kind: INTERNAL, startTime: at(2115) },
    ctxProc,
  );
  build.end(at(2130));
  const smtp = t.communications.startSpan(
    "smtp send",
    { kind: CLIENT, startTime: at(2135), attributes: { "server.address": "smtp" } },
    ctxProc,
  );
  smtp.end(at(2840));
  // the log carries the resident's id, never the email address (chapter 37)
  log.record(2845, "info", "communications", proc, "confirmation email sent", {
    charge: o.charge,
    resident: o.resident,
  });
  proc.end(at(2850));
}

function query(t: Tracer, ctx: Context, name: string, from: number, to: number) {
  const s = t.startSpan(
    name,
    {
      kind: CLIENT,
      startTime: at(from),
      attributes: { "db.system.name": "postgresql" },
    },
    ctx,
  );
  s.end(at(to));
  return s;
}
