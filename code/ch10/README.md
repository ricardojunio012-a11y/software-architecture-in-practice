# Chapter 10: Strategic DDD and the modular monolith

Lab for chapter 10 of *Software Architecture in Practice*.

Bookings and Billing as modules of a modular monolith, each with a public API and its own data, and an architecture test in each language (dependency-cruiser, deptrac, import-linter and ArchUnit).

| Version | What it does |
|---|---|
| `before` | Bookings reads the Billing table directly |
| `after` | Bookings asks Billing through the `FinancialStanding` port, using the module's public API |

## Prerequisite

Docker with Docker Compose. Choose the language in `.env` (`node`, `php`, `python` or `java`).

## Walkthrough

```bash
docker compose run --rm app before
docker compose run --rm tools verify before
docker compose run --rm app after
docker compose run --rm tools verify after

# Succeeds only if "before" breaks the rule and "after" keeps it
docker compose run --rm app architecture
docker compose run --rm app tests
```

## Now the hard part: the shortcut in SQL (TypeScript only)

The architecture test reads only `import` statements; the chapter's incident was an SQL query.
This step starts PostgreSQL on the Compose internal network (no host port), creates one schema
and one role per module and shows the database rejecting the Bookings query on the Billing table.
It always uses the Node image, whatever the language in `.env`.

```bash
docker compose run --rm schemas
docker compose run --rm tools verify schemas
docker compose down
```

## Try it

- In the `after` version, make Billing import something from Bookings and run `architecture` to read the message.
- Before touching the code, run a paper Event Storming of a payment reversal.
