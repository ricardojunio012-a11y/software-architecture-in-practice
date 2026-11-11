# ADR-038: Verifiable decisions become deterministic fitness functions in the pipeline

- Status: approved
- Date: 2026-10-26
- Decided by: the architecture forum, with the Tech Leads of the six teams
- Supersedes: ADR-021

## Context

The k6 load test of ADR-021 ran against a shared environment and failed about one
deployment in eight with no code change. The teams learned to run it again until it
passed, and it was turned off in August. In September, one query per unit came back to
the delinquency dashboard and was only noticed on the 5th.

## Decision

Each architecture decision that can be checked by a program gets a deterministic
fitness function in the pipeline, linked to its ADR. The dashboard target remains the
one in ADR-021: p95 under 300 ms at 40 requests per second. It is now checked under a
simulated load, with the number of queries actually measured and the cost of each one
fixed by an assumption. k6 runs every night against staging, without blocking
deployments.

## Alternatives considered

- Turning k6 back on with automatic retries: hides the variation instead of solving it.
- A dedicated load environment: about $9,000 per month, and still with variation.

## Consequences

The target blocks deployments again without depending on the environment. The
simulation does not measure the real database: a query that is slow for lack of an
index passes it, and is left to the nightly k6 run and to the production SLO.

## When to revisit

If the nightly k6 run and the simulated function disagree for two weeks in a row, or if
the cost-per-query assumption drifts more than 30% from what production measures.
