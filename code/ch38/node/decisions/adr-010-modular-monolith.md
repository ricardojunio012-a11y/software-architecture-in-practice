# ADR-010: Morada as a modular monolith, with verified boundaries

- Status: accepted
- Date: 2024-03-11
- Decided by: Bookings and Billing Tech Leads, with the CTO

## Context

Bookings started reading the charges table to apply the delinquency rule and
reimplemented the rule without installment plans. A resident in good standing was kept
from booking, and a column change in Billing broke bookings (chapter 10).

## Decision

Morada remains a single deployment unit, organized in modules that match the bounded
contexts. Each module has a public API, a private interior and its own data, in a
database schema named after the module. No module reads or writes another module's
table; whoever needs a piece of data calls the owner's API.

## Alternatives considered

- Microservices: they would enforce the boundary with the network, at a cost the
  eight-person team would not pay (chapter 12).
- Code review only: depends on human attention, which failed in the incident.

## Consequences

Internal changes in one module no longer break the others. Queries that were a JOIN
across modules become composition in the application.

## When to revisit

If a module comes to have very different scaling or deployment needs, or if the checks
report frequent violations between the same modules.
