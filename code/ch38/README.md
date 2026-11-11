# Chapter 38: architecture governance

Lab for chapter 38 of *Software Architecture in Practice*.

Morada's decision log lives in Markdown, versioned with the code, and a validator checks the format, the numbering and the supersession links: ADR-038 supersedes ADR-021. Two decisions become fitness functions that run in the pipeline and block the commit that breaks them: "no module reads another module's table" (ADR-010) and "delinquency dashboard p95 under 300 ms at 40 requests per second" (ADR-038).

The database is an embedded PostgreSQL (PGlite), in memory, inside the process itself. The queries are real; the time of each one comes from an assumption, and the load runs on a simulated clock with a fixed seed. That is why the result is the same on any machine.

| Version | What it does |
|---|---|
| `log` | Validates `node/decisions/` and generates the log's index |
| `defects` | Validates `node/decisions-with-defects/`, a log with seven problems |
| `fitness` | Runs three commits (`node/src/commits/c1` to `c3`) through the two fitness functions |

## Prerequisite

Docker with Docker Compose. This lab has only the TypeScript version and starts no other services.

## Walkthrough

```bash
docker compose run --rm app log
docker compose run --rm tools verify log
docker compose run --rm app defects
docker compose run --rm tools verify defects
docker compose run --rm app fitness
docker compose run --rm tools verify fitness
docker compose run --rm app tests
```

The `fitness` version takes about half a minute, because commit `c3` makes thousands of real queries in PGlite.

## Try it

- Write an ADR that supersedes ADR-012 (Communications starts receiving the notices through a queue), and make the validator accept the log.
- Add the rule "the numbering has no gaps" to the validator and explain why it does not hold for this excerpt of the log.
- Create commit `c4`, which fixes the `c3` dashboard and also adds a query with no index. What does the latency function show, and why?
- Write a third fitness function: no dependency in `package.json` with a license outside an allowed list.
