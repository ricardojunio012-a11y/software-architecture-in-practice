# ADR-021: Percentile latency targets and a load test of the 5th in the pipeline

- Status: accepted
- Date: 2025-03-17
- Decided by: Billing Tech Lead and the platform team

## Context

The delinquency dashboard became slow every 5th of the month. The 190 ms average hid a
p95 above 700 ms, and the measurement showed 121 queries each time the dashboard opened.

## Decision

Critical routes have latency targets in percentiles, under peak load: for the
delinquency dashboard, p95 under 300 ms. A k6 load test runs in the pipeline before each
deployment and fails the ones that break the target.

## Alternatives considered

- Doubling the database server: expensive, and without knowing where the time went.
- Measuring only in production: the regression would reach residents before the alarm.

## Consequences

Regressions show up before production. The pipeline gets slower and depends on a test
environment with realistic volume.

## When to revisit

If the test in the pipeline becomes unstable because of variation in the test
environment.
