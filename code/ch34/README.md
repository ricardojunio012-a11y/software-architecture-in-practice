# Chapter 34: Observability and site reliability engineering (SRE)

Lab for chapter 34 of *Software Architecture in Practice*.

The payment of a community's monthly dues is traced with the OpenTelemetry SDK, from the resident's app to the confirmation email, through the outbox and the queue. Then ten minutes of API traffic become RED metrics, a cardinality test, and a sampling comparison. Finally, a whole month of the payments API, minute by minute, measures the SLI and the SLO's error budget and shows which burn rate alerts fire, and when. Everything runs in a single process, with a simulated clock and fixed seeds: the output is always the same.

| Version | What it does |
|---|---|
| `trace` | The payment trace with the context propagated and without the `traceparent` in the outbox; writes `trace.txt`, `spans.jsonl` (the exporter), and `logs.jsonl` (structured logs with `trace_id`) |
| `metrics` | RED per route from an OpenTelemetry histogram, the cardinality with and without the community as an attribute, and head and tail sampling |
| `slo` | A simulated November: SLI, budget of the 99.95% SLO, 99.9% SLA, multiwindow alerts (SRE Workbook), and a naive alert for comparison; writes `result.txt`, `budget.csv`, and `naive-alert.txt` |

## Prerequisite

Docker with Docker Compose. This lab has only the TypeScript version and does not publish any port on the host.

## Walkthrough

```bash
docker compose run --rm app trace
docker compose run --rm tools verify trace
docker compose run --rm app metrics
docker compose run --rm tools verify metrics
docker compose run --rm app slo
docker compose run --rm tools verify slo
docker compose run --rm app tests
```

## Try it

- In `src/payment.ts`, remove the `traceparent` from the HTTP header and see how many traces are left.
- In `src/metrics.ts`, add the 0.4 s bucket and compare the estimated p95 with the exact one.
- In `src/slo.ts`, change the SLO to 99.9% and see which alerts stop firing.
- In `src/slo.ts`, make incident B last 10 minutes: does the 1-hour page fire?

## Jaeger, Prometheus, and Grafana

The lab uses the OpenTelemetry SDK with an in-memory exporter, so that the output can be verified and no port is published. To see the trace in a UI, replace the `InMemoryExporter` with the OTLP exporter (`@opentelemetry/exporter-trace-otlp-http`) and start a Jaeger with its UI port published, on a machine where that does not get in the way of other projects.
