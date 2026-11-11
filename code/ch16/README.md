# Chapter 16: Relational database architecture

Lab for chapter 16 of *Software Architecture in Practice*.

The Morada database with versioned migrations (`migrations/`), a delinquency query over 1 million charges, and a community's reserve fund.

| Version | What it does |
|---|---|
| `query` | Applies the migrations, generates 1 million charges, and shows the plan of the delinquency query with no index, with an index on the wrong column, and with the index from migration 003 |
| `isolation` | Two reserve fund withdrawals, always interleaved in the same order, under READ COMMITTED, REPEATABLE READ, and SERIALIZABLE |

## Prerequisite

Docker with Docker Compose. Choose the language in `.env` (`node`, `php`, `python`, or `java`). Compose starts a PostgreSQL database along with the application.

## Walkthrough

```bash
# The time of each state appears in the terminal; the plans go to output/query
docker compose run --rm app query
docker compose run --rm tools verify query
docker compose run --rm app isolation
docker compose run --rm tools verify isolation

# Migrations and two simultaneous withdrawals with the fund row locked
docker compose run --rm app tests
```

## Try it

- Swap the order of the columns of the index in migration 003 and compare the plans.
- Try a partial index (`WHERE status = 'open'`).
- Create a migration 004 and look at `output/query/migrations.txt`.
