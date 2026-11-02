# Morada architecture documentation (short arc42)

This document follows the sections of the arc42 template (https://arc42.org), in the lean form a
small company can keep up to date. The diagrams are in `c4/workspace.dsl`.

## 1. Introduction and goals

Morada calculates and sends the monthly charges of condo and homeowners associations, by invoice
or card payment, and notifies residents by email or SMS. The three most important quality goals,
in order:

1. **Correct calculation:** the charge follows the association's CC&Rs (late fee as set there).
2. **Performance on the 1st:** invoices available within 4 hours (scenarios PERF-01 and PERF-02).
3. **Isolation between communities:** no community sees another one's data (SEC-01).

Stakeholders: board presidents, residents, management companies, the two founders and the
development team.

## 2. Constraints

- Two-person team; infrastructure budget of up to $1,500 per month.
- Integration with payment processors through the interface each one offers (API or ACH files in
  the Nacha format).
- US state privacy laws for residents' data, with the CCPA as amended by the CPRA (Cal. Civ. Code
  §1798.100 et seq.) as the main reference.

## 3. Context and scope

See the context view in Structurizr (`docker compose up -d structurizr`, "Context" view).
Morada talks to the payment processor, the card processor, the email provider and the SMS
provider.

## 4. Solution strategy

A single application (monolith), with billing organized in modules: calculation, payment,
notification, report and orchestration (chapter 1). Payment method and notification channel sit
behind interfaces, because they are the parts that change the most.

## 5. Building block view

See the "Containers" and "Components" views in Structurizr.

## 6. Runtime view

Monthly generation: the scheduler starts billing on the 1st; for each unit, it calculates, creates
the invoice at the payment processor, saves the charge and sends the notice.

## 7. Deployment view

One application server and a managed PostgreSQL database, in the same cloud region.

## 8. Crosscutting concepts

Amounts in integer cents; dates in UTC; rounding half up; minimal personal data in the logs.

## 9. Architecture decisions

- ADR-001: separate the billing rules from the payment methods and the notification channels
  (chapter 1).

## 10. Quality requirements

See `quality-scenarios.md`.

## 11. Risks and technical debt

- **Invoice creation on the 1st (high):** with 30,000 communities, creating the invoices one by
  one would take 6 h 40 min (scenario PERF-02). Alternatives under study: batch creation by file,
  creation spread over the month, card payment as the main method.
- **Single point of failure (medium):** a single application server.

## 12. Glossary

| Term | Meaning |
|---|---|
| Ownership share | The part of the association that belongs to each unit; the basis for splitting the expenses |
| Reserve fund | A percentage of the dues, set by the CC&Rs, for major repairs and replacements |
| Payment processor | The company that creates the invoice and reports the payment |
| Nacha file | The standard file format for ACH payments exchanged between companies and banks |
