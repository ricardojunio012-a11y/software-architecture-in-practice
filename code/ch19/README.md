# Chapter 19: Analytical data architecture

Lab for chapter 19 of *Software Architecture in Practice*.

An ELT pipeline that takes the data from Morada's PostgreSQL database (40 fictional communities) to a DuckDB analytics database. Tax IDs and license plates are pseudonymized during extraction; the transformation builds a dimensional model; data quality tests quarantine three charges with a zero amount; the report shows delinquency by region and size.

| Version | What it does |
|---|---|
| `elt` | Extracts, loads, transforms, checks quality, and writes `output/elt/report.txt`, `quality.txt`, and `extraction.txt` |

## Prerequisite

Docker with Docker Compose. This lab has only the TypeScript version. PostgreSQL starts on its own; DuckDB runs inside the application.

## Walkthrough

```bash
docker compose run --rm app elt
docker compose run --rm tools verify elt
docker compose run --rm app tests
```

## Try it

- Extract the tax ID without pseudonymizing it, under another column name, and watch the personal data check fail.
- Add a new quality rule in `node/src/quality.ts`.
- Create a month dimension in `sql/model.sql` and group the report by quarter.
