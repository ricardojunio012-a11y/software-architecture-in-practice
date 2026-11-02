# Morada quality scenarios

Version of October 2026. Each scenario follows the six parts proposed by Bass, Clements and Kazman:
source, stimulus, artifact, environment, response and response measure. The "Priority" column uses
the ATAM utility tree notation: (importance to the business, technical difficulty), with H = high,
M = medium and L = low.

## Utility tree (summary)

| Attribute | Refinement | Scenario | Priority |
|---|---|---|---|
| Performance | Peak on the 1st | PERF-01, PERF-02 | (H, H) |
| Performance | Resident browsing | PERF-03 | (M, L) |
| Availability | Payment on the due date | AVAIL-01 | (H, M) |
| Security | Isolation between communities | SEC-01 | (H, M) |
| Privacy | Deletion request (CCPA) | PRIV-01 | (H, M) |
| Modifiability | New notification channel | MOD-01 | (M, L) |
| Reliability | Front desk without internet | REL-01 | (M, H) |

## Scenarios

### PERF-01 and PERF-02: invoices available on the 1st

| Part | PERF-01 (2026) | PERF-02 (2029) |
|---|---|---|
| Source | Morada scheduler | Morada scheduler |
| Stimulus | Monthly generation of 12,000 charges (300 communities) | Monthly generation of 1.2 million charges (30,000 communities) |
| Artifact | Monthly billing and the payment processor integration | Same |
| Environment | Normal operation, on the 1st, 1 vCPU and 512 MB for the calculation; payment processor limited to 50 invoices per second | Same |
| Response | All charges calculated, invoices created and notices ready | Same |
| Measure | Within 4 hours | Within 4 hours |

Automatic check: `docker compose run --rm app scenarios` (see `scenarios/scenarios.json`).
The time until the batch invoice creation is confirmed (ADR-002), with rejections and new
attempts, is simulated by `docker compose run --rm app batch` (see `scenarios/batch.json`). The
"within 4 hours" measure applies to every invoice: it is a target on the worst case, not on the
average.

### PERF-03: the resident's charges screen

- **Source:** resident, in the app or the browser.
- **Stimulus:** opens the list of their charges.
- **Artifact:** web application and API.
- **Environment:** normal operation, peak time (the 1st at 9 a.m.).
- **Response:** the list shows the amount and the payment code.
- **Measure:** 95% of the responses within 800 ms, measured on the server.

### AVAIL-01: payment on the due date

- **Source:** resident.
- **Stimulus:** tries to get the payment code on the 5th.
- **Artifact:** Morada API.
- **Environment:** one instance of the application fails.
- **Response:** another instance serves the request, without the resident noticing.
- **Measure:** 99.9% monthly availability on the payment routes (up to 43 minutes down per month).

### SEC-01: isolation between communities

- **Source:** authenticated user of one community.
- **Stimulus:** requests a charge from another community by changing the identifier in the URL.
- **Artifact:** API and database.
- **Environment:** normal operation.
- **Response:** the request is denied and the attempt is recorded in the audit log.
- **Measure:** 100% of the attempts denied; an alert to the team within 5 minutes if there are more than 10 attempts per hour from the same user.

### PRIV-01: deletion of personal data (CCPA)

- **Source:** former resident, the consumer the data is about.
- **Stimulus:** asks for their personal data to be deleted.
- **Artifact:** every data store in Morada.
- **Environment:** normal operation.
- **Response:** personal data deleted or deidentified, keeping what the law requires to be kept (tax records).
- **Measure:** completed within 15 days (Morada's own target), with a confirmation to the consumer.

### MOD-01: new notification channel

- **Source:** product team.
- **Stimulus:** asks for push notifications in the resident app.
- **Artifact:** monthly billing code.
- **Environment:** development time.
- **Response:** the channel is added without changing calculation, payment and report.
- **Measure:** up to 3 person-days, with tests, and no existing file changed except the wiring (`main`).

### REL-01: front desk without internet

- **Source:** the community's internet provider goes down.
- **Stimulus:** the front-desk staff record a visitor's entry.
- **Artifact:** front desk app.
- **Environment:** no connection for up to 4 hours.
- **Response:** the entry is accepted locally and synchronized when the connection comes back.
- **Measure:** no entry lost; synchronization within 5 minutes after the connection comes back.
