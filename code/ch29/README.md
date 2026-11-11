# Chapter 29: Resilience and failure modes

Lab for chapter 29 of *Software Architecture in Practice*.

The payment gateway goes down and then turns unstable, and Morada, with 16 workers, serves 20 payments and 50 notice lookups per second. The protections come in one at a time: timeout, retries with exponential backoff and jitter, circuit breaker, and bulkhead. Everything runs on a simulated clock, with fixed seeds: six seconds of traffic take a fraction of a second, and the result is always the same.

| Version | What it does |
|---|---|
| `resilience` | Runs the scenario with the protections added one at a time, and with the bulkhead alone |
| `layers` | Shows retries multiplying across three layers, and the effect of a retry budget |

## Prerequisite

Docker with Docker Compose. This lab has only the TypeScript version and starts no other services.

## Walkthrough

```bash
docker compose run --rm app resilience
docker compose run --rm tools verify resilience
docker compose run --rm app layers
docker compose run --rm tools verify layers
docker compose run --rm app tests
```

## Try it

- Change the timeout from 300 ms to 3,000 ms and to 30 ms.
- Remove the jitter from the backoff and increase the load.
- Lower the circuit breaker threshold from 80% to 40%.
- Make the gateway charge before it stops responding, and replace the idempotency key with a new one on every attempt: count the duplicate charges.
