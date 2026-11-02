# Chapter 9: hexagonal and Clean Architecture

Lab for chapter 9 of *Software Architecture in Practice*.

The same booking use case, with the core isolated by ports and wired to different adapters: HTTP or command line on the inbound side, memory or PostgreSQL on the outbound side.

| Version | What it does |
|---|---|
| `http-memory` | HTTP API with the repository in memory |
| `http-postgres` | The same API with the repository in PostgreSQL. The output is identical to the previous one |
| `cli-postgres` | Command line with the repository in PostgreSQL, driven by `input/commands.txt` |

## Prerequisite

Docker with Docker Compose. Choose the language in `.env` (`node`, `php`, `python` or `java`). Compose starts a PostgreSQL database along with the application.

## Walkthrough

```bash
docker compose run --rm app http-memory
docker compose run --rm tools verify http-memory
docker compose run --rm app http-postgres
docker compose run --rm tools verify http-postgres
docker compose run --rm app cli-postgres
docker compose run --rm tools verify cli-postgres
docker compose run --rm app tests
```

The `schedules.txt` file of each version shows the final state of the schedules, read back through the repository.

## Try it

- Switch the command line's composition root to the in-memory repository and explain what stops working.
- Write an adapter that keeps the schedules in JSON files and make it pass the contract test.
