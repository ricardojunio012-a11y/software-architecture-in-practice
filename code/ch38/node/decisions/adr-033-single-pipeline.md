# ADR-033: Single pipeline with architecture tests and canary

- Status: accepted
- Date: 2026-02-09
- Decided by: the platform team, with the Tech Leads of the six teams

## Context

Deployments were weekly, manual and carried dozens of changes. A migration that renamed
a column caused twelve minutes of errors, and SOC 2 asks for evidence of change
control.

## Decision

Every change goes to trunk and through a single pipeline: build, tests, architecture
tests, immutable artifact and a canary with 5% of the traffic.

## Alternatives considered

- One pipeline per team: each with different rules and evidence for the auditor.
- Keeping the weekly deployment with more review: more waiting and the same risk.

## Consequences

Small, daily deployments, with the evidence coming out of the pipeline. The pipeline
becomes a critical piece and needs an audited emergency path.

## When to revisit

If the pipeline goes over 15 minutes at the 90th percentile, or if the change failure
rate does not drop in two quarters.
