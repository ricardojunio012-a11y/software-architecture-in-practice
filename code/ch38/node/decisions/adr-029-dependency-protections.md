# ADR-029: Timeout, bulkhead and circuit breaker on every external dependency

- Status: accepted
- Date: 2025-07-07
- Decided by: Billing and Communications Tech Leads and the platform team

## Context

A slowdown of the payment gateway on the 5th stopped all of Morada, and the load of the
retries kept the system slow for fifteen minutes after the gateway came back.

## Decision

Every call to an external dependency goes through a shared library with a timeout, a
bulkhead and a circuit breaker. Retries happen only in the layer closest to the
dependency, with exponential backoff, jitter and a 10% budget.

## Alternatives considered

- Each team picks its own library: diverging parameters and no shared view.
- Timeout only: protects the rest, but keeps sending load to whoever is down.

## Consequences

The failure of a dependency stays contained in it. Some payments that would have gone
through are refused while the circuit breaker is open, and the parameters must be
maintained.

## When to revisit

If maintaining the parameters by hand becomes a burden, or if a critical dependency gets
an alternative path.
