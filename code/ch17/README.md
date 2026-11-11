# Chapter 17: Multi-tenancy in SaaS

Lab for chapter 17 of *Software Architecture in Practice*.

Every Morada community in one shared table, separated by `community_id`. A report with a forgotten `WHERE` leaks data between communities until PostgreSQL starts filtering the rows with Row-Level Security. One community's faulty integration slows down every other community until it is contained by a per-community token bucket.

| Version | What it does |
|---|---|
| `leak` | Runs the faulty report without RLS, with RLS, in a transaction with no community, and trying to write another community's charge; then on behalf of a management company that sees two communities (table `managed_communities`) |
| `noisy` | Simulates one second of API requests, with no limit and with a token bucket per community (`input/noisy.json`) |

## Prerequisite

Docker with Docker Compose. The default is the TypeScript version (`node`); the extra versions in `php`, `python` and `java` are chosen in `.env`. Compose starts a PostgreSQL database with two roles: the administrator, who creates the tables (`sql/schema.sql` and `sql/rls.sql`), and `app_morada`, used by the application.

## Walkthrough

```bash
docker compose run --rm app leak
docker compose run --rm tools verify leak
docker compose run --rm app noisy
docker compose run --rm tools verify noisy
docker compose run --rm app tests
```

## Try it

- Connect the application as the administrator (replace `APP_DATABASE_URL` with `DATABASE_URL`) and watch the policy stop applying.
- Change the `true` in `set_config` to `false` and think about what is left behind on a reused connection.
- Change the limit in `input/noisy.json` and compare the waits.
- Remove the row `(3, 15)` from `managed_communities` in `sql/schema.sql` and watch the management company lose community 15 without any code change.
