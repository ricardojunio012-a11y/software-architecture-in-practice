# Chapter 30: Distributed transactions and sagas

Lab for chapter 30 of *Software Architecture in Practice*.

The onboarding of Garden Court Condominiums goes through four services, each with its own PostgreSQL schema and no shared transaction: contract, first charge, tenant provisioning and resident import, followed by the welcome email, the step that cannot be undone. The spreadsheet has a bad tax ID on line 37.

| Version | What it does |
|---|---|
| `naive` | Calls the services in sequence; the import fails and the contract, the charge and the tenant are left half done |
| `saga` | An orchestrator saves its progress and, on failure, compensates the completed steps in reverse order |
| `resume` | With the spreadsheet fixed, the orchestrator crashes after the charge; another process resumes, and the charge is not duplicated |
| `compensation` | The orchestrator crashes in the middle of compensation; another process resumes from the saved state and keeps compensating, without moving forward again |

## Prerequisite

Docker with Docker Compose. This lab has only the TypeScript version. PostgreSQL starts on its own.

## Walkthrough

```bash
docker compose run --rm app naive
docker compose run --rm tools verify naive
docker compose run --rm app saga
docker compose run --rm tools verify saga
docker compose run --rm app resume
docker compose run --rm tools verify resume
docker compose run --rm app compensation
docker compose run --rm tools verify compensation
docker compose run --rm app tests
```

## Try it

- Remove the `ON CONFLICT` from the charge issue and run the `resume` version.
- Move the welcome email before the import and run the `saga` version.
- Make the tenant compensation fail once and see what the orchestrator should do.
- Delete the handling of the `compensating` state on resume and run the `compensation` version.
