# ADR-012: Extract only Communications as a service

- Status: accepted
- Date: 2024-06-03
- Decided by: Communications Tech Lead, with the CTO

## Context

Communications has peaks on the due date, depends on unstable external providers and
needs a library that conflicts with the ones in the rest of the system. The other
modules change together and have no scaling problem.

## Decision

Extract only Communications as an HTTP service, with its own data and independent
deployment. The monolith calls it with a 2-second timeout, up to 3 attempts and the
notice identifier as the idempotency key.

## Alternatives considered

- Fourteen services: operating and coordination costs with no problem that pays for
  them.
- Everything in the monolith: the conflicting library and the peaks would affect the
  rest.

## Consequences

The providers' slowness stays inside the service. An outage of the service still holds
up Billing for up to three attempts; full isolation calls for a queue.
